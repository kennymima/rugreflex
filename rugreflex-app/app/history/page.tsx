"use client";

import { useEffect, useMemo, useState } from "react";

type ScanHistory = {
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
  top_holder_percentage: number | null;
  top_10_percentage: number | null;
  mint_authority_active: boolean | null;
  freeze_authority_active: boolean | null;
  scanned_at: string;
};

function formatUsd(value: number | null) {
  if (
    value === null ||
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

  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function shortenAddress(value: string) {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 7)}...${value.slice(-7)}`;
}

function getRiskClass(score: number | null) {
  if (score === null) {
    return "border-white/10 bg-white/5 text-white/60";
  }

  if (score <= 20) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (score <= 40) {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  if (score <= 60) {
    return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  }

  if (score <= 80) {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-red-700/40 bg-red-700/15 text-red-300";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function HistoryPage() {
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        setError("");

        const response =
          await fetch("/api/history");

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ||
              "Unable to load scan history."
          );
        }

        setHistory(
          Array.isArray(result.history)
            ? result.history
            : []
        );
      } catch (err) {
        console.error(
          "History loading error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load scan history."
        );
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  const filteredHistory =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return history;
      }

      return history.filter((scan) => {
        return (
          scan.token_name
            ?.toLowerCase()
            .includes(query) ||
          scan.token_symbol
            ?.toLowerCase()
            .includes(query) ||
          scan.token_mint
            .toLowerCase()
            .includes(query)
        );
      });
    }, [history, search]);

  return (
    <main className="min-h-screen bg-[#100308] text-white">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[#800020]/20 blur-[140px]" />
        <div className="absolute top-[45%] -left-40 h-[400px] w-[400px] rounded-full bg-[#4a0014]/20 blur-[130px]" />
      </div>

      <nav className="relative z-10 border-b border-white/10 bg-[#100308]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a
            href="/"
            className="font-black tracking-[0.25em] text-lg"
          >
            RUGREFLEX
          </a>

          <div className="flex items-center gap-5">
            <a
              href="/"
              className="text-sm text-white/60 transition hover:text-white"
            >
              Scanner
            </a>

            <span className="text-sm font-semibold text-white">
              History
            </span>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#d36a88]">
            Token Risk Intelligence
          </p>

          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Scan History
          </h1>

          <p className="mt-4 max-w-2xl text-white/55">
            Review your previous RugReflex token
            risk assessments and market intelligence.
          </p>
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xl">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search token name, symbol or mint..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm outline-none transition placeholder:text-white/30 focus:border-[#800020]"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/55">
            {history.length}{" "}
            {history.length === 1
              ? "scan"
              : "scans"}{" "}
            saved
          </div>
        </div>

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <p className="text-white/60">
              Loading scan history...
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8">
            <p className="font-semibold text-red-300">
              {error}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          filteredHistory.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#800020]/30 bg-[#800020]/10 text-2xl">
                R
              </div>

              <h2 className="text-xl font-bold">
                {history.length === 0
                  ? "No scans saved yet"
                  : "No matching scans"}
              </h2>

              <p className="mx-auto mt-3 max-w-md text-sm text-white/45">
                {history.length === 0
                  ? "Your completed RugReflex assessments will appear here."
                  : "Try searching with another token name, symbol or mint address."}
              </p>

              {history.length === 0 && (
                <a
                  href="/"
                  className="mt-6 inline-flex rounded-xl bg-[#800020] px-6 py-3 text-sm font-bold transition hover:bg-[#a0002d]"
                >
                  SCAN A TOKEN
                </a>
              )}
            </div>
          )}

        {!loading &&
          !error &&
          filteredHistory.length > 0 && (
            <div className="grid gap-5">
              {filteredHistory.map((scan) => (
                <article
                  key={scan.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-[#800020]/40 hover:bg-white/[0.045]"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-black">
                          {scan.token_name ||
                            "Unknown Token"}
                        </h2>

                        {scan.token_symbol && (
                          <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white/60">
                            ${scan.token_symbol}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 font-mono text-xs text-white/35">
                        {shortenAddress(
                          scan.token_mint
                        )}
                      </p>

                      <p className="mt-3 text-xs text-white/35">
                        Scanned{" "}
                        {formatDate(
                          scan.scanned_at
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div
                        className={`rounded-2xl border px-5 py-3 text-center ${getRiskClass(
                          scan.risk_score
                        )}`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                          Risk Score
                        </p>

                        <p className="mt-1 text-2xl font-black">
                          {scan.risk_score ?? "—"}
                        </p>
                      </div>

                      <div
                        className={`max-w-[220px] rounded-2xl border px-4 py-3 text-center text-xs font-bold ${getRiskClass(
                          scan.risk_score
                        )}`}
                      >
                        {scan.risk_label ||
                          "NOT ANALYZED"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/30">
                        Market Cap
                      </p>
                      <p className="mt-1 font-bold">
                        {formatUsd(
                          scan.market_cap
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/30">
                        Liquidity
                      </p>
                      <p className="mt-1 font-bold">
                        {formatUsd(
                          scan.liquidity_usd
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/30">
                        Holders
                      </p>
                      <p className="mt-1 font-bold">
                        {scan.total_holders?.toLocaleString() ||
                          "Unknown"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/30">
                        24h Volume
                      </p>
                      <p className="mt-1 font-bold">
                        {formatUsd(
                          scan.volume_24h
                        )}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
      </section>
    </main>
  );
}
