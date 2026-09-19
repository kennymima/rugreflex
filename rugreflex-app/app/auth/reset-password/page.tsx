"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    async function checkRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setHasSession(Boolean(session));
      setCheckingSession(false);
    }

    checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setHasSession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!hasSession) {
      setError("This password reset link is invalid or has expired.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully. Redirecting...");

    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1000);
  }

  return (
    <main className="min-h-screen bg-[#16070d] px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <section className="w-full rounded-2xl border border-red-500/20 bg-[#230b14] p-8 shadow-2xl shadow-black/30">
          <div className="mb-8 text-center">
            <div className="mb-3 text-2xl font-black tracking-[0.25em] text-red-400">
              RUGREFLEX
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-200/60">
              Reset Your Password
            </p>
          </div>

          {checkingSession ? (
            <div className="rounded-xl border border-red-500/20 bg-black/20 px-4 py-4 text-center text-sm text-red-200/70">
              VERIFYING RESET LINK...
            </div>
          ) : !hasSession ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                This password reset link is invalid or has expired.
              </div>

              <button
                type="button"
                onClick={() => router.push("/auth?mode=forgot")}
                className="w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-red-600"
              >
                REQUEST NEW RESET LINK
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-red-200/70">
                  New Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-red-500/20 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-red-100/30 focus:border-red-400/50"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-red-200/70">
                  Confirm New Password
                </label>

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-red-500/20 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-red-100/30 focus:border-red-400/50"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-bold tracking-wide text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "UPDATING..." : "UPDATE PASSWORD"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs leading-5 text-red-100/40">
            RugReflex provides observed blockchain and market risk analysis.
            Scores and signals are not guarantees of safety, future performance
            or token outcomes. Always conduct your own research.
          </p>
        </section>
      </div>
    </main>
  );
}
