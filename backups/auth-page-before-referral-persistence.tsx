"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] =
    useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const ref = params.get("ref");

    if (ref) {
      setReferralCode(
        ref.trim().toUpperCase()
      );
      setMode("signup");
    }
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    if (mode === "signup") {
      const { data, error } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data.user && referralCode) {
        try {
          const referralResponse =
            await fetch("/api/referrals", {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                referralCode,
              }),
            });

          const referralResult =
            await referralResponse.json();

          if (
            !referralResponse.ok ||
            !referralResult.success
          ) {
            console.warn(
              "Referral could not be recorded:",
              referralResult.error
            );
          }
        } catch (referralError) {
          console.warn(
            "Referral processing failed:",
            referralError
          );
        }
      }

      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }

      setMessage(
        referralCode
          ? "Account created. Please check your email to confirm your account. Your referral has been recorded."
          : "Account created. Please check your email to confirm your account."
      );
    } else {
      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
      return;
    }

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "440px",
          padding: "32px",
          borderRadius: "20px",
          border:
            "1px solid rgba(128, 0, 32, 0.25)",
        }}
      >
        <div
          style={{
            marginBottom: "28px",
          }}
        >
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              marginBottom: "8px",
            }}
          >
            RUGREFLEX
          </h1>

          <p>
            Solana Token Risk Intelligence
          </p>
        </div>

        {referralCode && (
          <div
            style={{
              marginBottom: "20px",
              padding: "14px",
              borderRadius: "12px",
              border:
                "1px solid rgba(159, 35, 72, 0.35)",
              background:
                "rgba(159, 35, 72, 0.10)",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              Referral Invitation
            </p>

            <p
              style={{
                marginTop: "6px",
                fontSize: "13px",
                opacity: 0.65,
              }}
            >
              You were invited to RugReflex
              with referral code{" "}
              <strong>
                {referralCode}
              </strong>
            </p>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "24px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border:
                "1px solid currentColor",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              setMessage("");
            }}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border:
                "1px solid currentColor",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Create Account
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              required
              autoComplete="email"
              placeholder="you@example.com"
              style={{
                width: "100%",
                marginTop: "6px",
                padding: "13px",
                borderRadius: "10px",
                border:
                  "1px solid #999",
              }}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              required
              minLength={6}
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              placeholder="Minimum 6 characters"
              style={{
                width: "100%",
                marginTop: "6px",
                padding: "13px",
                borderRadius: "10px",
                border:
                  "1px solid #999",
              }}
            />
          </label>

          {error && (
            <p
              role="alert"
              style={{
                padding: "12px",
                borderRadius: "10px",
              }}
            >
              {error}
            </p>
          )}

          {message && (
            <p
              role="status"
              style={{
                padding: "12px",
                borderRadius: "10px",
              }}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              border: "none",
              cursor: loading
                ? "not-allowed"
                : "pointer",
              fontWeight: 800,
              fontSize: "16px",
            }}
          >
            {loading
              ? "PLEASE WAIT..."
              : mode === "login"
              ? "LOGIN TO RUGREFLEX"
              : "CREATE RUGREFLEX ACCOUNT"}
          </button>
        </form>
      </section>
    </main>
  );
}
