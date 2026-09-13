"use client";

import { useState } from "react";
import { calculateRisk } from "./lib/risk";

/* =========================================================
   TYPES
   ========================================================= */

type LiquidityData = {
  status: "AVAILABLE" | "UNKNOWN";
  assessment: string;
  note: string;

  liquidityUsd?: number | null;
  pairCount?: number;
  dex?: string | null;
  pairAddress?: string | null;
  priceUsd?: number | null;
  volume24h?: number;
  marketCap?: number | null;
  fdv?: number | null;
  pairUrl?: string | null;
};

type TokenData = {
  id?: string;

  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
      description?: string;
      image?: string;
    };
  };

  token_info?: {
    symbol?: string;
    supply?: number;
    decimals?: number;

    price_info?: {
      price_per_token?: number;
      currency?: string;
    };
  };
};

type Holder = {
  owner: string;
  amount: number;
  percentage: number | null;
};

type HolderData = {
  success: boolean;
  totalAccounts: number;
  totalHolders: number;
  totalSupply: number;
  decimals?: number;

  topHolderPercentage: number;
  top5Percentage?: number;
  top10Percentage: number;
  top20Percentage?: number;
  top50Percentage?: number;

  concentrationRisk: string;
  holders: Holder[];
};

type SecurityData = {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  mintAuthorityActive: boolean;
  freezeAuthorityActive: boolean;
};

type SecurityResponse = {
  success: boolean;
  address: string;
  security: SecurityData;
};

type RiskLevel = {
  score: number;
  label: string;
  description: string;
};

/* =========================================================
   HELPERS
   ========================================================= */

function formatUsd(value?: number | null) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "Unknown";
  }

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }

  if (value < 1) {
    return `$${value.toLocaleString(undefined, {
      maximumFractionDigits: 8,
    })}`;
  }

  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value?: number | null) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "Unknown";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function shortenAddress(
  value?: string | null,
  start = 6,
  end = 6
) {
  if (!value) return "Unknown";

  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function Home() {
  const [address, setAddress] = useState("");
  const [token, setToken] = useState<TokenData | null>(null);
  const [holderData, setHolderData] =
    useState<HolderData | null>(null);
  const [securityData, setSecurityData] =
    useState<SecurityData | null>(null);
  const [liquidityData, setLiquidityData] =
    useState<LiquidityData | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  /* =======================================================
     SCAN TOKEN
     ======================================================= */

  async function scanToken() {
    const tokenAddress = address.trim();

    if (!tokenAddress) {
      setError("Please enter a Solana token address.");
      return;
    }

    if (
      tokenAddress.length < 32 ||
      tokenAddress.length > 44
    ) {
      setError("Invalid Solana token address.");
      return;
    }

    setLoading(true);
    setError("");
    setToken(null);
    setHolderData(null);
    setSecurityData(null);
    setLiquidityData(null);

    try {
      /* ===================================================
         TOKEN INFORMATION
         =================================================== */

      const tokenResponse = await fetch(
        `/api/token?address=${encodeURIComponent(
          tokenAddress
        )}`
      );

      const tokenResult = await tokenResponse.json();

      console.log("TOKEN API RESULT:", tokenResult);

      if (!tokenResponse.ok || !tokenResult.success) {
        throw new Error(
          tokenResult.error ||
            "Unable to fetch token information."
        );
      }

      setToken(tokenResult.data);

      /* ===================================================
         HOLDER INFORMATION
         =================================================== */

      const holdersResponse = await fetch(
        `/api/holders?address=${encodeURIComponent(
          tokenAddress
        )}`
      );

      const holdersResult =
        await holdersResponse.json();

      console.log(
        "HOLDERS API RESULT:",
        holdersResult
      );

      if (
        holdersResponse.ok &&
        holdersResult.success
      ) {
        setHolderData(holdersResult);
      }

      /* ===================================================
         TOKEN SECURITY
         =================================================== */

      const securityResponse = await fetch(
        `/api/security?address=${encodeURIComponent(
          tokenAddress
        )}`
      );

      const securityResult: SecurityResponse =
        await securityResponse.json();

      console.log(
        "SECURITY API RESULT:",
        securityResult
      );

      if (
        securityResponse.ok &&
        securityResult.success
      ) {
        setSecurityData(
          securityResult.security
        );
      }

      /* ===================================================
         LIQUIDITY INFORMATION
         =================================================== */

      const liquidityResponse = await fetch(
        `/api/liquidity?address=${encodeURIComponent(
          tokenAddress
        )}`
      );

      const liquidityResult =
        await liquidityResponse.json();

      console.log(
        "LIQUIDITY API RESULT:",
        liquidityResult
      );

      if (
        liquidityResponse.ok &&
        liquidityResult.success &&
        liquidityResult.liquidity
      ) {
        setLiquidityData(
          liquidityResult.liquidity
        );
      }
    } catch (err) {
      console.error("SCAN ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while scanning."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     CLEAR
     ======================================================= */

  function clearScan() {
    setAddress("");
    setToken(null);
    setHolderData(null);
    setSecurityData(null);
    setLiquidityData(null);
    setError("");
    setCopied(false);
  }

  /* =======================================================
     COPY ADDRESS
     ======================================================= */

  async function copyAddress() {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

  /* =======================================================
     RISK SCORE
     ======================================================= */

  function calculateRiskScore(): RiskLevel {
    if (!holderData) {
      return {
        score: 0,
        label: "NOT ANALYZED",
        description:
          "Risk analysis will appear after holder data is retrieved.",
      };
    }

    const result = calculateRisk({
      topHolderPercentage:
        holderData.topHolderPercentage || 0,

      top10Percentage:
        holderData.top10Percentage || 0,

      totalHolders:
        holderData.totalHolders || 0,

      mintAuthorityActive:
        securityData?.mintAuthorityActive || false,

      freezeAuthorityActive:
        securityData?.freezeAuthorityActive || false,

      liquidityUsd:
        liquidityData?.liquidityUsd ?? null,
    });

    return result.risk;
  }

  const risk = calculateRiskScore();

  const riskAnalysis = holderData
    ? calculateRisk({
        topHolderPercentage:
          holderData.topHolderPercentage || 0,

        top10Percentage:
          holderData.top10Percentage || 0,

        totalHolders:
          holderData.totalHolders || 0,

        mintAuthorityActive:
          securityData?.mintAuthorityActive || false,

        freezeAuthorityActive:
          securityData?.freezeAuthorityActive || false,

        liquidityUsd:
          liquidityData?.liquidityUsd ?? null,
      })
    : null;

  /* =======================================================
     TOKEN DISPLAY VALUES
     ======================================================= */

  const tokenName =
    token?.content?.metadata?.name ||
    "Unknown Token";

  const tokenSymbol =
    token?.content?.metadata?.symbol ||
    token?.token_info?.symbol ||
    "UNKNOWN";

  const tokenImage =
    token?.content?.metadata?.image;

  const price =
    token?.token_info?.price_info
      ?.price_per_token;

  const currency =
    token?.token_info?.price_info?.currency ||
    "USDC";

  const marketCap =
    liquidityData?.marketCap ?? null;

  const fdv =
    liquidityData?.fdv ?? null;

  const hasSecurityWarning =
    securityData?.mintAuthorityActive ||
    securityData?.freezeAuthorityActive;

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <main className="min-h-screen bg-[#100308] text-white">

      {/* ===================================================
          BACKGROUND
          =================================================== */}

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">

        <div className="absolute left-1/2 top-[-350px] h-[750px] w-[1100px] -translate-x-1/2 rounded-full bg-[#8f1738]/20 blur-[120px]" />

        <div className="absolute bottom-[-300px] left-[-250px] h-[650px] w-[650px] rounded-full bg-[#5b1026]/20 blur-[120px]" />

        <div className="absolute right-[-250px] top-[35%] h-[550px] w-[550px] rounded-full bg-[#9f2348]/10 blur-[120px]" />

      </div>

      {/* ===================================================
          NAVBAR
          =================================================== */}

      <nav className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#100308]/80 backdrop-blur-2xl">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-[#64122b] shadow-lg shadow-black/20">
              R
            </div>

            <div>

              <p className="text-sm font-black tracking-[0.08em]">
                RUGREFLEX
              </p>

              <p className="hidden text-[9px] uppercase tracking-[0.22em] text-white/35 sm:block">
                Token Risk Intelligence
              </p>

            </div>

          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-1.5">

            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />

            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              Scanner Online
            </span>

          </div>

        </div>

      </nav>

      {/* ===================================================
          PAGE CONTENT
          =================================================== */}

      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16">

        {/* =================================================
            HERO
            ================================================= */}

        <section className="mx-auto max-w-4xl text-center">

          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-4 py-2">

            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Solana Intelligence
            </span>

          </div>

          <h1 className="text-5xl font-black tracking-[-0.055em] sm:text-7xl">

            Know the risk
            <br />

            <span className="text-white/35">
              before you buy.
            </span>

          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">

            RugReflex analyzes observable Solana
            blockchain and market signals to help
            you understand token risk before making
            a decision.

          </p>

        </section>

        {/* =================================================
            SCANNER
            ================================================= */}

        <section className="mx-auto mt-10 max-w-4xl">

          <div className="rounded-[28px] border border-white/[0.08] bg-[#250711]/90 p-2 shadow-2xl shadow-black/40">

            <div className="rounded-[22px] border border-white/[0.06] bg-[#160409] p-5 sm:p-7">

              <div className="mb-5 flex items-start justify-between gap-4">

                <div>

                  <p className="text-sm font-bold">
                    Scan a Solana token
                  </p>

                  <p className="mt-1 text-xs text-white/35">
                    Enter a token mint address to begin analysis.
                  </p>

                </div>

                <div className="hidden rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-white/35 sm:block">
                  Helius Powered
                </div>

              </div>

              <div className="flex flex-col gap-3 sm:flex-row">

                <input
                  type="text"
                  value={address}
                  onChange={(e) =>
                    setAddress(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      scanToken();
                    }
                  }}
                  placeholder="Enter Solana token address..."
                  className="h-14 flex-1 rounded-xl border border-white/[0.09] bg-[#0b0205] px-4 font-mono text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25 focus:ring-2 focus:ring-white/[0.04]"
                />

                <button
                  onClick={scanToken}
                  disabled={loading}
                  className="h-14 rounded-xl bg-white px-7 font-black tracking-wide text-[#64122b] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[175px]"
                >

                  {loading ? (
                    <span className="flex items-center justify-center gap-2">

                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#64122b]/20 border-t-[#64122b]" />

                      SCANNING

                    </span>
                  ) : (
                    "SCAN TOKEN →"
                  )}

                </button>

              </div>

              <div className="mt-4 flex items-center justify-between">

                <p className="text-[10px] text-white/20">
                  Press Enter to scan
                </p>

                {address && (
                  <button
                    onClick={clearScan}
                    className="text-[10px] text-white/35 transition hover:text-white"
                  >
                    Clear
                  </button>
                )}

              </div>

              {error && (
                <div className="mt-5 rounded-xl border border-red-400/15 bg-red-500/[0.06] p-4">

                  <p className="text-sm font-semibold text-red-300">
                    Scan failed
                  </p>

                  <p className="mt-1 text-xs text-red-300/60">
                    {error}
                  </p>

                </div>
              )}

            </div>

          </div>

        </section>

        {/* =================================================
            RESULTS
            ================================================= */}

        {token && (
          <section className="mt-12">

            {/* =============================================
                TOKEN OVERVIEW
                ============================================= */}

            <section className="mb-8">

              <div className="rounded-3xl border border-white/[0.08] bg-[#1b050b]/80 p-5 sm:p-7">

                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

                  <div className="flex items-center gap-4">

                    {tokenImage ? (
                      <img
                        src={tokenImage}
                        alt={tokenName}
                        className="h-16 w-16 rounded-2xl border border-white/[0.10] object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-2xl font-black">
                        {tokenSymbol.slice(0, 1)}
                      </div>
                    )}

                    <div>

                      <div className="flex flex-wrap items-center gap-2">

                        <h2 className="text-2xl font-black tracking-tight">
                          {tokenName}
                        </h2>

                        <span className="rounded-md border border-white/[0.08] bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-white/45">
                          ${tokenSymbol}
                        </span>

                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">

                        <span className="text-xs text-white/30">
                          Scan complete
                        </span>

                        <span className="h-1 w-1 rounded-full bg-white/15" />

                        <button
                          onClick={copyAddress}
                          className="font-mono text-[10px] text-white/30 transition hover:text-white"
                        >
                          {copied
                            ? "Copied!"
                            : shortenAddress(
                                address,
                                7,
                                7
                              )}
                        </button>

                      </div>

                    </div>

                  </div>

                  <div className="flex flex-wrap gap-2">

                    <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      ✓ Data Retrieved
                    </span>

                    <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                      Solana
                    </span>

                  </div>

                </div>

                {/* QUICK MARKET SNAPSHOT */}

                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">

                    <p className="text-[10px] uppercase tracking-wider text-white/30">
                      Token Price
                    </p>

                    <p className="mt-2 text-xl font-black">
                      {formatUsd(price)}
                    </p>

                    <p className="mt-1 text-[10px] text-white/20">
                      {currency}
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">

                    <p className="text-[10px] uppercase tracking-wider text-white/30">
                      Market Cap
                    </p>

                    <p className="mt-2 text-xl font-black">
                      {formatUsd(marketCap)}
                    </p>

                    <p className="mt-1 text-[10px] text-white/20">
                      Current market estimate
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">

                    <p className="text-[10px] uppercase tracking-wider text-white/30">
                      Liquidity
                    </p>

                    <p className="mt-2 text-xl font-black">
                      {formatUsd(
                        liquidityData?.liquidityUsd
                      )}
                    </p>

                    <p className="mt-1 text-[10px] text-white/20">
                      Pool liquidity
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">

                    <p className="text-[10px] uppercase tracking-wider text-white/30">
                      Holders
                    </p>

                    <p className="mt-2 text-xl font-black">
                      {holderData
                        ? holderData.totalHolders.toLocaleString()
                        : "Unknown"}
                    </p>

                    <p className="mt-1 text-[10px] text-white/20">
                      Detected holders
                    </p>

                  </div>

                </div>

              </div>

            </section>

            {/* =============================================
                RISK INTELLIGENCE
                ============================================= */}

            {holderData && (
              <section className="mb-8">

                <div className="mb-5">

                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
                    RugReflex Intelligence
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Observed Risk Score
                  </h2>

                </div>

                <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#1b050b]/85">

                  <div className="border-b border-white/[0.07] px-6 py-5">

                    <div className="flex items-center justify-between gap-4">

                      <div>

                        <p className="text-xs font-semibold text-white/55">
                          Risk score
                        </p>

                        <p className="mt-1 text-[11px] text-white/25">
                          Based on observable signals available during this scan.
                        </p>

                      </div>

                      <span className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white/30">
                        MVP Analysis
                      </span>

                    </div>

                  </div>

                  <div className="grid gap-8 p-6 lg:grid-cols-[260px_1fr] lg:p-8">

                    {/* SCORE */}

                    <div className="rounded-2xl border border-white/[0.07] bg-[#110308]/80 p-8 text-center">

                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                        Risk score
                      </p>

                      <div className="mt-3">

                        <span className="text-7xl font-black tracking-[-0.06em]">
                          {risk.score}
                        </span>

                        <span className="ml-1 text-xl text-white/20">
                          /100
                        </span>

                      </div>

                      <div className="mt-5 inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2">

                        <span className="text-[10px] font-black uppercase tracking-wider">
                          {risk.label}
                        </span>

                      </div>

                      <p className="mt-5 text-[11px] leading-5 text-white/25">
                        {risk.description}
                      </p>

                    </div>

                    {/* ASSESSMENT */}

                    <div>

                      <div>

                        <p className="text-sm font-bold">
                          Risk assessment
                        </p>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
                          The checks performed by RugReflex
                          found observable blockchain signals
                          associated with this token. This does
                          not mean the token is safe or guaranteed
                          to perform in any particular way.
                        </p>

                      </div>

                      {/* BAR */}

                      <div className="mt-7">

                        <div className="mb-2 flex justify-between text-[9px] font-bold uppercase tracking-wider text-white/25">

                          <span>Lower risk</span>

                          <span>
                            {risk.score}/100
                          </span>

                          <span>Higher risk</span>

                        </div>

                        <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.06]">

                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              risk.score < 30
                                ? "bg-emerald-400"
                                : risk.score < 60
                                ? "bg-yellow-400"
                                : risk.score < 80
                                ? "bg-orange-400"
                                : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                Math.max(
                                  risk.score,
                                  0
                                ),
                                100
                              )}%`,
                            }}
                          />

                        </div>

                        <div className="mt-2 flex justify-between text-[9px] text-white/15">

                          <span>0</span>
                          <span>20</span>
                          <span>40</span>
                          <span>60</span>
                          <span>80</span>
                          <span>100</span>

                        </div>

                      </div>

                      {/* SCALE */}

                      <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-5">

                        {[
                          {
                            range: "0–20",
                            label: "LOW",
                            min: 0,
                            max: 20,
                          },
                          {
                            range: "21–40",
                            label: "MODERATE",
                            min: 21,
                            max: 40,
                          },
                          {
                            range: "41–60",
                            label: "ELEVATED",
                            min: 41,
                            max: 60,
                          },
                          {
                            range: "61–80",
                            label: "HIGH",
                            min: 61,
                            max: 80,
                          },
                          {
                            range: "81–100",
                            label: "EXTREME",
                            min: 81,
                            max: 100,
                          },
                        ].map((band) => {

                          const active =
                            risk.score >=
                              band.min &&
                            risk.score <=
                              band.max;

                          return (
                            <div
                              key={band.range}
                              className={`rounded-xl border p-3 transition ${
                                active
                                  ? "border-white/20 bg-white/[0.08]"
                                  : "border-white/[0.05] bg-white/[0.02]"
                              }`}
                            >

                              <div className="flex items-center justify-between">

                                <p className="text-[10px] font-bold">
                                  {band.range}
                                </p>

                                {active && (
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-white/60">
                                    Current
                                  </span>
                                )}

                              </div>

                              <p
                                className={`mt-1 text-[9px] font-semibold uppercase tracking-wide ${
                                  active
                                    ? "text-white/75"
                                    : "text-white/25"
                                }`}
                              >
                                {band.label}
                              </p>

                            </div>
                          );
                        })}

                      </div>

                    </div>

                  </div>

                </div>

              </section>
            )}

            {/* =============================================
                RISK SIGNALS
                ============================================= */}

            {riskAnalysis && (
              <section className="mb-8">

                <div className="mb-5 flex items-end justify-between">

                  <div>

                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
                      Intelligence
                    </p>

                    <h2 className="mt-2 text-2xl font-black">
                      Detected Risk Signals
                    </h2>

                  </div>

                  <span className="text-xs text-white/25">
                    {riskAnalysis.flags.length} signals
                  </span>

                </div>

                <div className="grid gap-3">

                  {riskAnalysis.flags.map(
                    (flag, index) => {

                      const isDanger =
                        flag.type === "danger";

                      const isWarning =
                        flag.type === "warning";

                      return (
                        <div
                          key={`${flag.title}-${index}`}
                          className={`rounded-2xl border p-5 ${
                            isDanger
                              ? "border-red-400/15 bg-red-500/[0.045]"
                              : isWarning
                              ? "border-yellow-400/15 bg-yellow-500/[0.035]"
                              : "border-emerald-400/15 bg-emerald-500/[0.035]"
                          }`}
                        >

                          <div className="flex items-start gap-4">

                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${
                                isDanger
                                  ? "border-red-400/15 bg-red-500/[0.07] text-red-300"
                                  : isWarning
                                  ? "border-yellow-400/15 bg-yellow-500/[0.07] text-yellow-300"
                                  : "border-emerald-400/15 bg-emerald-500/[0.07] text-emerald-300"
                              }`}
                            >
                              {isDanger ||
                              isWarning
                                ? "!"
                                : "✓"}
                            </div>

                            <div className="min-w-0">

                              <p className="text-sm font-bold">
                                {flag.title}
                              </p>

                              <p className="mt-1 text-xs leading-5 text-white/35">
                                {flag.description}
                              </p>

                            </div>

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>

              </section>
            )}

            {/* =============================================
                SECURITY
                ============================================= */}

            {securityData && (
              <section className="mb-8">

                <div className="mb-5">

                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
                    Token Security
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Authority Controls
                  </h2>

                </div>

                <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#1b050b]/85">

                  <div className="flex flex-col gap-3 border-b border-white/[0.07] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

                    <div>

                      <p className="text-sm font-bold">
                        Security status
                      </p>

                      <p className="mt-1 text-xs text-white/25">
                        Mint and freeze authority controls detected during this scan.
                      </p>

                    </div>

                    <span
                      className={`w-fit rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${
                        hasSecurityWarning
                          ? "border-red-400/15 bg-red-500/[0.06] text-red-300"
                          : "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300"
                      }`}
                    >
                      {hasSecurityWarning
                        ? "Security Warning"
                        : "Authorities Revoked"}
                    </span>

                  </div>

                  <div className="grid gap-4 p-6 lg:grid-cols-2 lg:p-8">

                    {/* MINT */}

                    <div className="rounded-2xl border border-white/[0.07] bg-[#110308]/80 p-6">

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <p className="text-sm font-bold">
                            Mint Authority
                          </p>

                          <p className="mt-2 text-xs leading-5 text-white/30">
                            Controls whether additional
                            tokens can be minted.
                          </p>

                        </div>

                        <span
                          className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${
                            securityData.mintAuthorityActive
                              ? "border-red-400/15 bg-red-500/[0.07] text-red-300"
                              : "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300"
                          }`}
                        >
                          {securityData.mintAuthorityActive
                            ? "ACTIVE"
                            : "REVOKED"}
                        </span>

                      </div>

                      <div className="mt-5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">

                        <p className="text-[9px] uppercase tracking-wider text-white/20">
                          Authority address
                        </p>

                        <p className="mt-2 break-all font-mono text-xs text-white/40">
                          {securityData.mintAuthority ||
                            "None — authority revoked"}
                        </p>

                      </div>

                    </div>

                    {/* FREEZE */}

                    <div className="rounded-2xl border border-white/[0.07] bg-[#110308]/80 p-6">

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <p className="text-sm font-bold">
                            Freeze Authority
                          </p>

                          <p className="mt-2 text-xs leading-5 text-white/30">
                            Controls whether token accounts
                            can be frozen.
                          </p>

                        </div>

                        <span
                          className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${
                            securityData.freezeAuthorityActive
                              ? "border-red-400/15 bg-red-500/[0.07] text-red-300"
                              : "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300"
                          }`}
                        >
                          {securityData.freezeAuthorityActive
                            ? "ACTIVE"
                            : "REVOKED"}
                        </span>

                      </div>

                      <div className="mt-5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">

                        <p className="text-[9px] uppercase tracking-wider text-white/20">
                          Authority address
                        </p>

                        <p className="mt-2 break-all font-mono text-xs text-white/40">
                          {securityData.freezeAuthority ||
                            "None — authority revoked"}
                        </p>

                      </div>

                    </div>

                  </div>

                  <div className="border-t border-white/[0.07] px-6 py-5">

                    <p className="text-xs text-white/35">

                      {hasSecurityWarning
                        ? "One or more token authorities remain active and should be reviewed."
                        : "No active mint or freeze authority was detected during this scan."}

                    </p>

                  </div>

                </div>

              </section>
            )}

            {/* =============================================
                MARKET INTELLIGENCE
                ============================================= */}

            {liquidityData && (
              <section className="mb-8">

                <div className="mb-5">

                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
                    Market Intelligence
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Liquidity Analysis
                  </h2>

                </div>

                <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#1b050b]/85">

                  <div className="flex flex-col gap-3 border-b border-white/[0.07] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

                    <div>

                      <p className="text-sm font-bold">
                        Liquidity
                      </p>

                      <p className="mt-1 text-xs text-white/25">
                        Largest detected Solana trading pool.
                      </p>

                    </div>

                    <span
                      className={`w-fit rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${
                        liquidityData.status ===
                        "AVAILABLE"
                          ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300"
                          : "border-yellow-400/15 bg-yellow-400/[0.05] text-yellow-300"
                      }`}
                    >
                      {liquidityData.status ===
                      "AVAILABLE"
                        ? "Liquidity Found"
                        : "Liquidity Unknown"}
                    </span>

                  </div>

                  <div className="p-6 lg:p-8">

                    <div
                      className={`rounded-2xl border p-5 ${
                        liquidityData.status ===
                        "AVAILABLE"
                          ? "border-yellow-400/15 bg-yellow-400/[0.035]"
                          : "border-red-400/15 bg-red-500/[0.04]"
                      }`}
                    >

                      <div className="flex items-start gap-4">

                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black ${
                            liquidityData.status ===
                            "AVAILABLE"
                              ? "bg-yellow-400/[0.08] text-yellow-300"
                              : "bg-red-500/[0.08] text-red-300"
                          }`}
                        >
                          {liquidityData.status ===
                          "AVAILABLE"
                            ? "!"
                            : "?"}
                        </div>

                        <div>

                          <p className="text-sm font-bold">
                            {liquidityData.assessment}
                          </p>

                          <p className="mt-2 text-xs leading-5 text-white/35">
                            {liquidityData.note}
                          </p>

                        </div>

                      </div>

                    </div>

                    {/* METRICS */}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                      <div className="rounded-2xl border border-white/[0.07] bg-[#110308]/80 p-5">

                        <p className="text-[10px] uppercase tracking-wider text-white/25">
                          Liquidity
                        </p>

                        <p className="mt-2 text-xl font-black">
                          {formatUsd(
                            liquidityData.liquidityUsd
                          )}
                        </p>

                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-[#110308]/80 p-5">

                        <p className="text-[10px] uppercase tracking-wider text-white/25">
                          24h Volume
                        </p>

                        <p className="mt-2 text-xl font-black">
                          {formatUsd(
                            liquidityData.volume24h
                          )}
                        </p>

                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-[#110308]/80 p-5">

                        <p className="text-[10px] uppercase tracking-wider text-white/25">
                          DEX
                        </p>

                        <p className="mt-2 truncate text-xl font-black">
                          {liquidityData.dex ||
                            "Unknown"}
                        </p>

                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-[#110308]/80 p-5">

                        <p className="text-[10px] uppercase tracking-wider text-white/25">
                          Pairs
                        </p>

                        <p className="mt-2 text-xl font-black">
                          {liquidityData.pairCount ??
                            0}
                        </p>

                      </div>

                    </div>

                    {/* SECONDARY MARKET DATA */}

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                      <div className="rounded-2xl border border-white/[0.07] bg-[#110308]/80 p-5">

                        <p className="text-[10px] uppercase tracking-wider text-white/25">
                          Pool Price
                        </p>

                        <p className="mt-2 text-lg font-black">
                          {formatUsd(
                            liquidityData.priceUsd
                          )}
                        </p>

                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-[#110308]/80 p-5">

                        <p className="text-[10px] uppercase tracking-wider text-white/25">
                          Market Cap
                        </p>

                        <p className="mt-2 text-lg font-black">
                          {formatUsd(
                            liquidityData.marketCap
                          )}
                        </p>

                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-[#110308]/80 p-5">

                        <p className="text-[10px] uppercase tracking-wider text-white/25">
                          FDV
                        </p>

                        <p className="mt-2 text-lg font-black">
                          {formatUsd(
                            liquidityData.fdv
                          )}
                        </p>

                      </div>

                      <div className="rounded-2xl border border-white/[0.07] bg-[#110308]/80 p-5">

                        <p className="text-[10px] uppercase tracking-wider text-white/25">
                          Pair Address
                        </p>

                        <p className="mt-2 truncate font-mono text-xs text-white/35">
                          {shortenAddress(
                            liquidityData.pairAddress,
                            8,
                            8
                          )}
                        </p>

                      </div>

                    </div>

                    {liquidityData.pairUrl && (
                      <div className="mt-5">

                        <a
                          href={
                            liquidityData.pairUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-xs font-semibold text-white/60 transition hover:bg-white/[0.07] hover:text-white"
                        >
                          View Trading Pair →
                        </a>

                      </div>
                    )}

                    <p className="mt-5 text-[10px] leading-5 text-white/20">
                      Liquidity is one component of token
                      risk. Strong liquidity does not eliminate
                      other security, concentration or market
                      risks.
                    </p>

                  </div>

                </div>

              </section>
            )}

            {/* =============================================
                TOKEN INFORMATION
                ============================================= */}

            <section className="mb-8">

              <div className="mb-5">

                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
                  Token
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Token Information
                </h2>

              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-5">

                  <p className="text-[10px] uppercase tracking-wider text-white/25">
                    Token Name
                  </p>

                  <p className="mt-3 truncate text-lg font-black">
                    {tokenName}
                  </p>

                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-5">

                  <p className="text-[10px] uppercase tracking-wider text-white/25">
                    Symbol
                  </p>

                  <p className="mt-3 text-lg font-black">
                    ${tokenSymbol}
                  </p>

                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-5">

                  <p className="text-[10px] uppercase tracking-wider text-white/25">
                    Total Supply
                  </p>

                  <p className="mt-3 text-lg font-black">
                    {token.token_info?.supply
                      ?.toLocaleString() ||
                      "Unknown"}
                  </p>

                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-5">

                  <p className="text-[10px] uppercase tracking-wider text-white/25">
                    Decimals
                  </p>

                  <p className="mt-3 text-lg font-black">
                    {token.token_info?.decimals ??
                      "Unknown"}
                  </p>

                </div>

              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">

                <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-5">

                  <p className="text-[10px] uppercase tracking-wider text-white/25">
                    Current Token Price
                  </p>

                  <p className="mt-2 text-2xl font-black">

                    {price !== undefined
                      ? price.toLocaleString(
                          undefined,
                          {
                            maximumFractionDigits:
                              8,
                          }
                        )
                      : "Unknown"}

                    <span className="ml-2 text-xs font-medium text-white/25">
                      {currency}
                    </span>

                  </p>

                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-5">

                  <p className="text-[10px] uppercase tracking-wider text-white/25">
                    Fully Diluted Valuation
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {formatUsd(fdv)}
                  </p>

                </div>

              </div>

            </section>

            {/* =============================================
                HOLDER ANALYSIS
                ============================================= */}

            {holderData && (
              <section className="mb-8">

                <div className="mb-5">

                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
                    Distribution
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Holder Analysis
                  </h2>

                  <p className="mt-1 text-xs text-white/25">
                    Wallet concentration snapshot.
                  </p>

                </div>

                {/* SUMMARY */}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                  <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-5">

                    <p className="text-[10px] uppercase tracking-wider text-white/25">
                      Accounts Scanned
                    </p>

                    <p className="mt-2 text-2xl font-black">
                      {holderData.totalAccounts.toLocaleString()}
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-5">

                    <p className="text-[10px] uppercase tracking-wider text-white/25">
                      Holders Found
                    </p>

                    <p className="mt-2 text-2xl font-black">
                      {holderData.totalHolders.toLocaleString()}
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-5">

                    <p className="text-[10px] uppercase tracking-wider text-white/25">
                      Top Holder
                    </p>

                    <p className="mt-2 text-2xl font-black">
                      {holderData.topHolderPercentage}%
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-5">

                    <p className="text-[10px] uppercase tracking-wider text-white/25">
                      Top 10 Holders
                    </p>

                    <p className="mt-2 text-2xl font-black">
                      {holderData.top10Percentage}%
                    </p>

                  </div>

                </div>

                {/* CONCENTRATION */}

                <div className="mt-3 grid gap-3 lg:grid-cols-2">

                  <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-6">

                    <div className="flex items-center justify-between">

                      <p className="text-sm font-bold">
                        Largest Holder
                      </p>

                      <span className="text-xl font-black">
                        {holderData.topHolderPercentage}%
                      </span>

                    </div>

                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.05]">

                      <div
                        className="h-full rounded-full bg-white"
                        style={{
                          width: `${Math.min(
                            holderData.topHolderPercentage,
                            100
                          )}%`,
                        }}
                      />

                    </div>

                    <p className="mt-3 text-[11px] leading-5 text-white/25">
                      Supply controlled by the largest
                      detected wallet.
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-[#1b050b]/75 p-6">

                    <div className="flex items-center justify-between">

                      <p className="text-sm font-bold">
                        Top 10 Concentration
                      </p>

                      <span className="text-xl font-black">
                        {holderData.top10Percentage}%
                      </span>

                    </div>

                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.05]">

                      <div
                        className="h-full rounded-full bg-white"
                        style={{
                          width: `${Math.min(
                            holderData.top10Percentage,
                            100
                          )}%`,
                        }}
                      />

                    </div>

                    <p className="mt-3 text-[11px] leading-5 text-white/25">
                      Combined supply controlled by the
                      ten largest detected wallets.
                    </p>

                  </div>

                </div>

                {/* MORE DISTRIBUTION DATA */}

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">

                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">

                    <p className="text-[9px] uppercase tracking-wider text-white/20">
                      Top 5
                    </p>

                    <p className="mt-2 text-lg font-black">
                      {holderData.top5Percentage ??
                        "N/A"}
                      {holderData.top5Percentage !==
                        undefined && "%"}
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">

                    <p className="text-[9px] uppercase tracking-wider text-white/20">
                      Top 10
                    </p>

                    <p className="mt-2 text-lg font-black">
                      {holderData.top10Percentage}%
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">

                    <p className="text-[9px] uppercase tracking-wider text-white/20">
                      Top 20
                    </p>

                    <p className="mt-2 text-lg font-black">
                      {holderData.top20Percentage ??
                        "N/A"}
                      {holderData.top20Percentage !==
                        undefined && "%"}
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">

                    <p className="text-[9px] uppercase tracking-wider text-white/20">
                      Top 50
                    </p>

                    <p className="mt-2 text-lg font-black">
                      {holderData.top50Percentage ??
                        "N/A"}
                      {holderData.top50Percentage !==
                        undefined && "%"}
                    </p>

                  </div>

                </div>

                {/* TOP HOLDERS */}

                <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1b050b]/75">

                  <div className="flex flex-col gap-2 border-b border-white/[0.07] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">

                    <div>

                      <h3 className="font-bold">
                        Top Holders
                      </h3>

                      <p className="mt-1 text-[11px] text-white/25">
                        Largest wallets detected during this scan.
                      </p>

                    </div>

                    <span className="text-[10px] text-white/25">
                      Showing top 20
                    </span>

                  </div>

                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[650px] text-left">

                      <thead className="border-b border-white/[0.07]">

                        <tr className="text-[9px] uppercase tracking-wider text-white/25">

                          <th className="px-5 py-4">
                            Rank
                          </th>

                          <th className="px-5 py-4">
                            Wallet
                          </th>

                          <th className="px-5 py-4 text-right">
                            Amount
                          </th>

                          <th className="px-5 py-4 text-right">
                            Ownership
                          </th>

                        </tr>

                      </thead>

                      <tbody>

                        {holderData.holders
                          .slice(0, 20)
                          .map(
                            (
                              holder,
                              index
                            ) => (

                              <tr
                                key={
                                  holder.owner
                                }
                                className="border-b border-white/[0.04] transition hover:bg-white/[0.025]"
                              >

                                <td className="px-5 py-4">

                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-[10px] font-bold text-white/45">
                                    {index + 1}
                                  </span>

                                </td>

                                <td className="px-5 py-4">

                                  <span className="font-mono text-[10px] text-white/40">

                                    {shortenAddress(
                                      holder.owner,
                                      10,
                                      8
                                    )}

                                  </span>

                                </td>

                                <td className="px-5 py-4 text-right font-mono text-[10px] text-white/50">

                                  {formatNumber(
                                    holder.amount
                                  )}

                                </td>

                                <td className="px-5 py-4 text-right">

                                  {holder.percentage !==
                                  null ? (

                                    <div className="flex items-center justify-end gap-3">

                                      <div className="hidden h-1 w-16 overflow-hidden rounded-full bg-white/[0.05] sm:block">

                                        <div
                                          className="h-full rounded-full bg-white"
                                          style={{
                                            width: `${Math.min(
                                              holder.percentage,
                                              100
                                            )}%`,
                                          }}
                                        />

                                      </div>

                                      <span className="font-mono text-[10px] text-white/50">
                                        {
                                          holder.percentage
                                        }
                                        %
                                      </span>

                                    </div>

                                  ) : (
                                    <span className="text-[10px] text-white/20">
                                      N/A
                                    </span>
                                  )}

                                </td>

                              </tr>

                            )
                          )}

                      </tbody>

                    </table>

                  </div>

                </div>

              </section>
            )}

            {/* =============================================
                COMING SOON
                ============================================= */}

            <section className="mt-14">

              <div className="mb-6">

                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
                  Coming to RugReflex
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  Intelligence Expansion
                </h2>

                <p className="mt-2 max-w-2xl text-xs leading-5 text-white/25">
                  RugReflex is being built into a broader
                  token and wallet intelligence platform.
                </p>

              </div>

              <div className="grid gap-3 md:grid-cols-3">

                {/* DEPLOYER */}

                <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1b050b]/65 p-6">

                  <span className="absolute right-5 top-5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-white/25">
                    Planned
                  </span>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-sm">
                    D
                  </div>

                  <h3 className="mt-5 font-bold">
                    Deployer Intelligence
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-white/25">
                    Analyze deployer wallets, funding paths,
                    wallet history and related token activity.
                  </p>

                </div>

                {/* AI */}

                <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1b050b]/65 p-6">

                  <span className="absolute right-5 top-5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-white/25">
                    Planned
                  </span>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-sm">
                    AI
                  </div>

                  <h3 className="mt-5 font-bold">
                    AI Risk Intelligence
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-white/25">
                    Turn raw blockchain signals into clear,
                    explainable risk intelligence.
                  </p>

                </div>

                {/* WALLET */}

                <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1b050b]/65 p-6">

                  <span className="absolute right-5 top-5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-white/25">
                    Planned
                  </span>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-sm">
                    W
                  </div>

                  <h3 className="mt-5 font-bold">
                    Wallet Intelligence
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-white/25">
                    Monitor suspicious wallets and discover
                    relationships across token ecosystems.
                  </p>

                </div>

              </div>

            </section>

            {/* =============================================
                GROWTH
                ============================================= */}

            <section className="mt-8 grid gap-3 lg:grid-cols-2">

              {/* REFERRAL */}

              <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#2b0813] to-[#160409] p-7">

                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                  RugReflex Growth
                </p>

                <h2 className="mt-3 text-2xl font-black">
                  Referral System
                </h2>

                <p className="mt-3 max-w-lg text-xs leading-6 text-white/30">
                  A future referral system will allow users
                  to invite others and earn rewards within
                  the RugReflex ecosystem.
                </p>

                <div className="mt-6 inline-flex rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/30">
                  Coming Soon
                </div>

              </div>

              {/* PRO */}

              <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#2b0813] to-[#160409] p-7">

                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                  Premium Intelligence
                </p>

                <h2 className="mt-3 text-2xl font-black">
                  RugReflex Pro
                </h2>

                <p className="mt-3 max-w-lg text-xs leading-6 text-white/30">
                  Future premium plans can unlock advanced
                  scans, deeper wallet intelligence, monitoring,
                  reports and professional tools.
                </p>

                <div className="mt-6 inline-flex rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/30">
                  Coming Soon
                </div>

              </div>

            </section>

            {/* =============================================
                DISCLAIMER
                ============================================= */}

            <section className="mt-8 rounded-2xl border border-yellow-400/10 bg-yellow-400/[0.025] p-5">

              <div className="flex items-start gap-3">

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-yellow-400/10 bg-yellow-400/[0.04] text-xs text-yellow-300">
                  !
                </div>

                <div>

                  <p className="text-xs font-bold text-white/60">
                    Important
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-white/25">
                    RugReflex provides observed blockchain
                    and market risk analysis. Scores and signals
                    are not guarantees of safety, future
                    performance or token outcomes. Always
                    conduct your own research.
                  </p>

                </div>

              </div>

            </section>

          </section>
        )}

        {/* =================================================
            EMPTY STATE
            ================================================= */}

        {!token &&
          !loading &&
          !error && (
            <section className="mx-auto mt-16 max-w-4xl">

              <div className="mb-7 text-center">

                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                  How RugReflex Works
                </p>

              </div>

              <div className="grid gap-3 sm:grid-cols-3">

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-[10px] font-bold">
                    01
                  </div>

                  <h3 className="mt-5 font-bold">
                    Enter token
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-white/25">
                    Paste any Solana token mint address
                    into the scanner.
                  </p>

                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-[10px] font-bold">
                    02
                  </div>

                  <h3 className="mt-5 font-bold">
                    Analyze
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-white/25">
                    RugReflex retrieves token, holder,
                    liquidity and security signals.
                  </p>

                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-[10px] font-bold">
                    03
                  </div>

                  <h3 className="mt-5 font-bold">
                    Assess risk
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-white/25">
                    Review observed risk signals before
                    making your own decision.
                  </p>

                </div>

              </div>

            </section>
          )}

      </div>

      {/* ===================================================
          FOOTER
          =================================================== */}

      <footer className="border-t border-white/[0.07]">

        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-6">

          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-[#64122b]">
                R
              </div>

              <div>

                <p className="text-sm font-black tracking-[0.08em]">
                  RUGREFLEX
                </p>

                <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/25">
                  Solana Token Risk Intelligence
                </p>

              </div>

            </div>

            <p className="text-[10px] text-white/20">
              Built for informed decisions.
            </p>

          </div>

          <div className="border-t border-white/[0.05] pt-5">

            <p className="text-[10px] leading-5 text-white/20">
              Observed risk analysis — not financial advice.
              RugReflex does not guarantee token safety,
              performance or outcomes.
            </p>

          </div>

        </div>

      </footer>

    </main>
  );
}