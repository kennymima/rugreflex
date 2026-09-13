import { detectStreamflowLock } from "../streamflow";
import {
  Connection,
  PublicKey,
} from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  LiquidityPool,
  LiquidityPoolType,
  LiquidityPosition,
  LiquidityPositionModel,
} from "../types";

const RAYDIUM_AMM_V4_PROGRAM_ID =
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

const RAYDIUM_CPMM_PROGRAM_ID =
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";

const CPMM_POOL_CREATOR_OFFSET = 40;
const CPMM_LP_MINT_OFFSET = 136;
const CPMM_TOKEN_0_MINT_OFFSET = 168;
const CPMM_TOKEN_1_MINT_OFFSET = 200;
const CPMM_STATUS_OFFSET = 329;
const CPMM_LP_SUPPLY_OFFSET = 333;

const RAYDIUM_CLMM_PROGRAM_ID =
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";

function getRpcUrl(): string {
  const apiKey = process.env.HELIUS_API_KEY;

  if (!apiKey) {
    throw new Error("HELIUS_API_KEY is missing");
  }

  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
}

function readPublicKey(data: Buffer, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + 32));
}

function readU64LE(data: Buffer, offset: number): bigint {
  return data.readBigUInt64LE(offset);
}

function calculatePercentage(amount: bigint, total: bigint): number | null {
  if (total <= BigInt(0)) return null;
  const percentage = (Number(amount) / Number(total)) * 100;
  if (!Number.isFinite(percentage)) return null;
  return Math.round(percentage * 100) / 100;
}

function unknownLock() {
  return {
    status: "UNKNOWN" as const,
    confidence: "UNKNOWN" as const,
    provider: null,
    lockedAmountUsd: null,
    unlockedAmountUsd: null,
    lockedPercent: null,
    unlockTimestamp: null,
    unlockDate: null,
    daysRemaining: null,
  };
}

function identifyPoolType(
  owner: PublicKey
): {
  poolType: LiquidityPoolType;
  positionModel: LiquidityPositionModel;
} | null {
  const ownerAddress = owner.toBase58();

  if (
    ownerAddress ===
    RAYDIUM_AMM_V4_PROGRAM_ID
  ) {
    return {
      poolType: "AMM",
      positionModel: "FUNGIBLE_LP",
    };
  }

  if (
    ownerAddress ===
    RAYDIUM_CPMM_PROGRAM_ID
  ) {
    return {
      poolType: "CPMM",
      positionModel: "FUNGIBLE_LP",
    };
  }

  if (
    ownerAddress ===
    RAYDIUM_CLMM_PROGRAM_ID
  ) {
    return {
      poolType: "CLMM",
      positionModel: "NFT_POSITION",
    };
  }

  return null;
}

async function inspectCpmmLpPositions(
  connection: Connection,
  lpMint: PublicKey,
  lpSupplyRaw: bigint,
  liquidityUsd: number | null,
  evidence: string[],
  evidenceLabel = "Raydium CPMM"
): Promise<LiquidityPosition[]> {
  const largestAccounts =
    await connection.getTokenLargestAccounts(
      lpMint,
      "confirmed"
    );

  const nonZeroAccounts =
    largestAccounts.value.filter(
      (account) => account.amount !== "0"
    );

  if (nonZeroAccounts.length === 0) {
    evidence.push(
      `${evidenceLabel} LP mint returned no non-zero token accounts from the largest-account query.`
    );
    return [];
  }

  const parsedAccounts =
    await connection.getMultipleParsedAccounts(
      nonZeroAccounts.map(
        (account) => account.address
      ),
      {
        commitment: "confirmed",
      }
    );

  evidence.push(
    `${evidenceLabel} largest LP token accounts were queried directly on-chain.`
  );

  evidence.push(
    `${evidenceLabel} holder analysis covers the largest LP token accounts returned by the RPC and does not prove that no smaller LP holders exist.`
  );

  const positions: LiquidityPosition[] = [];

  for (
    let index = 0;
    index < nonZeroAccounts.length;
    index += 1
  ) {
    const account = nonZeroAccounts[index];
    const parsed =
      parsedAccounts.value[index];

    const data = parsed?.data;

    const info =
      data &&
      typeof data === "object" &&
      "parsed" in data
        ? (data as any).parsed?.info
        : null;

    const owner =
      typeof info?.owner === "string"
        ? info.owner
        : null;

    let amountRaw: bigint;

    try {
      amountRaw = BigInt(account.amount);
    } catch {
      continue;
    }

    const sharePercent =
      calculatePercentage(
        amountRaw,
        lpSupplyRaw
      );

    const positionLiquidityUsd =
      liquidityUsd !== null &&
      sharePercent !== null
        ? (liquidityUsd * sharePercent) / 100
        : null;

    positions.push({
      address: account.address.toBase58(),
      model: "FUNGIBLE_LP",
      owner,
      controller: owner,
      amountRaw: account.amount,
      sharePercent,
      liquidityUsd: positionLiquidityUsd,
      lock: unknownLock(),
    });

    if (owner) {
      evidence.push(
        evidenceLabel + " LP holder " +
          String(index + 1) +
          ": " +
          owner +
          " controls approximately " +
          String(sharePercent ?? 0) +
          "% of reported LP supply."
      );
    } else {
      evidence.push(
        evidenceLabel + " LP holder " +
          String(index + 1) +
          ": owner authority could not be resolved for token account " +
          account.address.toBase58() +
          "."
      );
    }
  }

  return positions;
}

async function detectRaydiumLpBurn(
  connection: Connection,
  poolAddress: PublicKey,
  lpMint: PublicKey,
  originalSupplyRaw: bigint,
  evidence: string[],
  evidenceLabel = "Raydium CPMM"
) {
  try {
    if (originalSupplyRaw <= BigInt(0)) {
      evidence.push(
        `${evidenceLabel} current LP supply is zero; historical LP burn transactions will still be inspected, but burn percentage cannot be calculated from current supply.`
      );
    }

    const signatures =
      await connection.getSignaturesForAddress(
        lpMint,
        { limit: 1000 },
        "confirmed"
      );

    if (signatures.length === 0) {
      evidence.push(
        `${evidenceLabel} LP mint has no transaction history available for burn verification.`
      );

      return {
        status: "NOT_VERIFIED" as const,
        confidence: "LOW" as const,
        burnedAmountRaw: null,
        burnedPercent: null,
        originalSupplyRaw: originalSupplyRaw.toString(),
        currentSupplyRaw: null,
        currentSupplyPercentOfOriginal: null,
        transactionSignature: null,
        slot: null,
        timestamp: null,
      };
    }

    const orderedSignatures = [...signatures].reverse();

    for (const signatureInfo of orderedSignatures) {
      const transaction =
        await connection.getParsedTransaction(
          signatureInfo.signature,
          {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed",
          }
        );

      if (!transaction) {
        continue;
      }

      const accountKeys =
        transaction.transaction.message.accountKeys;

      const mentionsPool =
        accountKeys.some(
          (account: any) =>
            account.pubkey.toString() ===
            poolAddress.toBase58()
        );

      if (!mentionsPool) {
        continue;
      }

      const instructions: any[] = [];

      const topLevelInstructions =
        transaction.transaction.message.instructions;

      if (Array.isArray(topLevelInstructions)) {
        instructions.push(
          ...topLevelInstructions
        );
      }

      const innerInstructions =
        transaction.meta?.innerInstructions;

      if (Array.isArray(innerInstructions)) {
        for (const group of innerInstructions) {
          if (Array.isArray(group?.instructions)) {
            instructions.push(
              ...group.instructions
            );
          }
        }
      }

      let burnedAmountRaw = BigInt(0);

      for (const instruction of instructions) {
        if (
          instruction?.program !== "spl-token" &&
          instruction?.program !== "spl-token-2022"
        ) {
          continue;
        }

        const parsed = instruction?.parsed;

        if (
          !parsed ||
          parsed.type !== "burn"
        ) {
          continue;
        }

        const info = parsed.info;

        if (
          !info ||
          info.mint !== lpMint.toBase58()
        ) {
          continue;
        }

        const amount = info.amount;

        if (
          typeof amount !== "string" &&
          typeof amount !== "number"
        ) {
          continue;
        }

        try {
          burnedAmountRaw += BigInt(
            String(amount)
          );
        } catch {
          continue;
        }
      }

      if (burnedAmountRaw <= BigInt(0)) {
        continue;
      }

      evidence.push(
        `Raydium CPMM LP burn was verified from an explicit SPL Token burn instruction for ${burnedAmountRaw.toString()} raw LP tokens.`
      );

      evidence.push(
        `Verified Raydium CPMM LP burn transaction: ${signatureInfo.signature}.`
      );

      evidence.push(
        "The burn transaction also references the inspected Raydium CPMM pool."
      );

      evidence.push(
        "Burn verification proves that the specified LP tokens were burned; it does not by itself prove that all remaining liquidity is locked or unavailable."
      );

      const burnedPercent =
        originalSupplyRaw > BigInt(0)
          ? Number(burnedAmountRaw * BigInt(10000) / originalSupplyRaw) / 100
          : null;

      evidence.push(
        burnedPercent !== null
          ? `Approximately ${burnedPercent.toFixed(2)}% of the original Raydium CPMM LP supply was burned.`
          : "Raydium CPMM LP burn percentage could not be calculated."
      );

      return {
        status: "VERIFIED" as const,
        confidence: "HIGH" as const,
        burnedAmountRaw:
          burnedAmountRaw.toString(),
        burnedPercent,
        originalSupplyRaw:
          originalSupplyRaw.toString(),
        currentSupplyRaw: null,
        currentSupplyPercentOfOriginal:
          burnedPercent !== null
            ? Math.max(0, 100 - burnedPercent)
            : null,
        transactionSignature:
          signatureInfo.signature,
        slot: signatureInfo.slot,
        timestamp:
          signatureInfo.blockTime ?? null,
      };
    }

    evidence.push(
      "No explicit Raydium CPMM LP burn instruction matching the inspected pool was verified in the available LP mint transaction history."
    );

    return {
      status: "NOT_VERIFIED" as const,
      confidence: "LOW" as const,
      burnedAmountRaw: null,
      burnedPercent: null,
      originalSupplyRaw: originalSupplyRaw.toString(),
      currentSupplyRaw: null,
      currentSupplyPercentOfOriginal: null,
      transactionSignature: null,
      slot: null,
      timestamp: null,
    };
  } catch (error) {
    evidence.push(
      error instanceof Error
        ? `Raydium CPMM LP burn inspection unavailable: ${error.message}`
        : "Raydium CPMM LP burn inspection unavailable."
    );

    return {
      status: "UNKNOWN" as const,
      confidence: "UNKNOWN" as const,
      burnedAmountRaw: null,
      burnedPercent: null,
      originalSupplyRaw: originalSupplyRaw.toString(),
      currentSupplyRaw: null,
      currentSupplyPercentOfOriginal: null,
      transactionSignature: null,
      slot: null,
      timestamp: null,
    };
  }
}

async function inspectCpmm(
  connection: Connection,
  pairAddress: PublicKey,
  tokenMint: PublicKey,
  liquidityUsd: number | null,
  volume24h: number | null,
  evidence: string[]
): Promise<{ pool: LiquidityPool }> {
  const accountInfo = await connection.getAccountInfo(pairAddress);

  if (!accountInfo) {
    throw new Error("Raydium CPMM pool account could not be found.");
  }

  const data = accountInfo.data;

  if (data.length < 341) {
    throw new Error("Raydium CPMM pool account has an unexpected size.");
  }

  const poolCreator = readPublicKey(data, CPMM_POOL_CREATOR_OFFSET);
  const lpMint = readPublicKey(data, CPMM_LP_MINT_OFFSET);
  const token0Mint = readPublicKey(data, CPMM_TOKEN_0_MINT_OFFSET);
  const token1Mint = readPublicKey(data, CPMM_TOKEN_1_MINT_OFFSET);
  const status = data.readUInt8(CPMM_STATUS_OFFSET);
  const lpSupplyRaw = readU64LE(data, CPMM_LP_SUPPLY_OFFSET);

  if (
    token0Mint.toBase58() !== tokenMint.toBase58() &&
    token1Mint.toBase58() !== tokenMint.toBase58()
  ) {
    throw new Error(
      "Raydium CPMM pool does not contain the requested token mint."
    );
  }

  evidence.push(
    "Raydium CPMM pool state was decoded directly from the on-chain account."
  );

  evidence.push(
    `Raydium CPMM pool creator: ${poolCreator.toBase58()}.`
  );

  evidence.push(
    `Raydium CPMM LP mint: ${lpMint.toBase58()}.`
  );

  if ((status & 2) !== 0) {
    evidence.push(
      "Raydium CPMM pool status currently has withdrawals disabled."
    );
  } else {
    evidence.push(
      "Raydium CPMM pool status does not currently indicate that withdrawals are disabled."
    );
  }

  evidence.push(
    `Raydium CPMM reports LP supply of ${lpSupplyRaw.toString()} raw units.`
  );

  const positions =
    await inspectCpmmLpPositions(
      connection,
      lpMint,
      lpSupplyRaw,
      liquidityUsd,
      evidence
    );

  const lpBurn =
    await detectRaydiumLpBurn(
      connection,
      pairAddress,
      lpMint,
      lpSupplyRaw,
      evidence,
      "Raydium CPMM"
    );

  const topPosition = positions[0];

  const controller =
    topPosition?.owner &&
    topPosition.sharePercent !== null &&
    topPosition.sharePercent >= 99.99
      ? topPosition.owner
      : null;

  if (controller) {
    evidence.push(
      "Raydium CPMM LP control is concentrated in " +
        controller +
        ", with approximately " +
        String(topPosition?.sharePercent ?? 0) +
        "% of reported LP supply."
    );
  } else if (topPosition?.owner) {
    evidence.push(
      "Raydium CPMM largest observed LP holder is " +
        topPosition.owner +
        " with approximately " +
        String(topPosition.sharePercent ?? 0) +
        "% of reported LP supply; this does not establish sole withdrawal control."
    );
  }

  const lock =
    await detectStreamflowLock(
      lpMint.toBase58(),
      {
        lpSupplyRaw:
          lpSupplyRaw.toString(),
        liquidityUsd,
        calculateUsd: true,
      },
      evidence
    );

  const pool: LiquidityPool = {
    address: pairAddress.toBase58(),
    dex: "Raydium",
    poolType: "CPMM",
    tokenMint: tokenMint.toBase58(),
    liquidityUsd,
    volume24h,
    positionModel: "FUNGIBLE_LP",
    controller,
    positions,
    lpBurn,
    lock,
  };

  return { pool };
}

export interface RaydiumInspectionInput {
  tokenMint: string;
  pairAddress: string;

  liquidityUsd?: number | null;
  volume24h?: number | null;
}

export interface RaydiumInspectionResult {
  verified: boolean;
  pool: LiquidityPool | null;
  evidence: string[];
}

async function inspectAmmV4(
  connection: Connection,
  pairAddress: PublicKey,
  tokenMint: PublicKey,
  liquidityUsd: number | null,
  volume24h: number | null,
  evidence: string[]
): Promise<LiquidityPool> {
  const accountInfo = await connection.getAccountInfo(
    pairAddress,
    "confirmed"
  );

  if (!accountInfo || accountInfo.data.length < 752) {
    throw new Error(
      "Raydium AMM V4 pool account has an unexpected data length."
    );
  }

  const data = Buffer.from(accountInfo.data);

  const baseVault = readPublicKey(data, 336);
  const quoteVault = readPublicKey(data, 368);
  const baseMint = readPublicKey(data, 400);
  const quoteMint = readPublicKey(data, 432);
  const lpMint = readPublicKey(data, 464);
  const owner = readPublicKey(data, 688);
  const lpReserve = readU64LE(data, 720);

  const requested = tokenMint.toBase58();
  const base = baseMint.toBase58();
  const quote = quoteMint.toBase58();

  if (requested !== base && requested !== quote) {
    throw new Error(
      "Raydium AMM V4 pool does not contain the requested token mint."
    );
  }

  evidence.push(
    `Raydium AMM V4 state decoded on-chain: base mint ${base}, quote mint ${quote}, LP mint ${lpMint.toBase58()}.`
  );

  evidence.push(
    `Raydium AMM V4 vaults verified: ${baseVault.toBase58()} and ${quoteVault.toBase58()}.`
  );

  evidence.push(
    `Raydium AMM V4 pool owner authority: ${owner.toBase58()}.`
  );

  let lpSupplyRaw: bigint | null = null;

  try {
    const supply = await connection.getTokenSupply(
      lpMint,
      "confirmed"
    );

    lpSupplyRaw = BigInt(supply.value.amount);
  } catch {
    lpSupplyRaw = null;
  }

  if (lpSupplyRaw !== null && lpSupplyRaw > BigInt(0)) {
    evidence.push(
      `Raydium AMM V4 current LP supply verified on-chain: ${lpSupplyRaw.toString()} raw tokens.`
    );
  } else {
    evidence.push(
      "Raydium AMM V4 LP supply could not be established as a positive value."
    );
  }

  const positions =
    lpSupplyRaw !== null && lpSupplyRaw > BigInt(0)
      ? await inspectCpmmLpPositions(
          connection,
          lpMint,
          lpSupplyRaw,
          liquidityUsd,
          evidence,
          "Raydium AMM V4"
        )
      : [];

  const dominantPosition = positions.find(
    (position) =>
      position.owner &&
      position.sharePercent !== null &&
      position.sharePercent >= 99.99
  );

  const controller =
    dominantPosition?.owner ?? null;

  if (controller) {
    evidence.push(
      `Raydium AMM V4 largest observed LP holder controls approximately ${dominantPosition?.sharePercent?.toFixed(2)}% of LP supply and is the observed withdrawal controller.`
    );
  } else {
    evidence.push(
      "Raydium AMM V4 largest observed LP holders do not establish a single LP withdrawal controller at the 99.99% threshold."
    );
  }

  const lock = await detectStreamflowLock(
    lpMint.toBase58(),
    {
      liquidityUsd,
      lpSupplyRaw: lpSupplyRaw?.toString() ?? null,
      calculateUsd: true,
    },
    evidence
  );

  evidence.push(
    `Raydium AMM V4 LP reserve recorded in pool state: ${lpReserve.toString()} raw tokens.`
  );

  return {
    address: pairAddress.toBase58(),
    dex: "Raydium",
    poolType: "AMM",
    tokenMint: requested,
    liquidityUsd,
    volume24h,
    positionModel: "FUNGIBLE_LP",
    controller,
    positions,
    lpBurn: await detectRaydiumLpBurn(
      connection,
      pairAddress,
      lpMint,
      lpSupplyRaw ?? BigInt(0),
      evidence,
      "Raydium AMM V4"
    ),
    lock,
  };
}

function inspectClmm(
  accountData: Buffer,
  pairAddress: PublicKey,
  tokenMint: PublicKey,
  liquidityUsd: number | null,
  volume24h: number | null,
  evidence: string[]
): LiquidityPool {
  if (accountData.length < 1544) {
    throw new Error(
      "Raydium CLMM pool account has an unexpected data length."
    );
  }

  // Raydium CLMM PoolState is an Anchor account:
  // 8-byte discriminator followed by packed PoolState fields.
  const bump = accountData[8];
  const owner = readPublicKey(accountData, 41);
  const tokenMint0 = readPublicKey(accountData, 73);
  const tokenMint1 = readPublicKey(accountData, 105);
  const tokenVault0 = readPublicKey(accountData, 137);
  const tokenVault1 = readPublicKey(accountData, 169);
  const observationKey = readPublicKey(accountData, 201);
  const tickSpacing = accountData.readUInt16LE(235);

  const requested = tokenMint.toBase58();
  const mint0 = tokenMint0.toBase58();
  const mint1 = tokenMint1.toBase58();

  if (requested !== mint0 && requested !== mint1) {
    throw new Error(
      "Raydium CLMM pool does not contain the requested token mint."
    );
  }

  evidence.push(
    `Raydium CLMM PoolState decoded on-chain: token mint 0 ${mint0}, token mint 1 ${mint1}.`
  );

  evidence.push(
    `Raydium CLMM vaults verified: ${tokenVault0.toBase58()} and ${tokenVault1.toBase58()}.`
  );

  evidence.push(
    `Raydium CLMM pool owner authority: ${owner.toBase58()}; observation account ${observationKey.toBase58()}.`
  );

  evidence.push(
    `Raydium CLMM pool bump ${String(bump)} and tick spacing ${String(tickSpacing)} were decoded from PoolState.`
  );

  evidence.push(
    "Raydium CLMM positions are NFT-backed; pool state alone does not establish individual position ownership."
  );

  evidence.push(
    "Raydium CLMM liquidity lock status remains UNKNOWN until individual position ownership, burn state, or a recognized lock mechanism is independently verified."
  );

  return {
    address: pairAddress.toBase58(),
    dex: "Raydium",
    poolType: "CLMM",
    tokenMint: requested,
    liquidityUsd,
    volume24h,
    positionModel: "NFT_POSITION",
    controller: null,
    positions: [],
    lpBurn: {
      status: "UNKNOWN",
      confidence: "UNKNOWN",
      burnedAmountRaw: null,
      burnedPercent: null,
      originalSupplyRaw: null,
      currentSupplyRaw: null,
      currentSupplyPercentOfOriginal: null,
      transactionSignature: null,
      slot: null,
      timestamp: null,
    },
    lock: unknownLock(),
  };
}

export async function inspectRaydium(
  input: RaydiumInspectionInput
): Promise<RaydiumInspectionResult> {
  const evidence: string[] = [];

  try {
    const tokenMint =
      new PublicKey(input.tokenMint);

    const pairAddress =
      new PublicKey(input.pairAddress);

    const connection =
      new Connection(
        getRpcUrl(),
        "confirmed"
      );

    const accountInfo =
      await connection.getAccountInfo(
        pairAddress
      );

    if (!accountInfo) {
      return {
        verified: false,
        pool: null,
        evidence: [
          "Raydium pair account could not be found on-chain.",
        ],
      };
    }

    const poolType =
      identifyPoolType(accountInfo.owner);

    if (!poolType) {
      return {
        verified: false,
        pool: null,
        evidence: [
          "The supplied pair address is not owned by a supported Raydium pool program.",
        ],
      };
    }

    evidence.push(
      `Raydium pool verified as ${poolType.poolType}.`
    );

    evidence.push(
      "Pool account ownership was verified on-chain."
    );

    if (poolType.poolType === "CPMM") {
      const inspected = await inspectCpmm(
        connection,
        pairAddress,
        tokenMint,
        input.liquidityUsd ?? null,
        input.volume24h ?? null,
        evidence
      );

      return {
        verified: true,
        pool: inspected.pool,
        evidence,
      };
    }

    if (poolType.poolType === "AMM") {
      const inspected = await inspectAmmV4(
        connection,
        pairAddress,
        tokenMint,
        input.liquidityUsd ?? null,
        input.volume24h ?? null,
        evidence
      );

      return {
        verified: true,
        pool: inspected,
        evidence,
      };
    }

    if (poolType.poolType === "CLMM") {
      const inspected = inspectClmm(
        accountInfo.data,
        pairAddress,
        tokenMint,
        input.liquidityUsd ?? null,
        input.volume24h ?? null,
        evidence
      );

      return {
        verified: true,
        pool: inspected,
        evidence,
      };
    }

    evidence.push(
      "Liquidity lock status remains UNKNOWN until LP ownership, burn state, or a recognized lock mechanism is independently verified."
    );

    const pool: LiquidityPool = {
      address:
        pairAddress.toBase58(),

      dex: "Raydium",

      poolType:
        poolType.poolType,

      tokenMint:
        tokenMint.toBase58(),

      liquidityUsd:
        input.liquidityUsd ?? null,

      volume24h:
        input.volume24h ?? null,

      positionModel:
        poolType.positionModel,

      controller: null,

      positions: [],

      lpBurn: {
        status: "UNKNOWN",
        confidence: "UNKNOWN",
        burnedAmountRaw: null,
        burnedPercent: null,
        originalSupplyRaw: null,
        currentSupplyRaw: null,
        currentSupplyPercentOfOriginal: null,
        transactionSignature: null,
        slot: null,
        timestamp: null,
      },
      lock:
        unknownLock(),
    };

    return {
      verified: true,
      pool,
      evidence,
    };
  } catch (error) {
    return {
      verified: false,
      pool: null,
      evidence: [
        error instanceof Error
          ? `Raydium inspection failed: ${error.message}`
          : "Raydium inspection failed.",
      ],
    };
  }
}

export function getRaydiumProgramIds() {
  return {
    ammV4:
      RAYDIUM_AMM_V4_PROGRAM_ID,

    cpmm:
      RAYDIUM_CPMM_PROGRAM_ID,

    clmm:
      RAYDIUM_CLMM_PROGRAM_ID,
  };
}
