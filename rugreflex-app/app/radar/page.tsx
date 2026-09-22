"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RugReflexNav from "@/app/components/RugReflexNav";

type RadarToken = {
  tokenAddress: string;
  name: string;
  symbol: string;
  icon?: string;
  description?: string;
  priceUsd: number;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h24?: number;
  };
  liquidityUsd: number;
  marketCap?: number;
  fdv?: number;
  transactions?: {
    h1?: {
      buys?: number;
      sells?: number;
    };
    h24?: {
      buys?: number;
      sells?: number;
    };
  };
  alphaScore: number;
  alphaSignal: string;
  dex: string;
  pairAddress?: string;
  pairCreatedAt?: number | null;
  radarEligible?: boolean;
  qualifiedAlpha?: boolean;
  alphaStage?: "EARLY_ALPHA" | "EMERGING_ALPHA" | "QUALIFIED_ALPHA" | null;
  qualificationReasons?: string[];
};

type Filter =
  | "ALL"
  | "ACTIVE"
  | "EARLY"
  | "WATCHLIST"
  | "EARLY_ALPHA"
  | "EMERGING_ALPHA"
  | "QUALIFIED_ALPHA";

function formatUsd(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;

  if (value < 1) {
    return `$${value.toLocaleString(undefined, {
      maximumFractionDigits: 8,
    })}`;
  }

  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function shortenAddress(value?: string) {
  if (!value) return "Unknown";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-amber-300";
  return "text-red-300";
}

function changeTone(value?: number) {
  if ((value ?? 0) > 0) return "text-emerald-300";
  if ((value ?? 0) < 0) return "text-red-300";
  return "text-white/35";
}

function signalTone(signal: string) {
  const value = signal.toLowerCase();

  if (value.includes("strong")) {
    return "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-300";
  }

  if (value.includes("interesting")) {
    return "border-amber-400/20 bg-amber-500/[0.08] text-amber-300";
  }

  return "border-white/[0.08] bg-white/[0.03] text-white/45";
}

function filterToken(token: RadarToken, filter: Filter) {
  const score = Number(token.alphaScore || 0);

  switch (filter) {
    case "EARLY":
      return score >= 0 && score <= 39;
    case "WATCHLIST":
      return score >= 40 && score <= 59;
    case "ACTIVE":
      return score >= 60 && score <= 79;
    case "EARLY_ALPHA":
      return token.alphaStage === "EARLY_ALPHA";
    case "EMERGING_ALPHA":
      return token.alphaStage === "EMERGING_ALPHA";
    case "QUALIFIED_ALPHA":
      return token.alphaStage === "QUALIFIED_ALPHA";
    default:
      return true;
  }
}

export default function RadarPage() {
  const [tokens, setTokens] = useState<RadarToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filter, setFilter] = useState<Filter>("QUALIFIED_ALPHA");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRadar = async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);

      try {
        const response = await fetch("/api/radar", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          setErrorStatus(response.status);
          throw new Error(data?.error || "Unable to load Alpha Radar.");
        }

        setErrorStatus(null);

        if (cancelled) return;

        const nextTokens = Array.isArray(data?.candidates)
          ? data.candidates
          : [];

        setTokens(nextTokens);
        setError("");
        setLastUpdated(new Date());

        if (
          selected &&
          !nextTokens.some(
            (token: RadarToken) => token.tokenAddress === selected
          )
        ) {
          setSelected(null);
        }
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load Alpha Radar."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadRadar();

    const interval = window.setInterval(() => {
      loadRadar(true);
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selected]);

  const visibleTokens = useMemo(
    () => tokens.filter((token) => filterToken(token, filter)),
    [tokens, filter]
  );

  const strongestScore =
    tokens.length > 0
      ? Math.max(...tokens.map((token) => token.alphaScore))
      : 0;

  const totalVolume = tokens.reduce(
    (total, token) => total + Number(token.volume?.h24 || 0),
    0
  );

  const totalLiquidity = tokens.reduce(
    (total, token) => total + Number(token.liquidityUsd || 0),
    0
  );

  const selectedToken =
    tokens.find((token) => token.tokenAddress === selected) || null;

  const qualifiedCount = tokens.filter(
    (token) => Number(token.alphaScore || 0) >= 70 && token.qualifiedAlpha === true
  ).length;

  return (
    <main className="min-h-screen bg-[#0b0207] text-white">
      <RugReflexNav />

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-red-900/[0.12] blur-[150px]" />

        <section className="relative mx-auto max-w-[1500px] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/[0.06] px-3 py-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300">
                    Live Solana Intelligence
                  </span>
                </span>

                <span className="rounded-full border border-emerald-400/15 bg-emerald-500/[0.05] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
                  RugReflex Intelligence
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                Alpha Radar
                <span className="block text-white/30">
                  live market intelligence.
                </span>
              </h1>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-white/45 sm:text-base">
                A live Solana market feed filtered through RugReflex
                qualification signals. We surface observable activity for
                investigation — not buy recommendations.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    refreshing
                      ? "animate-pulse bg-amber-400"
                      : "bg-emerald-400"
                  }`}
                />
                <span className="text-xs font-black text-white/75">
                  {refreshing ? "Updating…" : "Market feed live"}
                </span>
              </div>

              <p className="mt-2 text-[9px] font-medium text-white/30">
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}`
                  : "Connecting…"}
              </p>
            </div>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Qualified", qualifiedCount.toString(), "Passing current Radar gate"],
              ["Strongest", loading ? "—" : strongestScore.toString(), "Highest Alpha signal"],
              ["24h Volume", loading ? "—" : formatUsd(totalVolume), "Detected market activity"],
              ["Liquidity", loading ? "—" : formatUsd(totalLiquidity), "Across surfaced tokens"],
            ].map(([label, value, note]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 backdrop-blur-xl"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">
                  {label}
                </p>
                <p className="mt-3 text-2xl font-black">{value}</p>
                <p className="mt-1 text-[10px] text-white/30">{note}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#100308]/90 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="border-b border-white/[0.07] px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-300/80">
                    Live intelligence terminal
                  </p>
                  <p className="mt-1 text-xs text-white/30">
                    Only observable market signals that pass the current
                    RugReflex Radar gate are surfaced.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["ALL", "All"],
                      ["ACTIVE", "Active"],
                      ["EARLY", "Early"],
                      ["WATCHLIST", "Watchlist"],
                      ["EARLY_ALPHA", "Early Alpha"],
                      ["EMERGING_ALPHA", "Emerging Alpha"],
                      ["QUALIFIED_ALPHA", "Qualified Alpha"],
                    ] as [Filter, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      className={`rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] transition ${
                        filter === value
                          ? "bg-white text-[#64122b]"
                          : "border border-white/[0.07] bg-white/[0.02] text-white/35 hover:text-white/65"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading && (
              <div className="divide-y divide-white/[0.05]">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="animate-pulse p-5">
                    <div className="h-5 w-40 rounded bg-white/[0.06]" />
                    <div className="mt-4 h-3 w-full rounded bg-white/[0.04]" />
                  </div>
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="p-8">
                {errorStatus === 401 || errorStatus === 403 ? (
                  <div className="rounded-2xl border border-[#9b2348]/30 bg-[#9b2348]/[0.07] p-8 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[#e05a7d]">
                      Pro Access Required
                    </p>
                    <h3 className="mt-3 text-2xl font-black text-white">
                      Alpha Radar is a Pro intelligence feature.
                    </h3>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/45">
                      Active Pro subscribers get access to Radar candidates,
                      Alpha Scores, investigations, filters, and Qualified Alpha intelligence.
                    </p>
                    <Link
                      href="/pro"
                      className="mt-6 inline-flex rounded-xl bg-[#9b2348] px-6 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#b52b55]"
                    >
                      View Pro Access
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-red-400/15 bg-red-500/[0.05] p-7">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                      Radar unavailable
                    </p>
                    <p className="mt-2 text-sm font-bold text-white/60">
                      {error}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!loading && !error && visibleTokens.length === 0 && (
              <div className="p-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/15 bg-red-500/[0.06] text-xl">
                  ◈
                </div>
                <p className="mt-5 text-sm font-black text-white/70">
                  No tokens match this intelligence view.
                </p>
                <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-white/30">
                  Radar continues monitoring the observable Solana market and
                  will surface candidates when they meet the relevant criteria.
                </p>
              </div>
            )}

            {!loading && !error && visibleTokens.length > 0 && (
              <div className="divide-y divide-white/[0.05]">
                {visibleTokens.map((token) => {
                  const buys = Number(token.transactions?.h1?.buys || 0);
                  const sells = Number(token.transactions?.h1?.sells || 0);
                  const totalTrades = buys + sells;
                  const buyRatio =
                    totalTrades > 0 ? (buys / totalTrades) * 100 : 0;

                  return (
                    <div
                      key={token.tokenAddress}
                      onClick={() =>
                        setSelected(
                          selected === token.tokenAddress
                            ? null
                            : token.tokenAddress
                        )
                      }
                      className="group cursor-pointer px-4 py-5 transition hover:bg-white/[0.025] sm:px-6"
                    >
                      <div className="grid items-center gap-5 xl:grid-cols-[2.2fr_1fr_1fr_1fr_1fr_1fr_110px]">
                        <div className="flex min-w-0 items-center gap-3">
                          {token.icon ? (
                            <img
                              src={token.icon}
                              alt=""
                              className="h-11 w-11 shrink-0 rounded-xl border border-white/10 bg-white/[0.04] object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-black text-white/40">
                              {token.symbol?.slice(0, 1) || "?"}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-black text-white">
                                {token.name || "Unknown"}
                              </p>
                              <span className="text-[9px] font-black text-white/25">
                                ${token.symbol}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center gap-2">
                              <span className="font-mono text-[9px] text-white/20">
                                {shortenAddress(token.tokenAddress)}
                              </span>
                              <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/20">
                                {token.dex}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/20">
                            Price
                          </p>
                          <p className="mt-1 text-sm font-black">
                            {formatUsd(token.priceUsd)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/20">
                            1H
                          </p>
                          <p
                            className={`mt-1 text-sm font-black ${changeTone(
                              token.priceChange?.h1
                            )}`}
                          >
                            {formatPercent(token.priceChange?.h1)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/20">
                            24H
                          </p>
                          <p
                            className={`mt-1 text-sm font-black ${changeTone(
                              token.priceChange?.h24
                            )}`}
                          >
                            {formatPercent(token.priceChange?.h24)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/20">
                            Volume
                          </p>
                          <p className="mt-1 text-sm font-black text-white/70">
                            {formatUsd(token.volume?.h24)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/20">
                            Liquidity
                          </p>
                          <p className="mt-1 text-sm font-black text-white/70">
                            {formatUsd(token.liquidityUsd)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/20">
                            RF Alpha
                          </p>
                          <p
                            className={`mt-1 text-xl font-black ${scoreTone(
                              token.alphaScore
                            )}`}
                          >
                            {token.alphaScore}
                          </p>
                        </div>
                      </div>

                      {selected === token.tokenAddress && (
                        <div
                          onClick={(event) => event.stopPropagation()}
                          className="mt-5 grid gap-4 border-t border-white/[0.06] pt-5 lg:grid-cols-[1.5fr_1fr_1fr]"
                        >
                          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-300/80">
                                  RugReflex intelligence
                                </p>
                                <p className="mt-1 text-lg font-black">
                                  Qualification signal
                                </p>
                              </div>

                              <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.08] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-300">
                                QUALIFIED
                              </span>
                            </div>

                            <p className="mt-4 text-xs leading-6 text-white/40">
                              This token passed the current Radar market-quality
                              gate. Qualification is an observable signal and
                              does not constitute financial advice or a guarantee.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className={`rounded-lg border px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] ${signalTone(token.alphaSignal)}`}>
                                {token.alphaSignal}
                              </span>
                              <span className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/35">
                                {token.dex}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/25">
                              Trading flow
                            </p>

                            <div className="mt-4 grid grid-cols-3 gap-3">
                              <div>
                                <p className="text-[9px] text-white/25">Buys</p>
                                <p className="mt-1 text-sm font-black text-emerald-300">
                                  {formatNumber(buys)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] text-white/25">Sells</p>
                                <p className="mt-1 text-sm font-black text-red-300">
                                  {formatNumber(sells)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] text-white/25">Buy ratio</p>
                                <p className="mt-1 text-sm font-black">
                                  {buyRatio.toFixed(1)}%
                                </p>
                              </div>
                            </div>

                            <div className="mt-5">
                              <div className="flex justify-between text-[8px] font-black uppercase tracking-[0.12em] text-white/20">
                                <span>Market activity</span>
                                <span>{formatNumber(totalTrades)} trades</span>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className="h-full rounded-full bg-emerald-400/70"
                                  style={{
                                    width: `${Math.min(100, buyRatio)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/25">
                              Investigation
                            </p>

                            <div className="mt-4 space-y-2">
                              {(token.qualificationReasons || []).slice(0, 5).map(
                                (reason) => (
                                  <div
                                    key={reason}
                                    className="flex items-start gap-2 text-[10px] leading-5 text-white/45"
                                  >
                                    <span className="mt-1 text-emerald-300">
                                      ✓
                                    </span>
                                    <span>{reason}</span>
                                  </div>
                                )
                              )}
                            </div>

                            <Link
                              href={`/scan?token=${encodeURIComponent(
                                token.tokenAddress
                              )}`}
                              className="mt-5 flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-[#64122b] transition hover:bg-white/90"
                            >
                              Investigate Token →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2 text-[9px] leading-5 text-white/20 sm:flex-row sm:items-center sm:justify-between">
            <p>
              RugReflex Alpha Radar uses observable market data and current
              qualification rules. It does not provide financial advice.
            </p>
            <p className="font-mono">
              {tokens.length} candidates • {qualifiedCount} qualified
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
