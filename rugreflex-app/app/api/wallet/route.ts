import { NextRequest, NextResponse } from "next/server";

type ActivityIntensity =
  | "NONE"
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "VERY_HIGH";

type ActivityAssessment =
  | "INACTIVE"
  | "LOW_ACTIVITY"
  | "MODERATE_ACTIVITY"
  | "HIGH_ACTIVITY"
  | "VERY_HIGH_ACTIVITY";

function getApiKey(): string {
  const key = process.env.HELIUS_API_KEY;

  if (!key) {
    throw new Error("HELIUS_API_KEY is missing");
  }

  return key;
}

async function heliusRequest(
  method: string,
  params: unknown
) {
  const response = await fetch(
    `https://mainnet.helius-rpc.com/?api-key=${getApiKey()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "rugreflex-wallet",
        method,
        params,
      }),
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(
      data?.error?.message ||
        `Helius request failed: ${response.status}`
    );
  }

  return data.result;
}

function isWalletAddress(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 44
  );
}

function extractAccount(
  account: unknown
): string | null {
  if (typeof account === "string") {
    return isWalletAddress(account)
      ? account
      : null;
  }

  if (
    account &&
    typeof account === "object" &&
    "pubkey" in account
  ) {
    const pubkey = (
      account as {
        pubkey?: unknown;
      }
    ).pubkey;

    return isWalletAddress(pubkey)
      ? pubkey
      : null;
  }

  return null;
}

function calculateAgeDays(
  timestamp: number | null
): number | null {
  if (
    timestamp === null ||
    !Number.isFinite(timestamp)
  ) {
    return null;
  }

  const timestampMs =
    timestamp * 1000;

  if (timestampMs > Date.now()) {
    return null;
  }

  return Math.floor(
    (Date.now() - timestampMs) /
      (1000 * 60 * 60 * 24)
  );
}

function getActivityIntensity(
  count: number
): ActivityIntensity {
  if (count === 0) {
    return "NONE";
  }

  if (count <= 5) {
    return "LOW";
  }

  if (count <= 20) {
    return "MODERATE";
  }

  if (count <= 40) {
    return "HIGH";
  }

  return "VERY_HIGH";
}

function getActivityAssessment(
  intensity: ActivityIntensity
): ActivityAssessment {
  switch (intensity) {
    case "NONE":
      return "INACTIVE";
    case "LOW":
      return "LOW_ACTIVITY";
    case "MODERATE":
      return "MODERATE_ACTIVITY";
    case "HIGH":
      return "HIGH_ACTIVITY";
    case "VERY_HIGH":
      return "VERY_HIGH_ACTIVITY";
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    const address =
      request.nextUrl.searchParams
        .get("address")
        ?.trim();

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Wallet address is required",
        },
        { status: 400 }
      );
    }

    if (!isWalletAddress(address)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid wallet address",
        },
        { status: 400 }
      );
    }

    const evidence: string[] = [];

    const balanceResult =
      await heliusRequest(
        "getBalance",
        [address]
      );

    const solBalance =
      Number(
        balanceResult?.value ?? 0
      ) / 1_000_000_000;

    const recentSignatures =
      await heliusRequest(
        "getSignaturesForAddress",
        [
          address,
          {
            limit: 50,
          },
        ]
      );

    if (
      !Array.isArray(
        recentSignatures
      ) ||
      recentSignatures.length === 0
    ) {
      return NextResponse.json({
        success: true,
        address,
        solBalance,
        recentTransactionCount: 0,
        firstObservedActivityTimestamp:
          null,
        latestActivityTimestamp: null,
        walletAgeDays: null,
        incomingTransactionCount: 0,
        outgoingTransactionCount: 0,
        neutralTransactionCount: 0,
        totalIncomingSol: 0,
        totalOutgoingSol: 0,
        activityIntensity: "NONE",
        activityAssessment: "INACTIVE",
        evidence: [
          "No recent transaction signatures were found for this wallet.",
          "Current SOL balance was retrieved from the wallet account.",
        ],
        limitations: [
          "No recent transaction activity was available for behavioral analysis.",
          "Absence of observed recent activity does not prove that the wallet has never been active.",
        ],
        confidence: "LOW",
        timestamp:
          new Date().toISOString(),
      });
    }

    const latest =
      recentSignatures[0];

    const oldestRecent =
      recentSignatures[
        recentSignatures.length - 1
      ];

    const latestTimestamp =
      typeof latest?.blockTime ===
      "number"
        ? latest.blockTime
        : null;

    let firstObservedTimestamp =
      typeof oldestRecent?.blockTime ===
      "number"
        ? oldestRecent.blockTime
        : null;

    /*
     * Extend backward through a bounded
     * number of pages to obtain an
     * earlier observed activity point.
     */
    try {
      let before:
        | string
        | undefined =
        typeof oldestRecent?.signature ===
        "string"
          ? oldestRecent.signature
          : undefined;

      for (
        let page = 0;
        page < 10;
        page += 1
      ) {
        if (!before) {
          break;
        }

        const historical =
          await heliusRequest(
            "getSignaturesForAddress",
            [
              address,
              {
                limit: 1000,
                before,
              },
            ]
          );

        if (
          !Array.isArray(
            historical
          ) ||
          historical.length === 0
        ) {
          break;
        }

        const oldest =
          historical[
            historical.length - 1
          ];

        if (
          typeof oldest?.blockTime ===
          "number"
        ) {
          firstObservedTimestamp =
            oldest.blockTime;
        }

        before =
          typeof oldest?.signature ===
          "string"
            ? oldest.signature
            : undefined;

        if (
          historical.length < 1000
        ) {
          break;
        }
      }
    } catch {
      evidence.push(
        "Historical wallet activity could not be fully investigated."
      );
    }

    let incomingTransactionCount = 0;
    let outgoingTransactionCount = 0;
    let neutralTransactionCount = 0;

    let totalIncomingSol = 0;
    let totalOutgoingSol = 0;

    const observedPrograms = new Set<string>();
    const fundingSources = new Map<string, number>();
    let tokenCreationTransactionCount = 0;

    const signatures =
      recentSignatures
        .map((item: any) =>
          typeof item?.signature ===
          "string"
            ? item.signature
            : null
        )
        .filter(
          (
            signature
          ): signature is string =>
            signature !== null
        );

    const transactions =
      await Promise.all(
        signatures.map(
          async (signature) => {
            try {
              return await heliusRequest(
                "getTransaction",
                [
                  signature,
                  {
                    encoding:
                      "jsonParsed",
                    maxSupportedTransactionVersion: 0,
                  },
                ]
              );
            } catch {
              return null;
            }
          }
        )
      );

    for (const transaction of transactions) {
      if (!transaction) {
        continue;
      }

      const instructions =
        transaction?.transaction?.message?.instructions;

      if (Array.isArray(instructions)) {
        for (const instruction of instructions) {
          if (
            instruction &&
            typeof instruction.program === "string"
          ) {
            observedPrograms.add(
              instruction.program
            );
          }

          const parsedType =
            instruction?.parsed?.type;

          if (
            parsedType === "initializeMint" ||
            parsedType === "initializeMint2"
          ) {
            tokenCreationTransactionCount += 1;
          }
        }
      }

      const accountKeys =
        transaction?.transaction
          ?.message?.accountKeys;

      const preBalances =
        transaction?.meta?.preBalances;

      const postBalances =
        transaction?.meta?.postBalances;

      if (
        !Array.isArray(
          accountKeys
        ) ||
        !Array.isArray(
          preBalances
        ) ||
        !Array.isArray(
          postBalances
        )
      ) {
        neutralTransactionCount += 1;
        continue;
      }

      let walletIndex = -1;

      for (
        let index = 0;
        index < accountKeys.length;
        index += 1
      ) {
        if (
          extractAccount(
            accountKeys[index]
          ) === address
        ) {
          walletIndex = index;
          break;
        }
      }

      if (
        walletIndex < 0 ||
        typeof preBalances[
          walletIndex
        ] !== "number" ||
        typeof postBalances[
          walletIndex
        ] !== "number"
      ) {
        neutralTransactionCount += 1;
        continue;
      }

      const deltaSol =
        (postBalances[walletIndex] -
          preBalances[walletIndex]) /
        1_000_000_000;

      if (deltaSol > 0) {
        incomingTransactionCount += 1;
        totalIncomingSol +=
          deltaSol;

        for (
          let index = 0;
          index < accountKeys.length;
          index += 1
        ) {
          const account =
            extractAccount(
              accountKeys[index]
            );

          if (
            !account ||
            account === address ||
            typeof preBalances[index] !== "number" ||
            typeof postBalances[index] !== "number"
          ) {
            continue;
          }

          const counterpartyDelta =
            postBalances[index] -
            preBalances[index];

          if (counterpartyDelta < 0) {
            fundingSources.set(
              account,
              (fundingSources.get(account) ?? 0) + 1
            );
          }
        }
      } else if (deltaSol < 0) {
        outgoingTransactionCount += 1;
        totalOutgoingSol +=
          Math.abs(deltaSol);
      } else {
        neutralTransactionCount += 1;
      }
    }

    const rankedFundingSources =
      Array.from(
        fundingSources.entries()
      )
        .sort(
          (a, b) => b[1] - a[1]
        )
        .slice(0, 10)
        .map(
          ([address, count]) => ({
            address,
            observedTransactionCount:
              count,
          })
        );

    const primaryObservedFundingSource =
      rankedFundingSources.length > 0
        ? rankedFundingSources[0].address
        : null;

    const recentTransactionCount =
      recentSignatures.length;

    const activityIntensity =
      getActivityIntensity(
        recentTransactionCount
      );

    const activityAssessment =
      getActivityAssessment(
        activityIntensity
      );

    evidence.push(
      `The investigated window contains ${recentTransactionCount} recent wallet transactions.`
    );

    evidence.push(
      `Observed SOL flow includes ${incomingTransactionCount} incoming and ${outgoingTransactionCount} outgoing transactions.`
    );

    if (
      firstObservedTimestamp !== null
    ) {
      evidence.push(
        `The earliest observed activity in the investigated history dates back approximately ${calculateAgeDays(
          firstObservedTimestamp
        ) ?? 0} days.`
      );
    }

    if (
      latestTimestamp !== null
    ) {
      const latestAge =
        calculateAgeDays(
          latestTimestamp
        );

      if (
        latestAge === 0
      ) {
        evidence.push(
          "The wallet has observed activity within the last 24 hours."
        );
      } else if (
        latestAge !== null &&
        latestAge <= 7
      ) {
        evidence.push(
          `The wallet was last observed active approximately ${latestAge} days ago.`
        );
      }
    }

    return NextResponse.json({
      success: true,

      address,

      solBalance,

      recentTransactionCount,

      fundingSources:
        rankedFundingSources,

      primaryObservedFundingSource,

      tokenCreationTransactionCount,

      observedProgramCount:
        observedPrograms.size,

      firstObservedActivityTimestamp:
        firstObservedTimestamp !== null
          ? new Date(
              firstObservedTimestamp *
                1000
            ).toISOString()
          : null,

      latestActivityTimestamp:
        latestTimestamp !== null
          ? new Date(
              latestTimestamp * 1000
            ).toISOString()
          : null,

      walletAgeDays:
        calculateAgeDays(
          firstObservedTimestamp
        ),

      incomingTransactionCount,
      outgoingTransactionCount,
      neutralTransactionCount,

      totalIncomingSol:
        Number(
          totalIncomingSol.toFixed(6)
        ),

      totalOutgoingSol:
        Number(
          totalOutgoingSol.toFixed(6)
        ),

      activityIntensity,
      activityAssessment,

      evidence,

      confidence:
        recentTransactionCount >= 20
          ? "MEDIUM"
          : "LOW",

      limitations: [
        "Wallet analysis uses a bounded recent transaction window.",
        "SOL flow represents observed native SOL balance changes and is not a complete SPL-token fund-flow analysis.",
        "Observed activity does not by itself establish malicious behavior or wallet ownership relationships.",
      ],

      timestamp:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "RugReflex wallet intelligence error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to analyze wallet",
      },
      { status: 500 }
    );
  }
}
