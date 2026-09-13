"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const REFERRAL_COOKIE = "rugreflex_referral";
const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setReferralCookie(code: string) {
  document.cookie =
    `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; ` +
    `max-age=${REFERRAL_COOKIE_MAX_AGE}; ` +
    `path=/; ` +
    `samesite=lax`;
}

function getReferralCookie() {
  const cookies = document.cookie.split("; ");

  const match = cookies.find((cookie) =>
    cookie.startsWith(`${REFERRAL_COOKIE}=`)
  );

  if (!match) {
    return "";
  }

  const value = match.slice(
    `${REFERRAL_COOKIE}=`.length
  );

  try {
    return decodeURIComponent(value)
      .trim()
      .toUpperCase();
  } catch {
    return value.trim().toUpperCase();
  }
}

function clearReferralCookie() {
  document.cookie =
    `${REFERRAL_COOKIE}=; ` +
    `max-age=0; ` +
    `path=/; ` +
    `samesite=lax`;
}

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] =
    useState<"login" | "signup">("login");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [referralCode, setReferralCode] =
    useState("");

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const ref = params.get("ref");

    if (ref) {
      const normalizedRef =
        ref.trim().toUpperCase();

      if (normalizedRef) {
        setReferralCode(normalizedRef);
        setReferralCookie(normalizedRef);
        setMode("signup");
      }
    }

    async function processPendingReferral() {
      const storedCode =
        getReferralCookie();

      if (!storedCode) {
        return;
      }

      const {
        data: {
          session,
        },
      } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      await processReferral();
    }

    processPendingReferral();
  }, []);

  async function processReferral() {
    const storedReferralCode =
      referralCode ||
      getReferralCookie();

    if (!storedReferralCode) {
      return {
        success: true,
        processed: false,
      };
    }

    try {
      const response =
        await fetch("/api/referrals", {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            referralCode:
              storedReferralCode,
          }),
        });

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        console.warn(
          "Referral could not be recorded:",
          result.error
        );

        return {
          success: false,
          processed: false,
          error:
            result.error ||
            "Referral could not be recorded.",
        };
      }

      clearReferralCookie();

      return {
        success: true,
        processed: true,
      };
    } catch (referralError) {
      console.warn(
        "Referral processing failed:",
        referralError
      );

      return {
        success: false,
        processed: false,
        error:
          "Referral processing failed.",
      };
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    if (mode === "signup") {
      const redirectUrl =
        `${window.location.origin}/auth/callback`;

      const { data, error } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        const referralResult =
          await processReferral();

        if (
          referralResult.processed
        ) {
          setMessage(
            "Account created successfully. Your referral reward has been recorded."
          );
        }

        router.push("/");
        router.refresh();
        return;
      }

      setMessage(
        referralCode ||
        getReferralCookie()
          ? "Account created. Please check your email to confirm your account. Your referral code has been saved and will be processed when you sign in."
          : "Account created. Please check your email to confirm your account."
      );

      setLoading(false);
      return;
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      await processReferral();
    }

    router.push("/");
    router.refresh();
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
              Token Risk Intelligence
            </p>
          </div>

          <div className="mb-6 flex rounded-xl border border-red-500/20 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
                setError("");
              }}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-red-700 text-white"
                  : "text-red-200/60 hover:text-white"
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMessage("");
                setError("");
              }}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                mode === "signup"
                  ? "bg-red-700 text-white"
                  : "text-red-200/60 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          {referralCode && (
            <div className="mb-5 rounded-xl border border-red-400/20 bg-red-950/30 px-4 py-3 text-center text-xs text-red-200">
              Referral code detected:
              <span className="ml-1 font-bold text-white">
                {referralCode}
              </span>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-red-200/70">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
                autoComplete="email"
                className="w-full rounded-xl border border-red-500/20 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-red-100/30 focus:border-red-400/50"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-red-200/70">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
                minLength={6}
                autoComplete={
                  mode === "signup"
                    ? "new-password"
                    : "current-password"
                }
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
              {loading
                ? "PLEASE WAIT..."
                : mode === "signup"
                  ? "CREATE ACCOUNT"
                  : "SIGN IN"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-red-100/40">
            RugReflex provides observed blockchain
            and market risk analysis. Scores and
            signals are not guarantees of safety,
            future performance or token outcomes.
            Always conduct your own research.
          </p>
        </section>
      </div>
    </main>
  );
}
