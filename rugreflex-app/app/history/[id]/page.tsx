"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  top_holder_percentage: number | null;
  top_10_percentage: number | null;
  mint_authority_active: boolean | null;
  freeze_authority_active: boolean | null;
  scanned_at: string;
  report_snapshot: {
    token?: any;
    market?: any;
    security?: any;
    liquidity?: any;
    holders?: any;
    deployer?: any;
    risk?: any;
    riskFlags?: any[];
  } | null;
};

function formatUsd(value: number | null | undefined) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number | null | undefined) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number | null | undefined) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
}

function shortAddress(value: string) {
  if (value.length <= 18) return value;

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export default function HistoricalReport({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [record, setRecord] =
    useState<HistoryRecord | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadHistoryRecord() {
      try {
        const { id } = await params;

        const response = await fetch(
          `/api/history?id=${encodeURIComponent(id)}`
        );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success ||
          !result.history
        ) {
          throw new Error(
            result.error ||
              "Historical report not found."
          );
        }

        setRecord(result.history);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load historical report."
        );
      } finally {
        setLoading(false);
      }
    }

    loadHistoryRecord();
  }, [params]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#17070d] text-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-white/60">
            Loading historical report...
          </p>
        </div>
      </main>
    );
  }

  if (error || !record) {
    return (
      <main className="min-h-screen bg-[#17070d] text-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <Link
            href="/history"
            className="text-sm text-white/60 hover:text-white"
          >
            ← Back to History
          </Link>

          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-950/20 p-6">
            <h1 className="text-xl font-semibold">
              Historical report unavailable
            </h1>

            <p className="mt-2 text-sm text-white/60">
              {error ||
                "The requested scan could not be found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const snapshot =
    record.report_snapshot;

  const token =
    snapshot?.token ?? null;

  const market =
    snapshot?.market ?? null;

  const security =
    snapshot?.security ?? null;

  const liquidity =
    snapshot?.liquidity ?? null;

  const holders =
    snapshot?.holders ?? null;

  const deployer =
    snapshot?.deployer ?? null;

  const risk =
    snapshot?.risk ?? null;

  const riskFlags =
    snapshot?.riskFlags ?? [];

  return (
    <main className="min-h-screen bg-[#17070d] text-white">
      <nav className="border-b border-white/10 bg-[#210912]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-lg font-bold tracking-[0.2em]"
          >
            RUGREFLEX
          </Link>

          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/"
              className="text-white/60 hover:text-white"
            >
              Scanner
            </Link>

            <Link
              href="/history"
              className="text-white hover:text-white"
            >
              History
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/history"
          className="text-sm text-white/50 hover:text-white"
        >
          ← Back to History
        </Link>

        <header className="mt-6">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">
            Historical Risk Intelligence
          </p>

          <div className="mt-3 flex flex-col gap-2">
            <h1 className="text-3xl font-bold">
              {record.token_name ||
                "Unknown Token"}
            </h1>

            <p className="text-white/50">
              {record.token_symbol
                ? `$${record.token_symbol}`
                : "UNKNOWN"}
            </p>

            <p className="break-all font-mono text-xs text-white/35">
              {record.token_mint}
            </p>
          </div>

          <p className="mt-4 text-xs text-white/35">
            Scanned{" "}
            {new Date(
              record.scanned_at
            ).toLocaleString()}
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs text-white/40">
              Risk Score
            </p>

            <p className="mt-2 text-4xl font-bold">
              {record.risk_score ?? "—"}
            </p>

            <p className="mt-1 text-xs font-semibold text-white/60">
              {record.risk_label ||
                "NOT ANALYZED"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs text-white/40">
              Market Cap
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatUsd(
                record.market_cap
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs text-white/40">
              Liquidity
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatUsd(
                record.liquidity_usd
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs text-white/40">
              Holders
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatNumber(
                record.total_holders
              )}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">
              Market Intelligence
            </h2>

            <div className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-white/45">
                  24h Volume
                </span>
                <span>
                  {formatUsd(
                    record.volume_24h
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/45">
                  Liquidity
                </span>
                <span>
                  {formatUsd(
                    record.liquidity_usd
                  )}
                </span>
              </div>

              {market?.dex && (
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">
                    DEX
                  </span>
                  <span>
                    {market.dex}
                  </span>
                </div>
              )}

              {market?.pairs !== undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">
                    Pairs
                  </span>
                  <span>
                    {formatNumber(
                      market.pairs
                    )}
                  </span>
                </div>
              )}

              {liquidity?.fdv !== undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">
                    FDV
                  </span>
                  <span>
                    {formatUsd(
                      liquidity.fdv
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">
              Holder Intelligence
            </h2>

            <div className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-white/45">
                  Total Holders
                </span>
                <span>
                  {formatNumber(
                    record.total_holders
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/45">
                  Top Holder
                </span>
                <span>
                  {formatPercent(
                    record.top_holder_percentage
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/45">
                  Top 10
                </span>
                <span>
                  {formatPercent(
                    record.top_10_percentage
                  )}
                </span>
              </div>

              {holders?.top20Percentage !==
                undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">
                    Top 20
                  </span>
                  <span>
                    {formatPercent(
                      holders.top20Percentage
                    )}
                  </span>
                </div>
              )}

              {holders?.top50Percentage !==
                undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">
                    Top 50
                  </span>
                  <span>
                    {formatPercent(
                      holders.top50Percentage
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">
              Security
            </h2>

            <div className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-white/45">
                  Mint Authority
                </span>
                <span>
                  {record.mint_authority_active ===
                  true
                    ? "ACTIVE"
                    : record.mint_authority_active ===
                        false
                      ? "REVOKED"
                      : "UNKNOWN"}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-white/45">
                  Freeze Authority
                </span>
                <span>
                  {record.freeze_authority_active ===
                  true
                    ? "ACTIVE"
                    : record.freeze_authority_active ===
                        false
                      ? "REVOKED"
                      : "UNKNOWN"}
                </span>
              </div>

              {security?.mintAuthorityActive !==
                undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">
                    Snapshot Status
                  </span>
                  <span>
                    Security data preserved
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold">
              Deployer Intelligence
            </h2>

            {deployer ? (
              <div className="mt-5 space-y-4 text-sm">
                {deployer.wallet && (
                  <div>
                    <p className="text-xs text-white/40">
                      Deployer Wallet
                    </p>

                    <p className="mt-1 break-all font-mono text-xs text-white/70">
                      {deployer.wallet}
                    </p>
                  </div>
                )}

                {deployer.address && (
                  <div>
                    <p className="text-xs text-white/40">
                      Address
                    </p>

                    <p className="mt-1 break-all font-mono text-xs text-white/70">
                      {deployer.address}
                    </p>
                  </div>
                )}

                {deployer.solBalance !==
                  undefined && (
                  <div className="flex justify-between">
                    <span className="text-white/45">
                      SOL Balance
                    </span>
                    <span>
                      {deployer.solBalance}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/45">
                Deployer intelligence was not
                available when this scan was saved.
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold">
            Risk Signals
          </h2>

          {riskFlags.length > 0 ? (
            <div className="mt-5 space-y-3">
              {riskFlags.map(
                (flag: any, index: number) => (
                  <div
                    key={`${flag.title || "flag"}-${index}`}
                    className="rounded-xl border border-white/10 bg-black/10 p-4"
                  >
                    <p className="font-medium">
                      {flag.title ||
                        "Risk Signal"}
                    </p>

                    {flag.description && (
                      <p className="mt-1 text-sm text-white/50">
                        {flag.description}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="mt-5 text-sm text-white/45">
              No saved risk flags were recorded.
            </p>
          )}
        </section>

        {!snapshot && (
          <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-950/20 p-5">
            <p className="text-sm text-yellow-100/80">
              This scan was saved before full report
              snapshots were enabled. Summary
              intelligence is available, but the
              original full report was not preserved.
            </p>
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <Link
            href="/history"
            className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/70 hover:bg-white/5"
          >
            ← History
          </Link>

          <Link
            href="/"
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
          >
            Scan a Token
          </Link>
        </div>
      </div>
    </main>
  );
}
