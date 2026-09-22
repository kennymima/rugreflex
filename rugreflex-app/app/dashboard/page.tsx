"use client";

import { useEffect, useMemo, useState } from "react";
import RugReflexNav from "@/app/components/RugReflexNav";

type HistoryRecord = {
  id: string;
  token_mint: string;
  token_name: string | null;
  token_symbol: string | null;
  risk_score: number | null;
  risk_label: string | null;
  market_cap: number | null;
  liquidity_usd: number | null;
  volume_24h: number | null;
  total_holders: number | null;
  scanned_at: string;
};

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }

  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString();
}

function riskClass(score: number | null) {
  if (score === null) {
    return "border-white/10 bg-white/[0.03] text-white/60";
  }

  if (score <= 20) {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
  }

  if (score <= 40) {
    return "border-yellow-400/20 bg-yellow-500/10 text-yellow-300";
  }

  if (score <= 60) {
    return "border-orange-400/20 bg-orange-500/10 text-orange-300";
  }

  return "border-red-400/20 bg-red-500/10 text-red-300";
}

function riskBarClass(level: string) {
  switch (level) {
    case "LOW":
      return "bg-emerald-400";
    case "MODERATE":
      return "bg-yellow-400";
    case "ELEVATED":
      return "bg-orange-400";
    case "HIGH":
      return "bg-red-400";
    case "EXTREME":
      return "bg-red-600";
    default:
      return "bg-white/20";
  }
}

function shortMint(mint: string) {
  if (mint.length <= 18) return mint;
  return `${mint.slice(0, 8)}...${mint.slice(-8)}`;
}

function getRiskLevel(score: number | null) {
  if (score === null) return "UNKNOWN";
  if (score <= 20) return "LOW";
  if (score <= 40) return "MODERATE";
  if (score <= 60) return "ELEVATED";
  if (score <= 80) return "HIGH";
  return "EXTREME";
}

function getRiskDescription(level: string) {
  switch (level) {
    case "LOW":
      return "No significant observed risk signals";
    case "MODERATE":
      return "Some observed risk signals";
    case "ELEVATED":
      return "Meaningful risk signals detected";
    case "HIGH":
      return "Strong risk signals detected";
    case "EXTREME":
      return "Severe risk signals detected";
    default:
      return "Insufficient risk data";
  }
}

export default function DashboardPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/history");

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to load dashboard data."
          );
        }

        setHistory(
          Array.isArray(result.history)
            ? result.history
            : []
        );
      } catch (dashboardError) {
        console.error(
          "Dashboard history load failed:",
          dashboardError
        );

        setError(
          dashboardError instanceof Error
            ? dashboardError.message
            : "Unable to load dashboard data."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const statistics = useMemo(() => {
    const scores = history
      .map((item) => item.risk_score)
      .filter(
        (score): score is number =>
          typeof score === "number" &&
          Number.isFinite(score)
      );

    const averageRisk =
      scores.length > 0
        ? Math.round(
            scores.reduce(
              (total, score) => total + score,
              0
            ) / scores.length
          )
        : null;

    const highestRisk =
      scores.length > 0
        ? Math.max(...scores)
        : null;

    const lowRiskCount = scores.filter(
      (score) => score <= 20
    ).length;

    const moderateRiskCount = scores.filter(
      (score) => score > 20 && score <= 40
    ).length;

    const elevatedRiskCount = scores.filter(
      (score) => score > 40 && score <= 60
    ).length;

    const highRiskCount = scores.filter(
      (score) => score > 60 && score <= 80
    ).length;

    const extremeRiskCount = scores.filter(
      (score) => score > 80
    ).length;

    const elevatedOrHigher =
      elevatedRiskCount +
      highRiskCount +
      extremeRiskCount;

    return {
      totalScans: history.length,
      scoredScans: scores.length,
      averageRisk,
      highestRisk,
      lowRiskCount,
      moderateRiskCount,
      elevatedRiskCount,
      highRiskCount,
      extremeRiskCount,
      elevatedOrHigher,
    };
  }, [history]);

  const riskDistribution = useMemo(() => {
    const total = statistics.scoredScans || 0;

    return [
      {
        level: "LOW",
        range: "0–20",
        count: statistics.lowRiskCount,
        percentage:
          total > 0
            ? Math.round(
                (statistics.lowRiskCount / total) * 100
              )
            : 0,
      },
      {
        level: "MODERATE",
        range: "21–40",
        count: statistics.moderateRiskCount,
        percentage:
          total > 0
            ? Math.round(
                (statistics.moderateRiskCount / total) * 100
              )
            : 0,
      },
      {
        level: "ELEVATED",
        range: "41–60",
        count: statistics.elevatedRiskCount,
        percentage:
          total > 0
            ? Math.round(
                (statistics.elevatedRiskCount / total) * 100
              )
            : 0,
      },
      {
        level: "HIGH",
        range: "61–80",
        count: statistics.highRiskCount,
        percentage:
          total > 0
            ? Math.round(
                (statistics.highRiskCount / total) * 100
              )
            : 0,
      },
      {
        level: "EXTREME",
        range: "81–100",
        count: statistics.extremeRiskCount,
        percentage:
          total > 0
            ? Math.round(
                (statistics.extremeRiskCount / total) * 100
              )
            : 0,
      },
    ];
  }, [statistics]);

  const recentScans = history.slice(0, 6);

  const profileSummary = useMemo(() => {
    if (statistics.scoredScans === 0) {
      return {
        title: "No investigation profile yet",
        description:
          "Scan tokens to begin building your RugReflex intelligence profile.",
      };
    }

    if (statistics.extremeRiskCount > 0) {
      return {
        title: "Extreme-risk activity detected",
        description:
          "At least one investigation contains severe observed risk signals. Review the corresponding report before making decisions.",
      };
    }

    if (statistics.highRiskCount > 0) {
      return {
        title: "High-risk activity detected",
        description:
          "Your investigations include strong observed risk signals that deserve additional scrutiny.",
      };
    }

    if (statistics.elevatedRiskCount > 0) {
      return {
        title: "Elevated risk activity detected",
        description:
          "Some investigations contain meaningful observed risk signals.",
      };
    }

    return {
      title: "Mostly lower observed risk",
      description:
        "Your saved investigations currently contain mostly low or moderate observed risk scores.",
    };
  }, [statistics]);

  return (
    <>
      <RugReflexNav />
      <main className="min-h-screen bg-[#100307] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">

        {/* HEADER */}
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a
              href="/"
              className="text-xs font-bold uppercase tracking-[0.3em] text-red-300"
            >
              RUGREFLEX
            </a>

            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/35">
              Token Risk Intelligence
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Intelligence Dashboard
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              Your central workspace for reviewing token investigations,
              risk patterns and intelligence collected by RugReflex.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/"
              className="rounded-lg border border-red-400/20 bg-red-950/30 px-4 py-2.5 text-xs font-semibold tracking-wide text-red-100 transition hover:border-red-300/40 hover:bg-red-900/40"
            >
              ← SCANNER
            </a>

            <a
              href="/history"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold tracking-wide text-white/80 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              HISTORY →
            </a>
          </div>
        </header>

        {/* OVERVIEW */}
        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300/70">
              Intelligence Overview
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Investigation activity
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                Total Investigations
              </p>

              <p className="mt-3 text-3xl font-semibold">
                {loading ? "—" : statistics.totalScans}
              </p>

              <p className="mt-2 text-xs text-white/35">
                Saved RugReflex reports
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                Average Risk
              </p>

              <p className="mt-3 text-3xl font-semibold">
                {loading || statistics.averageRisk === null
                  ? "—"
                  : `${statistics.averageRisk}/100`}
              </p>

              <p className="mt-2 text-xs text-white/35">
                Across saved investigations
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                Highest Observed Risk
              </p>

              <p className="mt-3 text-3xl font-semibold">
                {loading || statistics.highestRisk === null
                  ? "—"
                  : `${statistics.highestRisk}/100`}
              </p>

              <p className="mt-2 text-xs text-white/35">
                Highest score in your history
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                Elevated+ Investigations
              </p>

              <p className="mt-3 text-3xl font-semibold">
                {loading ? "—" : statistics.elevatedOrHigher}
              </p>

              <p className="mt-2 text-xs text-white/35">
                Scores above 40
              </p>
            </div>
          </div>
        </section>

        {/* INVESTIGATION PROFILE */}
        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300/70">
              Investigation Profile
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Risk distribution
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
              A breakdown of observed risk levels across your saved
              investigations. These categories describe signals detected
              by RugReflex and are not guarantees of token safety.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">

            {/* DISTRIBUTION */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Risk bands
                  </p>

                  <p className="mt-2 text-sm text-white/55">
                    {loading
                      ? "Loading investigation profile..."
                      : `${statistics.scoredScans} scored investigations`}
                  </p>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                    Elevated+
                  </p>
                  <p className="mt-1 text-lg font-semibold text-red-300">
                    {loading
                      ? "—"
                      : statistics.elevatedOrHigher}
                  </p>
                </div>
              </div>

              <div className="mt-7 space-y-5">
                {riskDistribution.map((item) => (
                  <div key={item.level}>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-white/80">
                          {item.level}
                        </span>

                        <span className="text-white/30">
                          {item.range}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-white/45">
                          {item.count}
                        </span>

                        <span className="w-10 text-right font-semibold text-white/70">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all ${riskBarClass(
                          item.level
                        )}`}
                        style={{
                          width: `${item.percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PROFILE SUMMARY */}
            <div className="rounded-2xl border border-red-400/10 bg-red-950/15 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300/70">
                Profile Signal
              </p>

              <h3 className="mt-4 text-xl font-semibold leading-7">
                {loading
                  ? "Analyzing..."
                  : profileSummary.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-white/50">
                {loading
                  ? "RugReflex is loading your investigation history."
                  : profileSummary.description}
              </p>

              <div className="mt-7 space-y-3 border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">
                    Low / Moderate
                  </span>

                  <span className="text-sm font-semibold text-emerald-300">
                    {loading
                      ? "—"
                      : statistics.lowRiskCount +
                        statistics.moderateRiskCount}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">
                    Elevated
                  </span>

                  <span className="text-sm font-semibold text-orange-300">
                    {loading
                      ? "—"
                      : statistics.elevatedRiskCount}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">
                    High
                  </span>

                  <span className="text-sm font-semibold text-red-300">
                    {loading
                      ? "—"
                      : statistics.highRiskCount}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">
                    Extreme
                  </span>

                  <span className="text-sm font-semibold text-red-400">
                    {loading
                      ? "—"
                      : statistics.extremeRiskCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RECENT INTELLIGENCE */}
        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300/70">
                Recent Intelligence
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                Latest investigations
              </h2>
            </div>

            <a
              href="/history"
              className="text-xs font-semibold tracking-wide text-red-300 transition hover:text-red-200"
            >
              VIEW ALL →
            </a>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-200">
              {error}
            </div>
          ) : loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 text-sm text-white/40">
              Loading recent investigations...
            </div>
          ) : recentScans.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
              <p className="text-sm font-semibold text-white/80">
                No investigations yet.
              </p>

              <p className="mt-2 text-sm text-white/40">
                Scan a Solana token to begin building your intelligence
                history.
              </p>

              <a
                href="/"
                className="mt-5 inline-flex rounded-lg border border-red-400/20 bg-red-950/30 px-4 py-2.5 text-xs font-semibold tracking-wide text-red-100 transition hover:border-red-300/40 hover:bg-red-900/40"
              >
                OPEN SCANNER →
              </a>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recentScans.map((scan) => {
                const score = scan.risk_score;
                const level = getRiskLevel(score);

                return (
                  <a
                    key={scan.id}
                    href={`/history/${scan.id}`}
                    className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-red-400/20 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {scan.token_name || "Unknown Token"}
                        </p>

                        <p className="mt-1 text-xs text-white/40">
                          {scan.token_symbol
                            ? `$${scan.token_symbol}`
                            : "Token"}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${riskClass(
                          score
                        )}`}
                      >
                        {score === null
                          ? "UNRATED"
                          : `${score}/100`}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-white/30">
                          Market Cap
                        </p>

                        <p className="mt-1 text-xs font-semibold text-white/75">
                          {formatMoney(scan.market_cap)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-white/30">
                          Liquidity
                        </p>

                        <p className="mt-1 text-xs font-semibold text-white/75">
                          {formatMoney(scan.liquidity_usd)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-white/30">
                          Holders
                        </p>

                        <p className="mt-1 text-xs font-semibold text-white/75">
                          {formatNumber(scan.total_holders)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-white/30">
                          Observed Level
                        </p>

                        <p className="mt-1 text-xs font-semibold text-white/75">
                          {level}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                      <span className="text-[10px] text-white/30">
                        {new Date(scan.scanned_at).toLocaleString()}
                      </span>

                      <span className="text-[10px] font-semibold tracking-wide text-red-300/70 transition group-hover:text-red-200">
                        VIEW REPORT →
                      </span>
                    </div>

                    <p className="mt-3 truncate text-[10px] text-white/20">
                      {shortMint(scan.token_mint)}
                    </p>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* INTELLIGENCE TOOLS */}
        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300/70">
              Intelligence Tools
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              RugReflex capabilities
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-950/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
                ACTIVE
              </p>

              <h3 className="mt-3 font-semibold">
                Holder Intelligence
              </h3>

              <p className="mt-2 text-xs leading-5 text-white/40">
                Analyze holder concentration and wallet distribution
                signals.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-950/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
                ACTIVE
              </p>

              <h3 className="mt-3 font-semibold">
                Deployer Intelligence
              </h3>

              <p className="mt-2 text-xs leading-5 text-white/40">
                Review deployer wallet activity and token creation
                intelligence.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                COMING SOON
              </p>

              <h3 className="mt-3 font-semibold">
                AI Investigation
              </h3>

              <p className="mt-2 text-xs leading-5 text-white/40">
                Deeper wallet relationships, funding paths and behavioral
                investigation.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                COMING SOON
              </p>

              <h3 className="mt-3 font-semibold">
                RugReflex Assistant
              </h3>

              <p className="mt-2 text-xs leading-5 text-white/40">
                Ask questions and get explanations from your token
                intelligence reports.
              </p>
            </div>
          </div>
        </section>

        {/* GROWTH */}
        <section className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300/70">
              RugReflex Growth
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Expand your access
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">

            <a
              href="/pro"
              className="rounded-2xl border border-red-400/15 bg-red-950/15 p-6 transition hover:border-red-300/30 hover:bg-red-900/20"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
                RUGREFLEX PRO
              </p>

              <h3 className="mt-3 text-lg font-semibold">
                Advanced intelligence access
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/45">
                Higher scan limits, advanced reports, wallet intelligence
                and future monitoring capabilities.
              </p>

              <p className="mt-5 text-xs font-semibold tracking-wide text-red-200">
                EXPLORE PRO →
              </p>
            </a>

            <a
              href="/referrals"
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-white/20 hover:bg-white/[0.05]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                REFERRAL PROGRAM
              </p>

              <h3 className="mt-3 text-lg font-semibold">
                Refer & Earn
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/45">
                Invite users to RugReflex and participate in the upcoming
                referral and rewards system.
              </p>

              <p className="mt-5 text-xs font-semibold tracking-wide text-white/60">
                OPEN REFERRALS →
              </p>
            </a>
          </div>
        </section>

        {/* RISK FRAMEWORK */}
        <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300/70">
                Risk Framework
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                How RugReflex interprets observed risk
              </h2>
            </div>

            <p className="text-xs text-white/30">
              Scores are signals, not guarantees.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["0–20", "LOW", "Lower observed risk"],
              ["21–40", "MODERATE", "Some observed signals"],
              ["41–60", "ELEVATED", "Meaningful signals"],
              ["61–80", "HIGH", "Strong signals"],
              ["81–100", "EXTREME", "Severe signals"],
            ].map(([range, label, description]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                  {range}
                </p>

                <p className="mt-2 text-sm font-semibold">
                  {label}
                </p>

                <p className="mt-1 text-[11px] leading-5 text-white/35">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-10 border-t border-white/10 pt-6 pb-4">
          <p className="text-xs leading-5 text-white/30">
            RugReflex provides observed blockchain and market risk analysis.
            Scores and signals are not guarantees of safety, future
            performance or token outcomes. Always conduct your own research.
          </p>
        </footer>
      </div>
      </main>
    </>
  );
}
