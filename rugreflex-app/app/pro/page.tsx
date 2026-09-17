"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthGateModal from "@/app/components/AuthGateModal";

type ProPlan = {
  id: number;
  name: string;
  price_usdc: number;
  duration_days: number;
  features: string[] | null;
  active: boolean;
};

type PaymentMethod = {
  currency: string;
  enabled: boolean;
  network: string;
};

type ProConfig = {
  enabled: boolean;
  plans: ProPlan[];
  payments: PaymentMethod[];
  rflxDiscountPercent: number;
};

export default function ProPage() {
  const [config, setConfig] = useState<ProConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState<number | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [transactionSignature, setTransactionSignature] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<Record<number, string>>({});
  const [payment, setPayment] = useState<{
    reference: string;
    currency: string;
    amount: number;
    receivingWallet: string;
    planName: string;
    durationDays: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/pro", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Unable to load Pro configuration.");
        }

        setConfig(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load Pro.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const enabledPayments =
    config?.payments?.filter((payment) => payment.enabled) ?? [];

  const formatPrice = (value: number) =>
    Number(value).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });

  async function createPayment(planId: number, currency: string) {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      setAuthGateOpen(true);
      return;
    }
    setPaymentLoading(planId);
    setError("");
    setPaymentSuccess("");
    setTransactionSignature("");
    setPayment(null);

    try {
      const response = await fetch("/api/pro/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          currency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          [
            data?.error || "Unable to create payment.",
            data?.details,
            data?.code ? `Code: ${data.code}` : null,
            data?.hint ? `Hint: ${data.hint}` : null,
          ]
            .filter(Boolean)
            .join(" | ")
        );
      }

      setPayment({
        reference: data.payment?.reference,
        currency: data.payment?.currency,
        amount: Number(data.payment?.amount || 0),
        receivingWallet: data.payment?.receiving_wallet,
        planName: data.plan?.name || "RugReflex Pro",
        durationDays: Number(data.plan?.duration_days || 0),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create payment."
      );
    } finally {
      setPaymentLoading(null);
    }
  }

  async function verifyPayment() {
    if (!payment) return;

    const signature = transactionSignature.trim();

    if (!signature) {
      setError("Enter the Solana transaction signature.");
      return;
    }

    setVerifyLoading(true);
    setError("");
    setPaymentSuccess("");

    try {
      const response = await fetch("/api/pro/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference: payment.reference,
          transactionSignature: signature,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to verify the payment."
        );
      }

      setPaymentSuccess(
        data?.message ||
          "Payment verified and RugReflex Pro activated."
      );
      setTransactionSignature("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify the payment."
      );
    } finally {
      setVerifyLoading(false);
    }
  }

  return (
    <>
    <main className="min-h-screen bg-[#100308] text-white">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
        <nav className="mb-12 flex items-center justify-between border-b border-white/[0.07] pb-5">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-[#64122b]">
              R
            </div>

            <div>
              <p className="text-sm font-black tracking-[0.08em]">
                RUGREFLEX
              </p>
              <p className="text-[9px] uppercase tracking-[0.22em] text-white/35">
                Token Risk Intelligence
              </p>
            </div>
          </a>

          <a
            href="/"
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/60 transition hover:border-[#9f2348]/50 hover:text-white"
          >
            Scanner
          </a>
        </nav>

        <section className="rounded-[28px] border border-white/[0.08] bg-[#250711]/80 p-8 sm:p-14">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9f2348]/15 text-xl font-black">
              ◆
            </div>

            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e89ab2]">
              Premium Intelligence
            </p>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
              RugReflex Pro
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
              Advanced token intelligence for users who want deeper analysis,
              increased scan capacity, Alpha Radar access and professional
              investigation tools.
            </p>
          </div>

          {loading && (
            <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-center text-sm text-white/45">
              Loading Pro plans...
            </div>
          )}

          {error && (
            <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <p className="font-semibold text-red-300">
                Pro payment issue
              </p>
              <p className="mt-2 text-xs text-white/40">{error}</p>
            </div>
          )}

          {!loading && !error && config && !config.enabled && (
            <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-center">
              <p className="font-bold">RugReflex Pro is currently unavailable</p>
              <p className="mt-2 text-xs text-white/40">
                Pro access is temporarily disabled by the platform
                administrator.
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            config?.enabled &&
            config.plans.length === 0 && (
              <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-center">
                <p className="font-bold">No Pro plans are currently available</p>
                <p className="mt-2 text-xs text-white/40">
                  Please check again later.
                </p>
              </div>
            )}

          {!loading &&
            !error &&
            config?.enabled &&
            config.plans.length > 0 && (
              <>
                <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
                  {config.plans.map((plan) => {
                    const availableCurrencies = enabledPayments.map(
                      (payment) => payment.currency
                    );

                    const currency =
                      selectedCurrency[plan.id] ||
                      availableCurrencies[0] ||
                      "USDC";

                    return (
                      <div
                        key={plan.id}
                        className="rounded-3xl border border-white/[0.09] bg-white/[0.025] p-6 sm:p-7"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-black">{plan.name}</p>
                            <p className="mt-1 text-xs text-white/35">
                              {plan.duration_days} days of Pro access
                            </p>
                          </div>

                          {plan.duration_days >= 180 && (
                            <span className="rounded-full border border-[#9f2348]/30 bg-[#9f2348]/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#e89ab2]">
                              Extended
                            </span>
                          )}
                        </div>

                        <div className="mt-7">
                          <p className="text-3xl font-black">
                            {formatPrice(Number(plan.price_usdc))} USDC
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            Standard Pro price
                          </p>
                        </div>

                        {enabledPayments.length > 1 && (
                          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                              Payment currency
                            </p>

                            <div className="mt-3 flex gap-2">
                              {enabledPayments.map((payment) => (
                                <button
                                  key={payment.currency}
                                  type="button"
                                  onClick={() =>
                                    setSelectedCurrency((current) => ({
                                      ...current,
                                      [plan.id]: payment.currency,
                                    }))
                                  }
                                  className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                                    currency === payment.currency
                                      ? "bg-[#9f2348] text-white"
                                      : "border border-white/10 text-white/50 hover:text-white"
                                  }`}
                                >
                                  {payment.currency}
                                </button>
                              ))}
                            </div>

                            {currency === "RFLX" && (
                              <p className="mt-3 text-[10px] leading-5 text-white/35">
                                The RFLX amount is calculated from the current
                                market price when the payment is created.
                              </p>
                            )}
                          </div>
                        )}

                        {Array.isArray(plan.features) &&
                          plan.features.length > 0 && (
                            <div className="mt-6 space-y-2">
                              {plan.features.map((feature, index) => (
                                <div
                                  key={`${plan.id}-${index}`}
                                  className="flex gap-2 text-xs text-white/55"
                                >
                                  <span className="text-[#e89ab2]">✓</span>
                                  <span>{feature}</span>
                                </div>
                              ))}
                            </div>
                          )}

                        <button
                          type="button"
                          disabled={
                            paymentLoading === plan.id ||
                            enabledPayments.length === 0
                          }
                          onClick={() =>
                            createPayment(plan.id, currency)
                          }
                          className="mt-7 w-full rounded-xl bg-[#9f2348] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#b52a54] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {paymentLoading === plan.id
                            ? "Creating payment..."
                            : "Continue to payment"}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {payment && (
                  <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[#9f2348]/30 bg-[#9f2348]/5 p-6">
                    <p className="text-sm font-bold">Payment created</p>
                    <p className="mt-2 text-xs text-white/45">
                      {payment.planName} · {payment.durationDays} days
                    </p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/30">
                          Amount
                        </p>
                        <p className="mt-1 font-bold">
                          {formatPrice(payment.amount)} {payment.currency}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/30">
                          Reference
                        </p>
                        <p className="mt-1 break-all font-mono text-xs text-white/70">
                          {payment.reference}
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-white/30">
                          Solana receiving wallet
                        </p>
                        <p className="mt-1 break-all font-mono text-xs text-white/70">
                          {payment.receivingWallet}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/20 p-5">
                      <p className="text-xs font-bold text-white/70">
                        Complete your Solana payment
                      </p>

                      <ol className="mt-3 space-y-2 text-xs leading-5 text-white/45">
                        <li>
                          <span className="font-bold text-white/65">1.</span>{" "}
                          Send exactly{" "}
                          <span className="font-semibold text-white/75">
                            {formatPrice(payment.amount)} {payment.currency}
                          </span>{" "}
                          to the receiving wallet above.
                        </li>
                        <li>
                          <span className="font-bold text-white/65">2.</span>{" "}
                          Wait for the Solana transaction to confirm.
                        </li>
                        <li>
                          <span className="font-bold text-white/65">3.</span>{" "}
                          Paste the transaction signature below and verify it.
                        </li>
                      </ol>

                      <label className="mt-5 block">
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">
                          Solana transaction signature
                        </span>
                        <input
                          type="text"
                          value={transactionSignature}
                          onChange={(e) =>
                            setTransactionSignature(e.target.value)
                          }
                          placeholder="Paste transaction signature"
                          className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-3 font-mono text-xs text-white outline-none focus:border-red-600"
                        />
                      </label>

                      <button
                        type="button"
                        disabled={
                          verifyLoading ||
                          !transactionSignature.trim()
                        }
                        onClick={verifyPayment}
                        className="mt-4 w-full rounded-xl bg-[#9f2348] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#b52a54] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {verifyLoading
                          ? "Verifying payment..."
                          : "Verify Payment & Activate Pro"}
                      </button>
                    </div>
                  </div>
                )}

                {paymentSuccess && (
                  <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                    <p className="font-bold text-emerald-300">
                      Pro activated
                    </p>
                    <p className="mt-2 text-xs leading-5 text-white/50">
                      {paymentSuccess}
                    </p>
                  </div>
                )}

                <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-white/[0.07] bg-black/20 p-5">
                  <p className="text-xs font-semibold text-white/60">
                    Available payment networks
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {enabledPayments.map((payment) => (
                      <span
                        key={payment.currency}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold text-white/55"
                      >
                        {payment.currency} · {payment.network}
                      </span>
                    ))}
                  </div>

                  {enabledPayments.some(
                    (payment) => payment.currency === "RFLX"
                  ) && (
                    <p className="mt-4 text-[10px] leading-5 text-white/30">
                      * RFLX pricing reflects the configured Pro discount.
                      Final payment verification will occur on the Solana
                      network.
                    </p>
                  )}
                </div>
              </>
            )}

          <div className="mx-auto mt-12 grid max-w-4xl gap-3 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="font-bold">50 Daily Scans</p>
              <p className="mt-2 text-xs text-white/35">
                Higher scan capacity for active users.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="font-bold">Advanced Reports</p>
              <p className="mt-2 text-xs text-white/35">
                Deeper intelligence and expanded reporting.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="font-bold">Wallet Intelligence</p>
              <p className="mt-2 text-xs text-white/35">
                Investigate wallet activity and relationships.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="font-bold">Alpha Radar</p>
              <p className="mt-2 text-xs text-white/35">
                Access Pro-only token monitoring and Alpha intelligence.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>

      <AuthGateModal
        open={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        feature="RugReflex Pro"
      />
    </>
  );
}
