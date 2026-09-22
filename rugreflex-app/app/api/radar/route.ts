import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

type IntelligenceResult = {
  security?: {
    mintAuthorityActive?: boolean;
    freezeAuthorityActive?: boolean;
  };
  liquidity?: {
    riskScore?: number | null;
    riskLevel?: string;
    status?: string;
    totalLiquidityUsd?: number;
    withdrawalExposure?: {
      potentiallyExposedUsd?: number;
      permanentlyUnavailableUsd?: number;
      timeLockedUsd?: number;
      unknownUsd?: number;
    };
  };
  holders?: {
    totalHolders?: number;
    topHolderPercentage?: number;
    top10Percentage?: number;
    concentrationRisk?: string;
  };
  deployer?: {
    confidence?: string;
    activityAssessment?: string;
    walletAgeDays?: number | null;
    recentTransactionCount?: number;
    source?: string;
  };
};

async function fetchJson(
  url: string,
  init?: RequestInit
): Promise<any | null> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
    });

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function calculateMarketScore(token: any): number {
  const h1 = numberOrZero(token.priceChange?.h1);
  const h24 = numberOrZero(token.priceChange?.h24);
  const volume24h = numberOrZero(token.volume24h);
  const liquidity = numberOrZero(token.liquidityUsd);
  const buys = numberOrZero(token.transactions?.h24?.buys);
  const sells = numberOrZero(token.transactions?.h24?.sells);
  const totalTrades = buys + sells;

  const buyRatio =
    totalTrades > 0 ? buys / totalTrades : 0;

  let score = 0;

  // Positive market momentum.
  if (h1 > 0) {
    score += Math.min(15, h1 / 5);
  }

  if (h24 > 0) {
    score += Math.min(15, h24 / 10);
  }

  // Real trading activity and available liquidity.
  score += Math.min(20, volume24h / 10000);
  score += Math.min(15, liquidity / 10000);

  if (totalTrades > 0) {
    score += Math.min(15, buyRatio * 15);
  }

  // Negative momentum must materially reduce
  // market quality rather than being ignored.
  if (h1 < 0) {
    score -= Math.min(15, Math.abs(h1) / 3);
  }

  if (h24 < 0) {
    score -= Math.min(20, Math.abs(h24) / 5);
  }

  // Strong sell pressure is a direct market-quality warning.
  if (totalTrades > 0 && sells > buys) {
    score -= Math.min(
      15,
      ((sells - buys) / totalTrades) * 20
    );
  }

  if (liquidity === 0) {
    score -= 25;
  } else if (liquidity < 5000) {
    score -= 10;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(score))
  );
}

function calculateAlphaScore(
  marketScore: number,
  intelligence: IntelligenceResult
): number {
  const security = intelligence.security || {};
  const liquidity = intelligence.liquidity || {};
  const holders = intelligence.holders || {};
  const deployer = intelligence.deployer || {};

  let score = marketScore * 0.35;

  // Security — 20%
  // Missing security intelligence must not be
  // treated as verified-safe intelligence.
  if (security.mintAuthorityActive === false) {
    score += 10;
  }

  if (security.freezeAuthorityActive === false) {
    score += 10;
  }

  // Liquidity — 20%
  // Missing liquidity intelligence must not
  // be treated as zero risk.
  const liquidityRiskRaw =
    liquidity.riskScore;

  if (Number.isFinite(Number(liquidityRiskRaw))) {
    const liquidityRisk =
      Number(liquidityRiskRaw);

    score += Math.max(
      0,
      Math.min(20, (100 - liquidityRisk) * 0.20)
    );
  }

  // Holders — 15%
  const topHolderRaw =
    holders.topHolderPercentage;

  const top10Raw =
    holders.top10Percentage;

  const topHolder =
    Number(topHolderRaw);

  const top10 =
    Number(top10Raw);

  let holderScore =
    Number.isFinite(topHolder) &&
    Number.isFinite(top10)
      ? 15
      : 0;

  if (topHolder >= 50) {
    holderScore = 0;
  } else if (topHolder >= 25) {
    holderScore = 5;
  } else if (topHolder >= 10) {
    holderScore = 10;
  }

  if (top10 >= 50) {
    holderScore = Math.min(holderScore, 3);
  } else if (top10 >= 30) {
    holderScore = Math.min(holderScore, 7);
  }

  score += holderScore;

  // Deployer — 10%
  if (
    deployer.confidence === "HIGH" ||
    deployer.confidence === "MEDIUM"
  ) {
    score += 5;
  }

  if (
    deployer.activityAssessment ===
      "MODERATE_ACTIVITY" ||
    deployer.activityAssessment ===
      "HIGH_ACTIVITY"
  ) {
    score += 3;
  }

  if (
    numberOrZero(deployer.walletAgeDays) >= 30
  ) {
    score += 2;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(score))
  );
}

function hardQualificationGate(
  candidate: any,
  intelligence: IntelligenceResult
): {
  passed: boolean;
  reasons: string[];
} {
  const security = intelligence.security || {};
  const holders = intelligence.holders || {};
  const liquidity = intelligence.liquidity || {};

  const reasons: string[] = [];

  const marketCap =
    numberOrZero(candidate.marketCap);

  const liquidityUsd =
    numberOrZero(
      liquidity.totalLiquidityUsd ||
      candidate.liquidityUsd
    );

  const volume24h =
    numberOrZero(
      candidate.volume24h ||
      candidate.volume?.h24
    );

  const buys =
    numberOrZero(
      candidate.transactions?.h24?.buys
    );

  const sells =
    numberOrZero(
      candidate.transactions?.h24?.sells
    );

  const totalTrades =
    buys + sells;

  const buyRatio =
    totalTrades > 0
      ? buys / totalTrades
      : 0;

  const h1 =
    numberOrZero(
      candidate.priceChange?.h1
    );

  const h24 =
    numberOrZero(
      candidate.priceChange?.h24
    );

  /*
   * MARKET QUALITY REQUIREMENTS
   *
   * Radar discovery begins at $20K, but
   * Qualified Alpha requires a materially
   * stronger market structure.
   */
  if (marketCap < 100_000) {
    reasons.push(
      "Market cap below $100K Qualified Alpha threshold"
    );
  }

  if (volume24h < 10_000) {
    reasons.push(
      "24h trading volume below $10K"
    );
  }

  if (totalTrades < 50) {
    reasons.push(
      "24h trade count below 50"
    );
  }

  if (
    totalTrades > 0 &&
    (buyRatio < 0.40 || buyRatio > 0.75)
  ) {
    reasons.push(
      "Buy/sell flow outside the balanced 40%–75% range"
    );
  }

  if (h1 < -5) {
    reasons.push(
      "Recent 1h momentum indicates a severe decline"
    );
  }

  if (h24 <= 0) {
    reasons.push(
      "24h momentum is not positive"
    );
  }

  /*
   * LIQUIDITY QUALITY REQUIREMENTS
   */
  if (liquidityUsd < 25_000) {
    reasons.push(
      "Liquidity below $25K Qualified Alpha floor"
    );
  }

  if (
    marketCap > 0 &&
    liquidityUsd / marketCap < 0.02
  ) {
    reasons.push(
      "Liquidity is below 2% of market cap"
    );
  }

  /*
   * CRITICAL SECURITY FAILURES
   */
  if (security.freezeAuthorityActive) {
    reasons.push(
      "Active freeze authority detected"
    );
  }

  if (security.mintAuthorityActive) {
    reasons.push(
      "Active mint authority detected"
    );
  }

  /*
   * CRITICAL HOLDER CONCENTRATION
   */
  if (
    numberOrZero(
      holders.topHolderPercentage
    ) >= 50
  ) {
    reasons.push(
      "Extreme top-holder concentration"
    );
  }

  if (
    numberOrZero(
      holders.top10Percentage
    ) >= 60
  ) {
    reasons.push(
      "Extreme top-10 holder concentration"
    );
  }

  /*
   * LIQUIDITY RISK
   */
  if (
    liquidity.riskLevel === "EXTREME" &&
    liquidityUsd > 0
  ) {
    reasons.push(
      "Extreme liquidity risk"
    );
  }

  /*
   * WITHDRAWAL EXPOSURE
   *
   * Unknown liquidity is not automatically
   * considered rug behaviour, but excessive
   * exposed or unknown liquidity prevents
   * Qualified Alpha status.
   */
  const withdrawal =
    liquidity.withdrawalExposure || {};

  const potentiallyExposedUsd =
    numberOrZero(
      withdrawal.potentiallyExposedUsd
    );

  const unknownUsd =
    numberOrZero(
      withdrawal.unknownUsd
    );

  if (
    liquidityUsd > 0 &&
    potentiallyExposedUsd / liquidityUsd > 0.75
  ) {
    reasons.push(
      "More than 75% of liquidity is potentially exposed to withdrawal"
    );
  }

  if (
    liquidityUsd > 0 &&
    unknownUsd / liquidityUsd > 0.25
  ) {
    reasons.push(
      "More than 25% of liquidity has unknown withdrawal status"
    );
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

async function getIntelligence(
  origin: string,
  tokenAddress: string
): Promise<IntelligenceResult> {
  const [
    securityResponse,
    holdersResponse,
    deployerResponse,
    liquidityResponse,
  ] = await Promise.all([
    fetchJson(
      `${origin}/api/security?address=${encodeURIComponent(
        tokenAddress
      )}`
    ),
    fetchJson(
      `${origin}/api/holders?address=${encodeURIComponent(
        tokenAddress
      )}`
    ),
    fetchJson(
      `${origin}/api/deployer?mint=${encodeURIComponent(
        tokenAddress
      )}`
    ),
    fetchJson(
      `${origin}/api/liquidity?address=${encodeURIComponent(
        tokenAddress
      )}`
    ),
  ]);

  return {
    security:
      securityResponse?.security || undefined,

    holders:
      holdersResponse?.holders ||
      holdersResponse?.data ||
      holdersResponse ||
      undefined,

    deployer:
      deployerResponse?.deployer || undefined,

    liquidity:
      liquidityResponse?.liquidity ||
      liquidityResponse?.intelligence ||
      liquidityResponse?.data ||
      undefined,
  };
}

export async function GET(
  request: Request
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Pro subscription required" },
        { status: 401 }
      );
    }

    const admin = await createAdminClient();

    const { data: adminUser } = await admin
      .from("admin_users")
      .select("role, active")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    const isAdmin =
      adminUser?.role === "admin" &&
      adminUser?.active === true;

    const { data: subscription } = isAdmin
      ? { data: null }
      : await admin
          .from("pro_subscriptions")
          .select("status, expires_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

    const isPro =
      isAdmin ||
      (subscription?.status === "active" &&
        Boolean(subscription.expires_at) &&
        new Date(subscription.expires_at).getTime() > Date.now());

    if (!isPro) {
      return NextResponse.json(
        { error: "Active Pro subscription required" },
        { status: 403 }
      );
    }


    const origin =
      new URL(request.url).origin;

    const profilesResponse =
      await fetch(
        "https://api.dexscreener.com/token-profiles/latest/v1",
        {
          cache: "no-store",
        }
      );

    if (!profilesResponse.ok) {
      return NextResponse.json(
        {
          error:
            `DexScreener request failed: ${profilesResponse.status}`,
        },
        { status: 502 }
      );
    }

    const profiles =
      await profilesResponse.json();

    const solanaProfiles =
      Array.isArray(profiles)
        ? profiles
            .filter(
              (profile: any) =>
                profile?.chainId ===
                "solana" &&
                profile?.tokenAddress
            )
            .slice(0, 20)
        : [];

    const candidates =
      await Promise.all(
        solanaProfiles.map(
          async (profile: any) => {
            const tokenAddress =
              profile.tokenAddress;

            const pairsResponse =
              await fetch(
                `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
                {
                  cache: "no-store",
                }
              );

            if (!pairsResponse.ok) {
              return null;
            }

            const pairsData =
              await pairsResponse.json();

            const pairs =
              Array.isArray(
                pairsData?.pairs
              )
                ? pairsData.pairs
                    .filter(
                      (pair: any) =>
                        pair?.chainId ===
                        "solana"
                    )
                    .sort(
                      (
                        a: any,
                        b: any
                      ) =>
                        numberOrZero(
                          b?.liquidity?.usd
                        ) -
                        numberOrZero(
                          a?.liquidity?.usd
                        )
                    )
                : [];

            const pair = pairs[0];

            if (!pair) return null;

            const buys =
              numberOrZero(
                pair.txns?.h24?.buys ??
                pair.transactions?.h24?.buys
              );

            const sells =
              numberOrZero(
                pair.txns?.h24?.sells ??
                pair.transactions?.h24?.sells
              );

            const totalTrades =
              buys + sells;

            const volume24h =
              numberOrZero(
                pair.volume?.h24
              );

            const liquidityUsd =
              numberOrZero(
                pair.liquidity?.usd
              );

            const buyRatio =
              totalTrades > 0
                ? buys / totalTrades
                : 0;

            const activeTrading =
              volume24h >= 10000 &&
              totalTrades >= 50;

            const balancedFlow =
              buyRatio >= 0.40 &&
              buyRatio <= 0.75;

            const recentMomentum =
              numberOrZero(
                pair.priceChange?.h1
              );

            const dailyMomentum =
              numberOrZero(
                pair.priceChange?.h24
              );

            const healthyMomentum =
              recentMomentum >= -5 &&
              dailyMomentum > 0;

            const marketScore =
              calculateMarketScore({
                ...pair,
                liquidityUsd,
                volume24h,
              });

            return {
              tokenAddress,
              description:
                profile.description ||
                null,
              icon:
                profile.icon ||
                null,
              url:
                profile.url ||
                null,

              name:
                pair.baseToken?.name ||
                "Unknown",

              symbol:
                pair.baseToken?.symbol ||
                "UNKNOWN",

              priceUsd:
                numberOrZero(
                  pair.priceUsd
                ),

              priceChange:
                pair.priceChange ||
                {},

              volume:
                pair.volume ||
                {},

              liquidityUsd,
              marketCap:
                numberOrZero(
                  pair.marketCap
                ),

              fdv:
                numberOrZero(
                  pair.fdv
                ),

              pairCreatedAt:
                pair.pairCreatedAt ||
                null,

              transactions:
                pair.txns ||
                pair.transactions ||
                {},

              dex:
                pair.dexId ||
                null,

              pairAddress:
                pair.pairAddress ||
                null,

              boosts:
                pair.boosts ||
                null,

              marketScore,

              marketChecks: {
                tradingActivity:
                  activeTrading,
                balancedBuySellFlow:
                  balancedFlow,
                healthyMomentum,
              },
            };
          }
        )
      );

    const MIN_RADAR_MARKET_CAP = 20_000;

    const validCandidates =
      candidates.filter(
        (candidate) =>
          candidate &&
          numberOrZero(candidate.marketCap) >=
            MIN_RADAR_MARKET_CAP
      ) as any[];

    /*
     * Full intelligence is expensive.
     * Enrich the strongest market candidates,
     * while Radar can still display the broader
     * market discovery set.
     */
    const enrichmentCandidates =
      [...validCandidates]
        .sort(
          (a, b) =>
            b.marketScore -
            a.marketScore
        )
        .slice(0, 8);

    const enriched =
      await Promise.all(
        enrichmentCandidates.map(
          async (candidate) => {
            const intelligence =
              await getIntelligence(
                origin,
                candidate.tokenAddress
              );

            const alphaScore =
              calculateAlphaScore(
                candidate.marketScore,
                intelligence
              );

            const gate =
              hardQualificationGate(
                candidate,
                intelligence
              );

            const qualifiedAlpha =
              alphaScore >= 70 &&
              gate.passed;

            const alphaStage =
              qualifiedAlpha &&
              numberOrZero(candidate.marketCap) >=
                100_000
                ? "QUALIFIED_ALPHA"
                : gate.passed &&
                    numberOrZero(candidate.marketCap) >=
                      50_000
                  ? "EMERGING_ALPHA"
                  : gate.passed &&
                      numberOrZero(candidate.marketCap) >=
                        35_000
                    ? "EARLY_ALPHA"
                    : null;

            const qualificationReasons =
              [
                `Alpha Score: ${alphaScore}%`,
                alphaScore >= 70
                  ? "Minimum Alpha Score threshold met"
                  : "Alpha Score below 70% threshold",
                gate.passed
                  ? "Hard Qualification Gate passed"
                  : "Hard Qualification Gate failed",
                ...gate.reasons,
              ];

            return {
              ...candidate,

              alphaScore,

              qualifiedAlpha,

              alphaStage,

              qualificationChecks: {
                alphaScoreThreshold:
                  alphaScore >= 70,
                hardQualificationGate:
                  gate.passed,
                tradingActivity:
                  candidate.marketChecks
                    .tradingActivity,
                balancedBuySellFlow:
                  candidate.marketChecks
                    .balancedBuySellFlow,
                healthyMomentum:
                  candidate.marketChecks
                    .healthyMomentum,
              },

              qualificationReasons,

              alphaSignal:
                qualifiedAlpha
                  ? "QUALIFIED ALPHA"
                  : alphaScore >= 70
                    ? "HIGH SIGNAL — GATE FAILED"
                    : alphaScore >= 60
                      ? "INTERESTING"
                      : alphaScore >= 40
                        ? "WATCH"
                        : "LOW SIGNAL",

              intelligenceSummary: {
                security:
                  intelligence.security ||
                  null,
                liquidity:
                  intelligence.liquidity ||
                  null,
                holders:
                  intelligence.holders ||
                  null,
                deployer:
                  intelligence.deployer ||
                  null,
              },
            };
          }
        )
      );

    const enrichedMap =
      new Map(
        enriched.map(
          (token) => [
            token.tokenAddress,
            token,
          ]
        )
      );

    const scored =
      validCandidates.map(
        (candidate) =>
          enrichedMap.get(
            candidate.tokenAddress
          ) || {
            ...candidate,

            alphaScore: null,

            qualifiedAlpha: false,

            alphaStage: null,

            qualificationChecks: {
              alphaScoreThreshold:
                candidate.marketScore >= 70,
              hardQualificationGate:
                false,
            },

            qualificationReasons: [
              "Full intelligence evaluation not performed",
            ],

            alphaSignal:
              candidate.marketScore >= 60
                ? "INTERESTING"
                : candidate.marketScore >= 40
                  ? "WATCH"
                  : "LOW SIGNAL",
          }
      );

    scored.sort(
      (a, b) =>
        b.alphaScore -
        a.alphaScore
    );

    return NextResponse.json({
      candidates: scored,
      qualifiedAlphaCount:
        scored.filter(
          (token) =>
            token.qualifiedAlpha === true
        ).length,
      qualifiedAlphaAccess:
        "PRO_ONLY",
    });
  } catch (error) {
    console.error(
      "RugReflex Radar error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Radar discovery failed.",
      },
      { status: 500 }
    );
  }
}
