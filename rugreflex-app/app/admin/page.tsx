"use client";

import { useEffect, useState } from "react";

type Settings = {
  pro_enabled: boolean;
  ads_enabled: boolean;
  payments_enabled: boolean;
  usdc_enabled: boolean;
  rflx_enabled: boolean;
  rflx_discount_percent: number;
};

type Plan = {
  id: number;
  name: string;
  price_usdc: number;
  duration_days: number;
  active: boolean;
};

type PaymentConfig = {
  id: number;
  currency: string;
  enabled: boolean;
  network: string;
  receiving_wallet: string | null;
};

type AdPackage = {
  id: number;
  name: string;
  duration_days: number;
  price_usdc: number;
  active: boolean;
};

type Overview = {
  totalUsers: number;
  activeProUsers: number;
  expiredProUsers: number;
  pendingAdvertisements: number;
  activeAdvertisements: number;
  paymentRecords: number;
};

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  pro_status: string;
  pro_expires_at: string | null;
  payment_currency: string | null;
  is_admin: boolean;
  role: string | null;
};


const toggleLabels: Array<{
  key: keyof Settings;
  label: string;
}> = [
  { key: "pro_enabled", label: "PRO" },
  { key: "ads_enabled", label: "ADS" },
  { key: "payments_enabled", label: "PAYMENTS" },
  { key: "usdc_enabled", label: "USDC" },
  { key: "rflx_enabled", label: "RFLX" },
];

export default function AdminPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig[]>([]);
  const [adPackages, setAdPackages] = useState<AdPackage[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadAdmin() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load admin panel");
      }

      setSettings(data.settings);
      setPlans(data.plans || []);
      setPaymentConfig(data.paymentConfig || []);
      setAdPackages(data.adPackages || []);

      const usersResponse = await fetch("/api/admin/users", {
        cache: "no-store",
      });
      const usersData = await usersResponse.json();

      if (!usersResponse.ok) {
        throw new Error(usersData.error || "Failed to load users");
      }

      setUsers(usersData.users || []);

      const overviewResponse = await fetch("/api/admin/overview", {
        cache: "no-store",
      });
      const overviewData = await overviewResponse.json();

      if (!overviewResponse.ok) {
        throw new Error(
          overviewData.error || "Failed to load platform overview"
        );
      }

      setOverview(overviewData);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin panel");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmin();
  }, []);

  async function updateSetting(key: keyof Settings, value: boolean) {
    if (!settings) return;

    setSaving(key);
    setError("");

    const previous = settings[key];

    setSettings({
      ...settings,
      [key]: value,
    });

    try {
      const response = await fetch("/api/admin", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [key]: value }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update setting");
      }

      setSettings(data.settings);
    } catch (err) {
      setSettings({
        ...settings,
        [key]: previous,
      });

      setError(err instanceof Error ? err.message : "Failed to update setting");
    } finally {
      setSaving(null);
    }
  }

  async function updateProPlan(
    id: number,
    field: "price_usdc" | "active",
    value: number | boolean
  ) {
    setSaving(`pro-${id}-${field}`);
    setError("");

    try {
      const response = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proPlan: {
            id,
            [field]: value,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update Pro plan");
      }

      setPlans((current) =>
        current.map((plan) =>
          plan.id === id ? { ...plan, ...data.plan } : plan
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update Pro plan");
    } finally {
      setSaving(null);
    }
  }

  async function updateAdPackage(
    id: number,
    field: "price_usdc" | "active",
    value: number | boolean
  ) {
    setSaving(`ad-${id}-${field}`);
    setError("");

    try {
      const response = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adPackage: {
            id,
            [field]: value,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update advertisement package");
      }

      setAdPackages((current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...data.adPackage } : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update advertisement package"
      );
    } finally {
      setSaving(null);
    }
  }

  async function updatePaymentConfig(
    currency: string,
    field: "enabled" | "receiving_wallet",
    value: boolean | string
  ) {
    setSaving(`payment-${currency}-${field}`);
    setError("");

    try {
      const response = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentConfig: {
            currency,
            [field]: value,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update payment configuration");
      }

      setPaymentConfig((current) =>
        current.map((item) =>
          item.currency === currency ? { ...item, ...data.paymentConfig } : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update payment configuration"
      );
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-400">Loading Admin Control Center...</p>
        </div>
      </main>
    );
  }

  if (error && !settings) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-red-900 bg-red-950/30 p-6">
            <h1 className="text-xl font-semibold">Admin Access</h1>
            <p className="mt-2 text-red-300">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-red-400">
            RugReflex Control Center
          </p>
          <h1 className="mt-2 text-3xl font-bold">Admin Panel</h1>
          <p className="mt-2 text-zinc-400">
            Manage platform availability and commercial configuration.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Platform Overview</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Total Users", overview?.totalUsers ?? 0],
              ["Active Pro Users", overview?.activeProUsers ?? 0],
              ["Expired Pro", overview?.expiredProUsers ?? 0],
              ["Pending Ads", overview?.pendingAdvertisements ?? 0],
              ["Active Ads", overview?.activeAdvertisements ?? 0],
              ["Payment Records", overview?.paymentRecords ?? 0],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
              >
                <p className="text-sm text-zinc-500">{label}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Global Feature Controls</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {toggleLabels.map(({ key, label }) => {
              const enabled = Boolean(settings?.[key]);

              return (
                <div
                  key={key}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{label}</p>
                      <p
                        className={`mt-1 text-xs ${
                          enabled ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {enabled ? "ENABLED" : "DISABLED"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={saving === key}
                      onClick={() => updateSetting(key, !enabled)}
                      className={`relative h-7 w-12 rounded-full transition ${
                        enabled ? "bg-red-600" : "bg-zinc-700"
                      } disabled:opacity-50`}
                      aria-label={`Toggle ${label}`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                          enabled ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-lg font-semibold">Pro Plans</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Configure subscription duration, pricing and availability.
            </p>

            <div className="mt-5 space-y-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-zinc-800 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-zinc-500">
                        {plan.duration_days} days
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={saving === `pro-${plan.id}-active`}
                      onClick={() =>
                        updateProPlan(plan.id, "active", !plan.active)
                      }
                      className={`rounded-full px-3 py-1 text-xs ${
                        plan.active
                          ? "bg-emerald-950 text-emerald-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {plan.active ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </div>

                  <div className="mt-4 flex items-end gap-3">
                    <label className="flex-1">
                      <span className="mb-1 block text-xs text-zinc-500">
                        USDC Price
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={plan.price_usdc}
                        onBlur={(e) =>
                          updateProPlan(
                            plan.id,
                            "price_usdc",
                            Number(e.target.value)
                          )
                        }
                        className="w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm outline-none focus:border-red-600"
                      />
                    </label>

                    <span className="pb-2 text-xs text-zinc-500">
                      USDC
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-between border-t border-zinc-800 pt-4 text-sm">
              <span className="text-zinc-400">RFLX Discount</span>
              <span>{settings?.rflx_discount_percent}%</span>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-lg font-semibold">Advertisement Packages</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Configure daily, weekly and monthly promotion fees.
            </p>

            <div className="mt-5 space-y-4">
              {adPackages.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-zinc-800 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-zinc-500">
                        {item.duration_days} day
                        {item.duration_days === 1 ? "" : "s"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={saving === `ad-${item.id}-active`}
                      onClick={() =>
                        updateAdPackage(item.id, "active", !item.active)
                      }
                      className={`rounded-full px-3 py-1 text-xs ${
                        item.active
                          ? "bg-emerald-950 text-emerald-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {item.active ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </div>

                  <div className="mt-4 flex items-end gap-3">
                    <label className="flex-1">
                      <span className="mb-1 block text-xs text-zinc-500">
                        USDC Price
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={item.price_usdc}
                        onBlur={(e) =>
                          updateAdPackage(
                            item.id,
                            "price_usdc",
                            Number(e.target.value)
                          )
                        }
                        className="w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm outline-none focus:border-red-600"
                      />
                    </label>

                    <span className="pb-2 text-xs text-zinc-500">
                      USDC
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-semibold">Payment Configuration</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Configure the Solana receiving wallets used for verified payments.
          </p>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {paymentConfig.map((payment) => (
              <div
                key={payment.id}
                className="rounded-xl border border-zinc-800 p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{payment.currency}</p>
                    <p className="text-xs text-zinc-500">
                      Network: {payment.network || "Solana"}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={saving === `payment-${payment.currency}-enabled`}
                    onClick={() =>
                      updatePaymentConfig(
                        payment.currency,
                        "enabled",
                        !payment.enabled
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs ${
                      payment.enabled
                        ? "bg-emerald-950 text-emerald-400"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {payment.enabled ? "ENABLED" : "DISABLED"}
                  </button>
                </div>

                <label className="mt-5 block">
                  <span className="mb-2 block text-xs text-zinc-500">
                    Solana Receiving Wallet
                  </span>
                  <input
                    type="text"
                    defaultValue={payment.receiving_wallet || ""}
                    placeholder="Paste Solana receiving wallet address"
                    onBlur={(e) =>
                      updatePaymentConfig(
                        payment.currency,
                        "receiving_wallet",
                        e.target.value.trim()
                      )
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-black px-3 py-3 text-sm outline-none focus:border-red-600"
                  />
                </label>

                <p className="mt-2 text-xs text-zinc-600">
                  This address will be used by the payment system for
                  transaction verification.
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-semibold">User Management</h2>
          <p className="mt-1 text-sm text-zinc-500">
            View registered users, account status and Pro subscription status.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Registered</th>
                  <th className="px-3 py-3">Last Sign In</th>
                  <th className="px-3 py-3">Pro Status</th>
                  <th className="px-3 py-3">Expires</th>
                  <th className="px-3 py-3">Payment</th>
                  <th className="px-3 py-3">Account</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-900">
                    <td className="px-3 py-4">
                      <div className="font-medium">{user.email || "No email"}</div>
                      {user.is_admin && (
                        <span className="text-xs text-red-400">
                          {user.role || "admin"}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-4 text-zinc-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-3 py-4 text-zinc-400">
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleDateString()
                        : "Never"}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={
                          user.pro_status === "active"
                            ? "text-emerald-400"
                            : user.pro_status === "expired"
                              ? "text-amber-400"
                              : "text-zinc-500"
                        }
                      >
                        {user.pro_status.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-3 py-4 text-zinc-400">
                      {user.pro_expires_at
                        ? new Date(user.pro_expires_at).toLocaleDateString()
                        : "—"}
                    </td>

                    <td className="px-3 py-4 text-zinc-400">
                      {user.payment_currency || "—"}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={
                          user.email_confirmed_at
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }
                      >
                        {user.email_confirmed_at ? "VERIFIED" : "UNVERIFIED"}
                      </span>
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-zinc-500"
                    >
                      No registered users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-semibold">Admin Modules</h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Platform Overview",
              "User Management",
              "Pro Management",
              "Payment Management",
              "Advertisement Management",
              "Feature Toggles",
              "System Configuration",
            ].map((module) => (
              <div
                key={module}
                className="rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-300"
              >
                {module}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
