"use client";

import { useState } from "react";

type FundingSource = {
  address: string;
  observedTransactionCount: number;
};

type WalletResult = {
  success: boolean;
  address?: string;
  solBalance?: number;
  recentTransactionCount?: number;
  walletAgeDays?: number;
  incomingTransactionCount?: number;
  outgoingTransactionCount?: number;
  neutralTransactionCount?: number;
  totalIncomingSol?: number;
  totalOutgoingSol?: number;
  activityIntensity?: string;
  activityAssessment?: string;
  confidence?: string;

  fundingSources?: FundingSource[];
  primaryObservedFundingSource?: string | null;
  tokenCreationTransactionCount?: number;
  observedProgramCount?: number;

  firstObservedActivityTimestamp?: string | null;
  latestActivityTimestamp?: string | null;

  evidence?: string[];
  limitations?: string[];
  error?: string;
};

export default function WalletIntelligencePage() {
  const [address, setAddress] = useState("");
  const [result, setResult] =
    useState<WalletResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function investigate() {
    const value = address.trim();

    if (!value) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        `/api/wallet?address=${encodeURIComponent(value)}`
      );

      const data =
        (await response.json()) as WalletResult;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to analyze wallet"
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to analyze wallet"
      );
    } finally {
      setLoading(false);
    }
  }

  const card =
    "rounded-2xl border border-red-950/60 bg-[#100708] p-5";

  const show = (value: unknown) =>
    value === undefined ||
    value === null ||
    value === ""
      ? "—"
      : String(value);

  const formatSol = (value?: number) => {
    if (
      value === undefined ||
      value === null ||
      !Number.isFinite(value)
    ) {
      return "—";
    }

    return value.toLocaleString(
      undefined,
      {
        maximumFractionDigits: 4,
      }
    );
  };

  const formatTimestamp = (
    timestamp?: string | number | null
  ) => {
    if (
      timestamp === undefined ||
      timestamp === null
    ) {
      return "—";
    }

    const date =
      typeof timestamp === "number"
        ? new Date(timestamp * 1000)
        : new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString();
  };

  const activityLabel =
    result?.activityAssessment
      ?.replaceAll("_", " ") || "—";

  const activityIntensity =
    result?.activityIntensity
      ?.replaceAll("_", " ") || "—";

  return (
    <main className="min-h-screen bg-[#070405] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">

        <div className="mb-8">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-red-400">
            RugReflex Intelligence
          </p>

          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            Wallet Intelligence
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
            Investigate observable Solana wallet activity,
            balance, history, native SOL flow and wallet
            behaviour. RugReflex reports observed blockchain
            evidence, not conclusions about ownership,
            affiliation or intent.
          </p>
        </div>

        <section className="rounded-3xl border border-red-950/70 bg-[#0d0607] p-5 md:p-7">
          <label className="mb-2 block text-xs font-black uppercase tracking-wider text-gray-400">
            Solana wallet address
          </label>

          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={address}
              onChange={(event) =>
                setAddress(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  investigate();
                }
              }}
              placeholder="Enter a Solana wallet address"
              className="min-w-0 flex-1 rounded-xl border border-red-950 bg-black px-4 py-3 text-sm outline-none focus:border-red-500"
            />

            <button
              onClick={investigate}
              disabled={
                loading ||
                !address.trim()
              }
              className="rounded-xl bg-red-600 px-6 py-3 text-sm font-black hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading
                ? "Investigating..."
                : "Investigate Wallet"}
            </button>
          </div>

          {error && (
            <p className="mt-4 text-sm font-bold text-red-400">
              {error}
            </p>
          )}
        </section>

        {result && (
          <div className="mt-6 space-y-5">

            {/* Wallet identity */}
            <section className={card}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-gray-500">
                    Investigated wallet
                  </p>

                  <p className="mt-2 break-all font-mono text-sm text-gray-200">
                    {show(result.address)}
                  </p>
                </div>

                <div className="rounded-xl border border-red-950 bg-black/40 px-4 py-3">
                  <p className="text-xs text-gray-500">
                    Intelligence confidence
                  </p>

                  <p className="mt-1 text-sm font-black text-red-300">
                    {show(result.confidence)}
                  </p>
                </div>
              </div>
            </section>

            {/* Core profile */}
            <div className="grid gap-4 md:grid-cols-4">

              <div className={card}>
                <p className="text-xs text-gray-500">
                  SOL balance
                </p>
                <p className="mt-2 text-2xl font-black">
                  {formatSol(result.solBalance)}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  SOL
                </p>
              </div>

              <div className={card}>
                <p className="text-xs text-gray-500">
                  Observed age
                </p>
                <p className="mt-2 text-2xl font-black">
                  {show(result.walletAgeDays)}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  days
                </p>
              </div>

              <div className={card}>
                <p className="text-xs text-gray-500">
                  Recent transactions
                </p>
                <p className="mt-2 text-2xl font-black">
                  {show(result.recentTransactionCount)}
                </p>
              </div>

              <div className={card}>
                <p className="text-xs text-gray-500">
                  Activity
                </p>
                <p className="mt-2 text-lg font-black text-red-300">
                  {activityLabel}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {activityIntensity}
                </p>
              </div>

            </div>

            {/* Activity timeline */}
            <section className={card}>
              <h2 className="text-lg font-black">
                Activity timeline
              </h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">

                <div className="rounded-xl border border-red-950/50 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    Earliest observed activity
                  </p>

                  <p className="mt-2 text-sm font-bold text-gray-200">
                    {formatTimestamp(
                      result.firstObservedActivityTimestamp
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-red-950/50 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    Latest observed activity
                  </p>

                  <p className="mt-2 text-sm font-bold text-gray-200">
                    {formatTimestamp(
                      result.latestActivityTimestamp
                    )}
                  </p>
                </div>

              </div>

              <p className="mt-4 text-xs leading-5 text-gray-500">
                Observed age represents the earliest activity
                available to RugReflex within the investigated
                blockchain history. It is not automatically the
                wallet&apos;s true creation date.
              </p>
            </section>

            {/* SOL flow */}
            <section className={card}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black">
                    Observed SOL flow
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Native SOL balance movement visible in
                    investigated transactions.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">

                <div className="rounded-xl border border-red-950/50 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    Incoming
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {show(
                      result.incomingTransactionCount
                    )}
                  </p>

                  <p className="mt-1 text-sm text-gray-400">
                    {formatSol(
                      result.totalIncomingSol
                    )}{" "}
                    SOL
                  </p>
                </div>

                <div className="rounded-xl border border-red-950/50 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    Outgoing
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {show(
                      result.outgoingTransactionCount
                    )}
                  </p>

                  <p className="mt-1 text-sm text-gray-400">
                    {formatSol(
                      result.totalOutgoingSol
                    )}{" "}
                    SOL
                  </p>
                </div>

                <div className="rounded-xl border border-red-950/50 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    Neutral
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {show(
                      result.neutralTransactionCount
                    )}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    No net SOL movement
                  </p>
                </div>

              </div>
            </section>

            {/* Deployer intelligence */}
            <section className="rounded-2xl border border-red-900/60 bg-[#120708] p-5 md:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-red-400">
                  Deployer / Wallet Intelligence
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Observable wallet signals
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
                  These signals describe blockchain activity
                  observed by RugReflex. They do not establish
                  ownership, identity or malicious intent.
                </p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">

                <div className="rounded-xl border border-red-950/50 bg-black/30 p-4">
                  <p className="text-xs text-gray-500">
                    Token creation activity
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {show(
                      result.tokenCreationTransactionCount
                    )}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    observed mint initializations
                  </p>
                </div>

                <div className="rounded-xl border border-red-950/50 bg-black/30 p-4">
                  <p className="text-xs text-gray-500">
                    Programs observed
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {show(
                      result.observedProgramCount
                    )}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    distinct program identifiers
                  </p>
                </div>

                <div className="rounded-xl border border-red-950/50 bg-black/30 p-4">
                  <p className="text-xs text-gray-500">
                    Primary observed funding source
                  </p>

                  <p className="mt-2 break-all font-mono text-xs font-bold text-gray-300">
                    {show(
                      result.primaryObservedFundingSource
                    )}
                  </p>
                </div>

              </div>

              {result.fundingSources &&
                result.fundingSources.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-black uppercase tracking-wider text-gray-500">
                      Observed funding counterparties
                    </p>

                    <div className="mt-3 space-y-2">
                      {result.fundingSources.map(
                        (source, index) => (
                          <div
                            key={`${source.address}-${index}`}
                            className="flex flex-col gap-2 rounded-xl border border-red-950/40 bg-black/20 p-3 md:flex-row md:items-center md:justify-between"
                          >
                            <span className="break-all font-mono text-xs text-gray-300">
                              {source.address}
                            </span>

                            <span className="text-xs font-black text-red-300">
                              {source.observedTransactionCount} observed
                              transfer
                              {source.observedTransactionCount === 1
                                ? ""
                                : "s"}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
            </section>

            {/* Evidence + limitations */}
            <div className="grid gap-5 md:grid-cols-2">

              <section className={card}>
                <h2 className="text-lg font-black">
                  Evidence
                </h2>

                <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-300">
                  {(result.evidence || []).map(
                    (item, index) => (
                      <li key={index}>
                        • {item}
                      </li>
                    )
                  )}
                </ul>
              </section>

              <section className={card}>
                <h2 className="text-lg font-black">
                  Limitations
                </h2>

                <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-400">
                  {(result.limitations || []).map(
                    (item, index) => (
                      <li key={index}>
                        • {item}
                      </li>
                    )
                  )}
                </ul>
              </section>

            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-600">
          Observed blockchain intelligence only. Activity
          does not by itself establish malicious behavior,
          ownership or affiliation.
        </p>

      </div>
    </main>
  );
}
