"use client";

import { useEffect, useState } from "react";
import { useAdvertising } from "./AdvertisingProvider";

type FormState = {
  token_name: string;
  logo: string;
  token_symbol: string;
  token_address: string;
  description: string;
};

type Advertisement = {
  id: number;
  token_name: string;
  token_symbol: string | null;
  token_address: string | null;
  logo: string | null;
  description: string | null;
  status: string;
  package_id: number | null;
  currency: string | null;
  amount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  payment_record_id: number | null;
  created_at: string;
};

type AdPackage = {
  id: number;
  name: string;
  duration_days: number;
  price_usdc: number;
  active: boolean;
};

type PaymentState = {
  advertisementId: number;
  packageId: number;
  currency: "USDC" | "RFLX";
  reference: string;
  amount: number;
  receivingWallet: string;
  transactionSignature: string;
};

const emptyForm: FormState = {
  token_name: "",
  logo: "",
  token_symbol: "",
  token_address: "",
  description: "",
};

export default function PromotionContact() {
  const {
    adsEnabled,
    adsLoading,
    paymentsEnabled,
    usdcEnabled,
    rflxEnabled,
    rflxDiscountPercent,
    advertisements,
    packages,
    refreshAdvertisingData,
  } = useAdvertising();

  const [open, setOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [message, setMessage] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");

  const [form, setForm] = useState<FormState>(emptyForm);

  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(
    null
  );
  const [selectedCurrency, setSelectedCurrency] = useState<"USDC" | "RFLX">(
    "USDC"
  );

  const [payment, setPayment] = useState<PaymentState | null>(null);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/advertisements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data?.error || "Unable to submit advertising request.");
        return;
      }

      setMessage(
        "Request submitted successfully. It is now pending review."
      );
      setForm(emptyForm);
      await refreshAdvertisingData();
    } catch {
      setMessage("Unable to submit advertising request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function createPayment() {
    if (!selectedAd || !selectedPackageId) {
      setPaymentMessage("Please select an advertising package.");
      return;
    }

    setCreatingPayment(true);
    setPaymentMessage("");

    try {
      const response = await fetch("/api/advertisements/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          advertisementId: selectedAd.id,
          packageId: selectedPackageId,
          currency: selectedCurrency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPaymentMessage(
          data?.error || "Unable to create the advertising payment."
        );
        return;
      }

      setPayment({
        advertisementId: selectedAd.id,
        packageId: selectedPackageId,
        currency: selectedCurrency,
        reference: data.payment.reference,
        amount: Number(data.payment.amount),
        receivingWallet: data.payment.receiving_wallet,
        transactionSignature: "",
      });
    } catch {
      setPaymentMessage("Unable to create the advertising payment.");
    } finally {
      setCreatingPayment(false);
    }
  }

  async function verifyPayment() {
    if (!payment?.transactionSignature.trim()) {
      setPaymentMessage("Enter the Solana transaction signature first.");
      return;
    }

    setVerifyingPayment(true);
    setPaymentMessage("");

    try {
      const response = await fetch(
        "/api/advertisements/payment/verify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reference: payment.reference,
            transactionSignature: payment.transactionSignature.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setPaymentMessage(
          data?.error || "Unable to verify the advertising payment."
        );
        return;
      }

      setPaymentMessage(
        "Payment verified. Your advertisement is now active."
      );

      setPayment(null);
      setSelectedAd(null);
      setSelectedPackageId(null);

      await refreshAdvertisingData();
    } catch {
      setPaymentMessage("Unable to verify the advertising payment.");
    } finally {
      setVerifyingPayment(false);
    }
  }

  async function openPayment(ad: Advertisement) {
    setSelectedAd(ad);
    setSelectedPackageId(ad.package_id);
    setPayment(null);
    setPaymentMessage("");
    setCreatingPayment(false);

    if (ad.currency === "USDC" || ad.currency === "RFLX") {
      setSelectedCurrency(ad.currency);
    } else if (!usdcEnabled && rflxEnabled) {
      setSelectedCurrency("RFLX");
    } else {
      setSelectedCurrency("USDC");
    }

    setPaymentOpen(true);

    try {
      const response = await fetch(
        `/api/advertisements/payment?advertisementId=${encodeURIComponent(
          ad.id
        )}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        setPaymentMessage(
          data?.error || "Unable to load the existing payment."
        );
        return;
      }

      if (data?.payment) {
        setPayment({
          advertisementId: ad.id,
          packageId: Number(
            data?.advertisement?.package_id ?? ad.package_id ?? 0
          ),
          currency: data.payment.currency,
          reference: data.payment.reference,
          amount: Number(data.payment.amount),
          receivingWallet: data.payment.receiving_wallet,
          transactionSignature: "",
        });
      }
    } catch (error) {
      console.error("Advertisement payment recovery error:", error);
      setPaymentMessage("Unable to load the existing payment.");
    }
  }

  function formatDate(value: string | null) {
    if (!value) return "—";

    return new Date(value).toLocaleString();
  }

  return (
    <>
      {advertisements.filter((ad) => ad.status === "approved").length > 0 && (
        <div className="mx-auto mb-4 w-full max-w-lg space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
            Approved Promotions
          </p>

          {advertisements
            .filter((ad) => ad.status === "approved")
            .map((ad) => (
              <div
                key={ad.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                {ad.logo ? (
                  <img
                    src={ad.logo}
                    alt={ad.token_name}
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xs font-black">
                    {ad.token_symbol?.slice(0, 4) || "AD"}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">
                    {ad.token_name}
                    {ad.token_symbol ? ` · ${ad.token_symbol}` : ""}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    Approved — Payment Required
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openPayment(ad)}
                  disabled={!paymentsEnabled || (!usdcEnabled && !rflxEnabled)}
                  className="shrink-0 rounded-xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#64122b] disabled:opacity-40"
                >
                  Continue to Payment
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="flex justify-center py-2">
        <button
          type="button"
          onClick={async () => {
            setOpen(true);
            setMessage("");
          }}
          className="relative z-20 cursor-pointer animate-pulse text-[11px] font-black uppercase tracking-[0.16em] text-red-300 transition hover:text-red-200"
        >
          For promotion, contact us →
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/90 p-4 sm:p-6">
          <div className="my-8 w-full max-w-lg rounded-3xl border border-white/15 bg-[#1b050c] p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                  Promote a Token
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Advertising Request
                </h2>

                <p className="mt-2 text-xs leading-5 text-white/65">
                  Submit your token for review. Approval is required before
                  payment and activation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            {adsLoading ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <p className="text-sm font-bold text-white/70">
                  Loading advertising availability...
                </p>
              </div>
            ) : !adsEnabled ? (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/[0.06] p-5 text-center">
                <p className="text-sm font-bold text-white">
                  Advertising is currently unavailable.
                </p>
                <p className="mt-2 text-xs leading-5 text-white/55">
                  Promotion submissions are temporarily closed. Please check back later.
                </p>
              </div>
            ) : (
              <form onSubmit={submitRequest} className="mt-6 space-y-4">
              <input
                required
                placeholder="Token name"
                value={form.token_name}
                onChange={(e) =>
                  setForm({ ...form, token_name: e.target.value })
                }
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/30"
              />

              <input
                required
                placeholder="Logo URL"
                value={form.logo}
                onChange={(e) =>
                  setForm({ ...form, logo: e.target.value })
                }
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/30"
              />

              <input
                required
                placeholder="Ticker / Symbol"
                value={form.token_symbol}
                onChange={(e) =>
                  setForm({ ...form, token_symbol: e.target.value })
                }
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/30"
              />

              <input
                required
                placeholder="Contract Address (CA)"
                value={form.token_address}
                onChange={(e) =>
                  setForm({ ...form, token_address: e.target.value })
                }
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/30"
              />

              <textarea
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={4}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/30"
              />

              {message && (
                <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-white/60">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#64122b] transition hover:bg-white/90 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit for Review"}
              </button>
              </form>
            )}
          </div>
        </div>
      )}

      {paymentOpen && selectedAd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/85 p-4">
          <div className="my-8 w-full max-w-lg rounded-3xl border border-white/15 bg-[#1b050c] p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                  Advertising Payment
                </p>

                <h2 className="mt-2 text-xl font-black">
                  {selectedAd.token_name}
                </h2>

                <p className="mt-2 text-xs leading-5 text-white/65">
                  Select the approved promotion duration and payment
                  currency. The advertisement activates only after the exact
                  payment is verified.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPaymentOpen(false)}
                className="rounded-lg px-2 py-1 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            {!payment && (
              <div className="mt-6 space-y-5">
                <div>
                  <p className="mb-2 text-xs font-bold text-white/60">
                    Promotion duration
                  </p>

                  <div className="grid gap-2">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className={`rounded-xl border px-4 py-3 text-left transition ${
                          selectedPackageId === pkg.id
                            ? "border-white/30 bg-white/[0.08]"
                            : "border-white/[0.08] bg-black/20 hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex justify-between gap-4">
                          <span className="text-sm font-bold">
                            {pkg.name}
                          </span>

                          <span className="text-xs text-white/50">
                            {pkg.price_usdc} USDC
                          </span>
                        </div>

                        <p className="mt-1 text-[10px] text-white/35">
                          {pkg.duration_days} day
                          {pkg.duration_days === 1 ? "" : "s"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold text-white/60">
                    Payment currency
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {usdcEnabled && (
                      <button
                        type="button"
                        onClick={() => setSelectedCurrency("USDC")}
                        className={`rounded-xl border px-4 py-3 text-xs font-bold ${
                          selectedCurrency === "USDC"
                            ? "border-white/30 bg-white/[0.08]"
                            : "border-white/[0.08] bg-black/20"
                        }`}
                      >
                        USDC
                      </button>
                    )}

                    {rflxEnabled && (
                      <button
                        type="button"
                        onClick={() => setSelectedCurrency("RFLX")}
                        className={`rounded-xl border px-4 py-3 text-xs font-bold ${
                          selectedCurrency === "RFLX"
                            ? "border-white/30 bg-white/[0.08]"
                            : "border-white/[0.08] bg-black/20"
                        }`}
                      >
                        RFLX
                      </button>
                    )}
                  </div>

                  {selectedCurrency === "RFLX" &&
                    rflxDiscountPercent > 0 && (
                      <p className="mt-2 text-[10px] text-white/35">
                        RFLX payments use the Admin-configured{" "}
                        {rflxDiscountPercent}% discount.
                      </p>
                    )}
                </div>

                {paymentMessage && (
                  <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-white/60">
                    {paymentMessage}
                  </p>
                )}

                <button
                  type="button"
                  disabled={
                    creatingPayment ||
                    !selectedPackageId ||
                    !paymentsEnabled ||
                    (!usdcEnabled && !rflxEnabled)
                  }
                  onClick={createPayment}
                  className="w-full rounded-xl bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-[#64122b] disabled:opacity-50"
                >
                  {creatingPayment
                    ? "Preparing Payment..."
                    : "Create Payment"}
                </button>
              </div>
            )}

            {payment && (
              <div className="mt-6 space-y-5">
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/35">
                    Exact amount
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {payment.amount} {payment.currency}
                  </p>

                  <p className="mt-4 text-[10px] uppercase tracking-wider text-white/35">
                    Receiving wallet
                  </p>

                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-3">
                    <p className="min-w-0 flex-1 break-all text-xs font-bold text-emerald-200">
                      {payment.receivingWallet}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          payment.receivingWallet
                        )
                      }
                      className="shrink-0 rounded-lg bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#64122b]"
                    >
                      Copy
                    </button>
                  </div>

                  <p className="mt-4 text-[10px] uppercase tracking-wider text-white/35">
                    Payment reference
                  </p>

                  <p className="mt-2 break-all text-xs text-white/70">
                    {payment.reference}
                  </p>
                </div>

                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04] p-4 text-xs leading-5 text-yellow-100/70">
                  Send the exact amount shown above on Solana to the receiving
                  wallet. The advertisement will not activate until the
                  transaction is successfully verified.
                </div>

                <input
                  placeholder="Paste Solana transaction signature"
                  value={payment.transactionSignature}
                  onChange={(e) =>
                    setPayment({
                      ...payment,
                      transactionSignature: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-xs text-white placeholder:text-white/45 outline-none focus:border-white/30"
                />

                {paymentMessage && (
                  <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-white/60">
                    {paymentMessage}
                  </p>
                )}

                <button
                  type="button"
                  disabled={verifyingPayment}
                  onClick={verifyPayment}
                  className="w-full rounded-xl bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-[#64122b] disabled:opacity-50"
                >
                  {verifyingPayment
                    ? "Verifying Payment..."
                    : "Verify Payment"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
