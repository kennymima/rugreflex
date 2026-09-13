import { NextRequest, NextResponse } from "next/server";

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
        id: "rugreflex-deployer",
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

type RiskFlag = {
  type: "danger" | "warning" | "positive";
  title: string;
  description: string;
};

type DeployerSource =
  | "mint_authority"
  | "asset_authority"
  | "asset_owner"
  | "creation_transaction"
  | "unknown";

type DeployerConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "UNKNOWN";

type ActivityIntensity =
  | "NONE"
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "VERY_HIGH";

type WalletActivityAssessment =
  | "INACTIVE"
  | "LOW_ACTIVITY"
  | "MODERATE_ACTIVITY"
  | "HIGH_ACTIVITY"
  | "VERY_HIGH_ACTIVITY";

function isWalletAddress(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 44
  );
}

function extractFirstAccount(
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

function getSourceLabel(
  source: DeployerSource
): string {
  switch (source) {
    case "mint_authority":
      return "current mint authority";

    case "asset_authority":
      return "token authority data";

    case "asset_owner":
      return "token ownership data";

    case "creation_transaction":
      return "historical token creation transaction";

    default:
      return "available token data";
  }
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

  const timestampMs = timestamp * 1000;
  const nowMs = Date.now();

  if (timestampMs > nowMs) {
    return null;
  }

  return Math.floor(
    (nowMs - timestampMs) /
      (1000 * 60 * 60 * 24)
  );
}

function calculateWalletAgeDays(
  firstObservedTimestamp: number | null
): number | null {
  return calculateAgeDays(
    firstObservedTimestamp
  );
}

function getActivityIntensity(
  transactionCount: number
): ActivityIntensity {
  if (transactionCount === 0) {
    return "NONE";
  }

  if (transactionCount <= 5) {
    return "LOW";
  }

  if (transactionCount <= 20) {
    return "MODERATE";
  }

  if (transactionCount <= 40) {
    return "HIGH";
  }

  return "VERY_HIGH";
}

function getActivityAssessment(
  intensity: ActivityIntensity
): WalletActivityAssessment {
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

function extractAccountKey(
  account: unknown
): string | null {
  return extractFirstAccount(account);
}

async function findCreationWallet(
  mint: string
): Promise<{
  address: string | null;
  signature: string | null;
  blockTime: number | null;
}> {
  try {
    /*
     * Solana returns signatures newest-first.
     *
     * We paginate backwards so that the oldest available
     * transaction is used instead of assuming the first
     * 1,000 transactions contain the creation event.
     */
    let before: string | undefined;
    let oldestSignature: string | null = null;
    let oldestBlockTime: number | null = null;

    const maxPages = 10;

    for (
      let page = 0;
      page < maxPages;
      page += 1
    ) {
      const params: unknown[] = [
        mint,
        {
          limit: 1000,
        },
      ];

      if (before) {
        (
          params[1] as {
            limit: number;
            before?: string;
          }
        ).before = before;
      }

      const signatures =
        await heliusRequest(
          "getSignaturesForAddress",
          params
        );

      if (
        !Array.isArray(signatures) ||
        signatures.length === 0
      ) {
        break;
      }

      const last =
        signatures[
          signatures.length - 1
        ];

      if (
        last &&
        typeof last.signature === "string"
      ) {
        oldestSignature =
          last.signature;

        oldestBlockTime =
          typeof last.blockTime === "number"
            ? last.blockTime
            : null;

        before =
          last.signature;
      }

      if (signatures.length < 1000) {
        break;
      }
    }

    if (!oldestSignature) {
      return {
        address: null,
        signature: null,
        blockTime: null,
      };
    }

    const transaction =
      await heliusRequest(
        "getTransaction",
        [
          oldestSignature,
          {
            encoding: "jsonParsed",
            maxSupportedTransactionVersion: 0,
          },
        ]
      );

    const accountKeys =
      transaction?.transaction
        ?.message?.accountKeys;

    if (
      !Array.isArray(accountKeys) ||
      accountKeys.length === 0
    ) {
      return {
        address: null,
        signature: oldestSignature,
        blockTime:
          typeof transaction?.blockTime ===
          "number"
            ? transaction.blockTime
            : oldestBlockTime,
      };
    }

    /*
     * The first account in a Solana transaction
     * message is normally the fee payer.
     *
     * For a token's earliest available transaction,
     * this provides a historical creator/deployer signal.
     */
    const feePayer =
      extractFirstAccount(
        accountKeys[0]
      );

    return {
      address: feePayer,
      signature: oldestSignature,
      blockTime:
        typeof transaction?.blockTime ===
        "number"
          ? transaction.blockTime
          : oldestBlockTime,
    };
  } catch (error) {
    console.error(
      "Unable to identify creation wallet:",
      error
    );

    return {
      address: null,
      signature: null,
      blockTime: null,
    };
  }
}

async function analyzeWalletProfile(
  wallet: string
): Promise<{
  firstObservedActivityTimestamp: number | null;
  firstObservedActivitySignature: string | null;
  latestActivityTimestamp: number | null;
  latestActivitySignature: string | null;

  walletAgeDays: number | null;

  recentTransactionCount: number;

  incomingTransactionCount: number;
  outgoingTransactionCount: number;
  neutralTransactionCount: number;

  totalIncomingSol: number;
  totalOutgoingSol: number;

  activityIntensity: ActivityIntensity;
  activityAssessment: WalletActivityAssessment;

  evidence: string[];
}> {
  const evidence: string[] = [];

  let firstObservedActivityTimestamp:
    number | null = null;

  let firstObservedActivitySignature:
    string | null = null;

  let latestActivityTimestamp:
    number | null = null;

  let latestActivitySignature:
    string | null = null;

  let recentTransactionCount = 0;

  let incomingTransactionCount = 0;
  let outgoingTransactionCount = 0;
  let neutralTransactionCount = 0;

  let totalIncomingSol = 0;
  let totalOutgoingSol = 0;

  /*
   * -----------------------------------------------------
   * STEP 1 — RECENT WALLET ACTIVITY
   * -----------------------------------------------------
   */

  const recentSignatures =
    await heliusRequest(
      "getSignaturesForAddress",
      [
        wallet,
        {
          limit: 50,
        },
      ]
    );

  if (
    !Array.isArray(recentSignatures) ||
    recentSignatures.length === 0
  ) {
    evidence.push(
      "No recent transaction signatures were found for the deployer wallet."
    );

    return {
      firstObservedActivityTimestamp: null,
      firstObservedActivitySignature: null,
      latestActivityTimestamp: null,
      latestActivitySignature: null,

      walletAgeDays: null,

      recentTransactionCount: 0,

      incomingTransactionCount: 0,
      outgoingTransactionCount: 0,
      neutralTransactionCount: 0,

      totalIncomingSol: 0,
      totalOutgoingSol: 0,

      activityIntensity: "NONE",
      activityAssessment: "INACTIVE",

      evidence,
    };
  }

  recentTransactionCount =
    recentSignatures.length;

  /*
   * Signatures are returned newest-first.
   */

  const latestSignature =
    recentSignatures[0];

  const oldestRecentSignature =
    recentSignatures[
      recentSignatures.length - 1
    ];

  if (
    latestSignature &&
    typeof latestSignature.signature ===
      "string"
  ) {
    latestActivitySignature =
      latestSignature.signature;
  }

  if (
    latestSignature &&
    typeof latestSignature.blockTime ===
      "number"
  ) {
    latestActivityTimestamp =
      latestSignature.blockTime;
  }

  if (
    oldestRecentSignature &&
    typeof oldestRecentSignature.signature ===
      "string"
  ) {
    firstObservedActivitySignature =
      oldestRecentSignature.signature;
  }

  if (
    oldestRecentSignature &&
    typeof oldestRecentSignature.blockTime ===
      "number"
  ) {
    firstObservedActivityTimestamp =
      oldestRecentSignature.blockTime;
  }

  /*
   * -----------------------------------------------------
   * STEP 2 — EXTEND HISTORY TO FIND FIRST OBSERVED
   * ACTIVITY
   * -----------------------------------------------------
   *
   * The recent 50 transactions are not necessarily the
   * first transactions of the wallet.
   *
   * We therefore paginate backwards, but deliberately
   * cap the investigation to prevent enormous RPC usage.
   */

  try {
    let before:
      string | undefined =
      oldestRecentSignature?.signature;

    const maxHistoryPages = 10;

    for (
      let page = 0;
      page < maxHistoryPages;
      page += 1
    ) {
      if (!before) {
        break;
      }

      const historicalSignatures =
        await heliusRequest(
          "getSignaturesForAddress",
          [
            wallet,
            {
              limit: 1000,
              before,
            },
          ]
        );

      if (
        !Array.isArray(
          historicalSignatures
        ) ||
        historicalSignatures.length === 0
      ) {
        break;
      }

      const oldest =
        historicalSignatures[
          historicalSignatures.length - 1
        ];

      if (
        oldest &&
        typeof oldest.signature ===
          "string"
      ) {
        firstObservedActivitySignature =
          oldest.signature;
      }

      if (
        oldest &&
        typeof oldest.blockTime ===
          "number"
      ) {
        firstObservedActivityTimestamp =
          oldest.blockTime;
      }

      before =
        typeof oldest?.signature ===
        "string"
          ? oldest.signature
          : undefined;

      if (
        historicalSignatures.length <
        1000
      ) {
        break;
      }
    }

    if (
      firstObservedActivityTimestamp !==
      null
    ) {
      evidence.push(
        `The earliest observed wallet activity in the investigated history dates back approximately ${calculateAgeDays(
          firstObservedActivityTimestamp
        ) ?? 0} days.`
      );
    } else {
      evidence.push(
        "Wallet history was found, but a reliable timestamp for the earliest observed activity was unavailable."
      );
    }
  } catch (error) {
    console.error(
      "Unable to retrieve historical wallet activity:",
      error
    );

    evidence.push(
      "Historical wallet activity could not be fully investigated."
    );
  }

  /*
   * -----------------------------------------------------
   * STEP 3 — ANALYZE RECENT TRANSACTION DIRECTION
   * -----------------------------------------------------
   *
   * We inspect the transaction metadata to determine
   * whether the wallet's SOL balance increased or
   * decreased during each transaction.
   *
   * This is an observed SOL-flow signal, not a complete
   * accounting of every SPL-token movement.
   */

  try {
    const transactionSignatures =
      recentSignatures
        .map((item) =>
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
        transactionSignatures.map(
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

      const accountKeys =
        transaction?.transaction
          ?.message?.accountKeys;

      const preBalances =
        transaction?.meta?.preBalances;

      const postBalances =
        transaction?.meta?.postBalances;

      if (
        !Array.isArray(accountKeys) ||
        !Array.isArray(preBalances) ||
        !Array.isArray(postBalances)
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
        const account =
          extractAccountKey(
            accountKeys[index]
          );

        if (account === wallet) {
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

      const deltaLamports =
        postBalances[walletIndex] -
        preBalances[walletIndex];

      const deltaSol =
        deltaLamports /
        1_000_000_000;

      /*
       * Ignore extremely tiny numerical changes.
       * A negative delta includes transaction fees and
       * therefore represents observed outgoing SOL flow.
       */

      if (deltaSol > 0) {
        incomingTransactionCount += 1;
        totalIncomingSol += deltaSol;
      } else if (deltaSol < 0) {
        outgoingTransactionCount += 1;
        totalOutgoingSol +=
          Math.abs(deltaSol);
      } else {
        neutralTransactionCount += 1;
      }
    }

    evidence.push(
      `Recent wallet activity analysis observed ${incomingTransactionCount} incoming SOL-flow transactions and ${outgoingTransactionCount} outgoing SOL-flow transactions in the retrieved transaction window.`
    );
  } catch (error) {
    console.error(
      "Unable to analyze wallet transaction flows:",
      error
    );

    evidence.push(
      "Recent wallet transaction direction could not be fully analyzed."
    );
  }

  /*
   * -----------------------------------------------------
   * STEP 4 — ACTIVITY PROFILE
   * -----------------------------------------------------
   */

  const activityIntensity =
    getActivityIntensity(
      recentTransactionCount
    );

  const activityAssessment =
    getActivityAssessment(
      activityIntensity
    );

  if (
    recentTransactionCount >= 40
  ) {
    evidence.push(
      "The deployer wallet is highly active within the retrieved 50-transaction observation window."
    );
  } else if (
    recentTransactionCount >= 20
  ) {
    evidence.push(
      "The deployer wallet shows moderate-to-high recent blockchain activity."
    );
  } else if (
    recentTransactionCount > 0
  ) {
    evidence.push(
      "The deployer wallet shows recent blockchain activity, but not at a very high frequency."
    );
  }

  if (
    latestActivityTimestamp !== null
  ) {
    const latestAge =
      calculateAgeDays(
        latestActivityTimestamp
      );

    if (latestAge === 0) {
      evidence.push(
        "The deployer wallet has observed activity within the last 24 hours."
      );
    } else if (
      latestAge !== null &&
      latestAge <= 7
    ) {
      evidence.push(
        `The deployer wallet was last observed active approximately ${latestAge} days ago.`
      );
    }
  }

  return {
    firstObservedActivityTimestamp,
    firstObservedActivitySignature,

    latestActivityTimestamp,
    latestActivitySignature,

    walletAgeDays:
      calculateWalletAgeDays(
        firstObservedActivityTimestamp
      ),

    recentTransactionCount,

    incomingTransactionCount,
    outgoingTransactionCount,
    neutralTransactionCount,

    totalIncomingSol,
    totalOutgoingSol,

    activityIntensity,
    activityAssessment,

    evidence,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const mint =
      request.nextUrl.searchParams
        .get("mint")
        ?.trim();

    if (!mint) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Token mint address is required",
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * STEP 1 — GET TOKEN ASSET
     * =====================================================
     */

    const apiKey = process.env.HELIUS_API_KEY;

    if (!apiKey) {
      throw new Error("HELIUS_API_KEY is missing");
    }

    const assetResponse = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "rugreflex-deployer",
          method: "getAsset",
          params: {
            id: mint,
            displayOptions: {
              showFungible: true,
            },
          },
        }),
        cache: "no-store",
      }
    );

    const assetData = await assetResponse.json();

    if (!assetResponse.ok) {
      throw new Error(
        `Helius request failed: ${assetResponse.status}`
      );
    }

    if (assetData.error) {
      throw new Error(
        assetData.error.message ||
          "Helius returned an error"
      );
    }

    const asset = assetData.result;

    if (!asset) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Token asset not found",
        },
        { status: 404 }
      );
    }

    /*
     * =====================================================
     * STEP 2 — COLLECT DEPLOYER SIGNALS
     * =====================================================
     */

    let deployer: string | null = null;

    let source: DeployerSource =
      "unknown";

    let identificationConfidence:
      DeployerConfidence =
      "UNKNOWN";

    const evidence: string[] = [];

    const mintAuthority =
      asset?.token_info?.mint_authority;

    const authorities =
      Array.isArray(asset?.authorities)
        ? asset.authorities
        : [];

    const assetOwner =
      asset?.ownership?.owner;

    let authorityWallet:
      string | null = null;

    let authoritySource:
      DeployerSource = "unknown";

    /*
     * Current mint authority.
     */

    if (
      isWalletAddress(
        mintAuthority
      )
    ) {
      authorityWallet =
        mintAuthority;

      authoritySource =
        "mint_authority";

      evidence.push(
        `Current mint authority identified as ${mintAuthority}.`
      );
    }

    /*
     * Secondary DAS authority signal.
     */

    if (!authorityWallet) {
      for (
        const authority of authorities
      ) {
        const address =
          authority?.address;

        if (
          isWalletAddress(address)
        ) {
          authorityWallet =
            address;

          authoritySource =
            "asset_authority";

          evidence.push(
            `Token authority data identifies ${address} as an associated authority wallet.`
          );

          break;
        }
      }
    }

    /*
     * Ownership is retained only as a lower-confidence
     * fallback.
     */

    if (
      !authorityWallet &&
      isWalletAddress(assetOwner)
    ) {
      authorityWallet =
        assetOwner;

      authoritySource =
        "asset_owner";

      evidence.push(
        `Token ownership data identifies ${assetOwner} as the current asset owner.`
      );
    }

    /*
     * =====================================================
     * STEP 3 — HISTORICAL CREATION INVESTIGATION
     * =====================================================
     */

    const creation =
      await findCreationWallet(mint);

    const creationWallet =
      creation.address;

    const creationSignature =
      creation.signature;

    const creationTimestamp =
      creation.blockTime;

    if (creationWallet) {
      evidence.push(
        `Historical transaction analysis identified ${creationWallet} as the fee payer of the oldest available transaction involving the token mint.`
      );
    } else {
      evidence.push(
        "Historical creation-wallet analysis could not identify a reliable fee payer."
      );
    }

    /*
     * =====================================================
     * STEP 4 — RESOLVE THE PRIMARY DEPLOYER SIGNAL
     * =====================================================
     */

    if (
      authorityWallet &&
      creationWallet &&
      authorityWallet === creationWallet
    ) {
      deployer =
        authorityWallet;

      source =
        authoritySource;

      identificationConfidence =
        "HIGH";

      evidence.push(
        "Current authority data and the historical creation transaction point to the same wallet."
      );
    } else if (
      creationWallet
    ) {
      deployer =
        creationWallet;

      source =
        "creation_transaction";

      identificationConfidence =
        authorityWallet
          ? "MEDIUM"
          : "HIGH";

      if (
        authorityWallet &&
        authorityWallet !== creationWallet
      ) {
        evidence.push(
          `Current authority wallet ${authorityWallet} differs from the historical creator wallet ${creationWallet}.`
        );

        evidence.push(
          "RugReflex treats the historical creator as the primary deployer signal and retains the current authority as a separate control signal."
        );
      }
    } else if (
      authorityWallet
    ) {
      deployer =
        authorityWallet;

      source =
        authoritySource;

      identificationConfidence =
        authoritySource ===
        "asset_owner"
          ? "LOW"
          : "MEDIUM";

      evidence.push(
        "No reliable historical creator wallet was recovered, so the available current authority or ownership signal was used."
      );
    }

    /*
     * =====================================================
     * STEP 5 — BASIC DEPLOYER BALANCE
     * =====================================================
     */

    let solBalance = 0;

    if (deployer) {
      try {
        const balanceResult =
          await heliusRequest(
            "getBalance",
            [deployer]
          );

        solBalance =
          Number(
            balanceResult?.value || 0
          ) / 1_000_000_000;
      } catch (error) {
        console.error(
          "Unable to retrieve deployer balance:",
          error
        );

        evidence.push(
          "Current SOL balance could not be retrieved."
        );
      }
    }

    /*
     * =====================================================
     * STEP 6 — FEATURE 2
     * DEPLOYER WALLET PROFILE
     * =====================================================
     */

    let walletProfile = {
      firstObservedActivityTimestamp:
        null as number | null,

      firstObservedActivitySignature:
        null as string | null,

      latestActivityTimestamp:
        null as number | null,

      latestActivitySignature:
        null as string | null,

      walletAgeDays:
        null as number | null,

      recentTransactionCount: 0,

      incomingTransactionCount: 0,
      outgoingTransactionCount: 0,
      neutralTransactionCount: 0,

      totalIncomingSol: 0,
      totalOutgoingSol: 0,

      activityIntensity:
        "NONE" as ActivityIntensity,

      activityAssessment:
        "INACTIVE" as WalletActivityAssessment,

      evidence: [] as string[],
    };

    if (deployer) {
      try {
        walletProfile =
          await analyzeWalletProfile(
            deployer
          );

        evidence.push(
          ...walletProfile.evidence
        );
      } catch (error) {
        console.error(
          "Unable to build deployer wallet profile:",
          error
        );

        evidence.push(
          "Deployer wallet profile analysis could not be completed."
        );
      }
    }

    /*
     * =====================================================
     * STEP 7 — RISK FLAGS
     * =====================================================
     */

    const flags: RiskFlag[] = [];

    if (!deployer) {
      flags.push({
        type: "warning",
        title:
          "DEPLOYER NOT IDENTIFIED",
        description:
          "RugReflex could not confidently identify a wallet associated with the token's authority, ownership data, or available historical transaction data.",
      });
    } else {
      const sourceLabel =
        getSourceLabel(source);

      flags.push({
        type: "positive",
        title:
          "DEPLOYER WALLET IDENTIFIED",
        description:
          `RugReflex identified ${deployer.slice(
            0,
            8
          )}...${deployer.slice(
            -8
          )} using ${sourceLabel}. Identification confidence: ${identificationConfidence}.`,
      });

      /*
       * Activity assessment.
       */

      if (
        walletProfile.activityIntensity ===
        "VERY_HIGH"
      ) {
        flags.push({
          type: "warning",
          title:
            "VERY ACTIVE DEPLOYER WALLET",
          description:
            "The identified deployer wallet shows very high recent blockchain activity within the retrieved transaction window.",
        });
      } else if (
        walletProfile.activityIntensity ===
        "HIGH"
      ) {
        flags.push({
          type: "warning",
          title:
            "ACTIVE DEPLOYER WALLET",
          description:
            "The identified deployer wallet shows substantial recent blockchain activity.",
        });
      } else if (
        walletProfile.activityIntensity ===
          "MODERATE" ||
        walletProfile.activityIntensity ===
          "LOW"
      ) {
        flags.push({
          type: "positive",
          title:
            "DEPLOYER ACTIVITY DETECTED",
          description:
            "Recent blockchain activity was detected for the identified wallet.",
        });
      } else {
        flags.push({
          type: "warning",
          title:
            "LIMITED DEPLOYER ACTIVITY",
          description:
            "No recent transaction activity was found in the retrieved activity window.",
        });
      }

      /*
       * SOL balance assessment.
       */

      if (
        solBalance < 0.01
      ) {
        flags.push({
          type: "warning",
          title:
            "VERY LOW SOL BALANCE",
          description:
            "The identified wallet currently holds less than 0.01 SOL.",
        });
      } else if (
        solBalance >= 0.1
      ) {
        flags.push({
          type: "positive",
          title:
            "SOL BALANCE DETECTED",
          description:
            `The identified wallet currently holds approximately ${solBalance.toFixed(
              3
            )} SOL.`,
        });
      }
    }

    /*
     * =====================================================
     * STEP 8 — CREATION HISTORY
     * =====================================================
     */

    const creationAgeDays =
      calculateAgeDays(
        creationTimestamp
      );

    if (
      creationTimestamp !== null
    ) {
      if (
        creationAgeDays !== null
      ) {
        evidence.push(
          `The earliest available transaction associated with the token mint was observed approximately ${creationAgeDays} days ago.`
        );
      }

      flags.push({
        type: "positive",
        title:
          "CREATION HISTORY DETECTED",
        description:
          "RugReflex recovered historical transaction data associated with the token mint and identified a creator/deployer signal from that history.",
      });
    } else {
      flags.push({
        type: "warning",
        title:
          "LIMITED CREATION HISTORY",
        description:
          "RugReflex could not recover a reliable timestamp for the earliest available token transaction.",
      });
    }

    /*
     * =====================================================
     * STEP 9 — WALLET AGE INTELLIGENCE
     * =====================================================
     */

    if (
      deployer &&
      walletProfile.walletAgeDays !==
        null
    ) {
      evidence.push(
        `The identified deployer wallet has approximately ${walletProfile.walletAgeDays} days of observed blockchain history in the investigated window.`
      );
    }

    /*
     * =====================================================
     * STEP 10 — RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      deployer: {
        /*
         * Existing Feature 1 fields
         */

        address: deployer,

        source,

        confidence:
          identificationConfidence,

        solBalance,

        recentTransactionCount:
          walletProfile.recentTransactionCount,

        walletAgeDays:
          walletProfile.walletAgeDays,

        creationSignature,

        creationTimestamp,

        authorityWallet,

        authoritySource,

        historicalCreator:
          creationWallet,

        flags,

        evidence,

        /*
         * =================================================
         * FEATURE 2 — DEPLOYER WALLET PROFILE
         * =================================================
         */

        profile: {
          firstObservedActivityTimestamp:
            walletProfile.firstObservedActivityTimestamp,

          firstObservedActivitySignature:
            walletProfile.firstObservedActivitySignature,

          latestActivityTimestamp:
            walletProfile.latestActivityTimestamp,

          latestActivitySignature:
            walletProfile.latestActivitySignature,

          walletAgeDays:
            walletProfile.walletAgeDays,

          recentTransactionCount:
            walletProfile.recentTransactionCount,

          incomingTransactionCount:
            walletProfile.incomingTransactionCount,

          outgoingTransactionCount:
            walletProfile.outgoingTransactionCount,

          neutralTransactionCount:
            walletProfile.neutralTransactionCount,

          totalIncomingSol:
            Number(
              walletProfile.totalIncomingSol.toFixed(
                6
              )
            ),

          totalOutgoingSol:
            Number(
              walletProfile.totalOutgoingSol.toFixed(
                6
              )
            ),

          activityIntensity:
            walletProfile.activityIntensity,

          activityAssessment:
            walletProfile.activityAssessment,

          evidence:
            walletProfile.evidence,
        },
      },

      timestamp:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "RugReflex deployer intelligence error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to analyze deployer",
      },
      { status: 500 }
    );
  }
}