import {
  SolanaStreamClient,
  isCliffCloseToDepositedAmount,
  isDynamicLock,
  isTokenLock,
} from "@streamflow/stream";

import type { LiquidityLock } from "./types";

const STREAMFLOW_PROGRAM_ID =
  "strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m";

function getRpcUrl(): string {
  const apiKey = process.env.HELIUS_API_KEY;

  if (!apiKey) {
    throw new Error("HELIUS_API_KEY is missing");
  }

  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
}

function unknownLock(): LiquidityLock {
  return {
    status: "UNKNOWN",
    confidence: "UNKNOWN",
    provider: null,
    lockedAmountUsd: null,
    unlockedAmountUsd: null,
    lockedPercent: null,
    unlockTimestamp: null,
    unlockDate: null,
    daysRemaining: null,
  };
}

function roundPercent(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

function calculateUsd(
  lockedRaw: bigint,
  supplyRaw: bigint,
  liquidityUsd: number | null | undefined
): number | null {
  if (
    liquidityUsd === null ||
    liquidityUsd === undefined ||
    !Number.isFinite(liquidityUsd) ||
    liquidityUsd < 0 ||
    lockedRaw <= BigInt(0) ||
    supplyRaw <= BigInt(0)
  ) {
    return null;
  }

  const ratio =
    Number(lockedRaw) /
    Number(supplyRaw);

  if (!Number.isFinite(ratio) || ratio < 0) {
    return null;
  }

  return Math.min(
    liquidityUsd,
    liquidityUsd * ratio
  );
}

function calculateLockedRaw(
  stream: any,
  now: number
): bigint {
  try {
    const deposited =
      BigInt(stream.depositedAmount.toString());

    const unlocked =
      BigInt(stream.unlocked(now).toString());

    if (deposited <= BigInt(0)) {
      return BigInt(0);
    }

    if (unlocked <= BigInt(0)) {
      return deposited;
    }

    if (unlocked >= deposited) {
      return BigInt(0);
    }

    return deposited - unlocked;
  } catch {
    return BigInt(0);
  }
}

function getFixedUnlockTimestamp(
  stream: any,
  now: number,
  cliffLock: boolean
): number | null {
  const cliff =
    typeof stream.cliff === "number"
      ? stream.cliff
      : null;

  const end =
    typeof stream.end === "number"
      ? stream.end
      : null;

  if (
    cliffLock &&
    cliff !== null &&
    cliff > now
  ) {
    return cliff;
  }

  if (
    end !== null &&
    end > now
  ) {
    return end;
  }

  return null;
}

export interface StreamflowLockOptions {
  lpSupplyRaw?: string | null;
  liquidityUsd?: number | null;
  calculateUsd?: boolean;
}

export async function detectStreamflowLock(
  lpMint: string,
  options: StreamflowLockOptions = {},
  evidence: string[] = []
): Promise<LiquidityLock> {
  try {
    const client =
      new SolanaStreamClient(
        { clusterUrl: getRpcUrl() },
      );

    const streams =
      await client.searchStreams({
        mint: lpMint,
        closed: false,
      });

    evidence.push(
      `Streamflow search completed for LP mint ${lpMint}; ${streams.length} open stream account(s) matched.`
    );

    if (streams.length === 0) {
      evidence.push(
        `No active Streamflow lock was verified for LP mint ${lpMint}.`
      );

      return unknownLock();
    }

    const now =
      Math.floor(Date.now() / 1000);

    let recognizedStreams = 0;
    let activeLockedRaw = BigInt(0);
    let activeFixedLocks = 0;
    let activeDynamicLocks = 0;
    let earliestUnlock: number | null = null;
    let allRecognizedUnlocked = true;

    for (const account of streams) {
      const stream: any =
        (account as any).data ?? account;

      let tokenLock = false;

      try {
        tokenLock =
          isTokenLock({
            canTopup:
              stream.canTopup,
            automaticWithdrawal:
              stream.automaticWithdrawal,
            cancelableBySender:
              stream.cancelableBySender,
            cancelableByRecipient:
              stream.cancelableByRecipient,
            transferableBySender:
              stream.transferableBySender,
            transferableByRecipient:
              stream.transferableByRecipient,
            depositedAmount:
              stream.depositedAmount,
            cliffAmount:
              stream.cliffAmount,
            cliff:
              stream.cliff,
            end:
              stream.end,
          });
      } catch {
        tokenLock = false;
      }

      if (!tokenLock) {
        continue;
      }

      recognizedStreams++;

      const lockedRaw =
        calculateLockedRaw(
          stream,
          now
        );

      if (lockedRaw <= BigInt(0)) {
        continue;
      }

      allRecognizedUnlocked = false;
      activeLockedRaw += lockedRaw;

      let dynamicLock = false;

      try {
        dynamicLock =
          (isDynamicLock as any)({
            minPrice:
              stream.minPrice,
            maxPrice:
              stream.maxPrice,
            minPercentage:
              stream.minPercentage,
            maxPercentage:
              stream.maxPercentage,
          });
      } catch {
        dynamicLock = false;
      }

      if (dynamicLock) {
        activeDynamicLocks++;
        continue;
      }

      const cliffLock =
        isCliffCloseToDepositedAmount({
          depositedAmount:
            stream.depositedAmount,
          cliffAmount:
            stream.cliffAmount,
        });

      const unlockTimestamp =
        getFixedUnlockTimestamp(
          stream,
          now,
          cliffLock
        );

      if (unlockTimestamp !== null) {
        activeFixedLocks++;

        if (
          earliestUnlock === null ||
          unlockTimestamp < earliestUnlock
        ) {
          earliestUnlock =
            unlockTimestamp;
        }
      }
    }

    if (recognizedStreams === 0) {
      evidence.push(
        `Streamflow accounts matched the LP mint, but no recognized token-lock configuration was verified.`
      );

      return unknownLock();
    }

    if (activeLockedRaw <= BigInt(0)) {
      evidence.push(
        `Streamflow token-lock accounts were recognized for LP mint ${lpMint}, but no currently locked LP amount remains.`
      );

      return {
        status: "UNLOCKED",
        confidence: "HIGH",
        provider: "Streamflow",
        lockedAmountUsd: 0,
        unlockedAmountUsd:
          options.liquidityUsd ?? null,
        lockedPercent: 0,
        unlockTimestamp: null,
        unlockDate: null,
        daysRemaining: 0,
      };
    }

    const hasDynamicLock =
      activeDynamicLocks > 0;

    const hasUnknownUnlock =
      activeLockedRaw > BigInt(0) &&
      activeFixedLocks === 0 &&
      !hasDynamicLock;

    const activeRecognizedLocks =
      recognizedStreams > 0 &&
      activeLockedRaw > BigInt(0);

    const allActiveLocksHaveFixedDates =
      activeRecognizedLocks &&
      !hasDynamicLock &&
      activeFixedLocks > 0 &&
      hasUnknownUnlock === false;

    const lockStatus =
      hasDynamicLock || hasUnknownUnlock
        ? "UNKNOWN"
        : allActiveLocksHaveFixedDates
          ? "TIME_LOCKED"
          : "UNKNOWN";

    const confidence =
      lockStatus === "TIME_LOCKED"
        ? "VERIFIED"
        : "HIGH";

    const supplyRaw =
      options.lpSupplyRaw
        ? BigInt(options.lpSupplyRaw)
        : null;

    const calculateUsdValue =
      options.calculateUsd !== false;

    const lockedPercent =
      supplyRaw !== null &&
      supplyRaw > BigInt(0)
        ? roundPercent(
            Number(activeLockedRaw) /
              Number(supplyRaw) *
              100
          )
        : null;

    const lockedAmountUsd =
      calculateUsdValue &&
      supplyRaw !== null
        ? calculateUsd(
            activeLockedRaw,
            supplyRaw,
            options.liquidityUsd
          )
        : null;

    const unlockedAmountUsd =
      lockedAmountUsd !== null &&
      options.liquidityUsd !== null &&
      options.liquidityUsd !== undefined
        ? Math.max(
            0,
            options.liquidityUsd -
              lockedAmountUsd
          )
        : null;

    const unlockDate =
      lockStatus === "TIME_LOCKED" &&
      earliestUnlock !== null
        ? new Date(
            earliestUnlock * 1000
          ).toISOString()
        : null;

    const daysRemaining =
      lockStatus === "TIME_LOCKED" &&
      earliestUnlock !== null
        ? Math.max(
            0,
            Math.ceil(
              (
                earliestUnlock -
                now
              ) /
                86400
            )
          )
        : null;

    evidence.push(
      `Verified Streamflow token lock exposure: ${activeLockedRaw.toString()} raw LP units remain locked.`
    );

    if (
      lockStatus === "TIME_LOCKED" &&
      unlockDate !== null
    ) {
      evidence.push(
        `Streamflow reports the earliest verified LP unlock at ${unlockDate}.`
      );
    } else if (hasDynamicLock) {
      evidence.push(
        "Streamflow identified an active dynamic lock; no fixed unlock date is claimed."
      );
    } else {
      evidence.push(
        "Streamflow identified active locked LP tokens, but a reliable fixed unlock date could not be established."
      );
    }

    if (
      lockedPercent !== null
    ) {
      evidence.push(
        `Streamflow locked LP exposure represents approximately ${lockedPercent}% of the supplied LP amount used for the calculation.`
      );
    }

    return {
      status: lockStatus,
      confidence,
      provider: "Streamflow",
      lockedAmountUsd,
      unlockedAmountUsd,
      lockedPercent,
      unlockTimestamp:
        lockStatus === "TIME_LOCKED"
          ? earliestUnlock
          : null,
      unlockDate,
      daysRemaining,
    };
  } catch (error) {
    evidence.push(
      error instanceof Error
        ? `Streamflow lock verification was unavailable: ${error.message}`
        : "Streamflow lock verification was unavailable."
    );

    return unknownLock();
  }
}
