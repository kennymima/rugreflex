"use client";
import RugReflexNav from "@/app/components/RugReflexNav";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ReferralProfile = {
  user_id: string;
  referral_code: string;
  total_referrals: number;
  successful_referrals: number;
  scans_earned: number;
  created_at: string;
  updated_at: string;
};

type ReferralRecord = {
  id: string;
  referred_user_id: string;
  status: string;
  reward_scans: number;
  reward_granted: boolean;
  created_at: string;
  completed_at: string | null;
};

export default function ReferralsPage() {
  const supabase = createClient();

  const [profile, setProfile] =
    useState<ReferralProfile | null>(null);
  const [referrals, setReferrals] =
    useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReferralData() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoggedIn(false);
          return;
        }

        setLoggedIn(true);

        const response =
          await fetch("/api/referrals");

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ||
              "Unable to load referral information."
          );
        }

        setProfile(result.profile ?? null);

        setReferrals(
          Array.isArray(result.referrals)
            ? result.referrals
            : []
        );
      } catch (err) {
        console.error(
          "Referral page error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load referral information."
        );
      } finally {
        setLoading(false);
      }
    }

    loadReferralData();
  }, []);

  async function copyReferralLink() {
    if (!profile) return;

    const link =
      `${window.location.origin}/auth?ref=${profile.referral_code}`;

    try {
      await navigator.clipboard.writeText(link);

      setCopied(true);

      setTimeout(
        () => setCopied(false),
        2500
      );
    } catch (err) {
      console.error(
        "Referral link copy failed:",
        err
      );
    }
  }

  const referralLink =
    profile
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${profile.referral_code}`
      : "";

  return (
    <>
    <RugReflexNav />

      <main className="min-h-screen bg-[#100308] text-white">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">

        

        <section className="rounded-[28px] border border-white/[0.08] bg-[#250711]/80 p-8 sm:p-12">

          <div className="text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9f2348]/15 text-xl">
              ↗
            </div>

            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e89ab2]">
              RugReflex Growth
            </p>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
              Refer & Earn
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
              Invite people to RugReflex and earn additional
              scan rewards as the community grows.
            </p>
          </div>

          {loading && (
            <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-center">
              <p className="text-sm font-semibold text-white/60">
                Loading referral system...
              </p>
            </div>
          )}

          {!loading && !loggedIn && (
            <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-[#9f2348]/30 bg-[#9f2348]/10 p-8 text-center">
              <p className="text-lg font-bold">
                Create your RugReflex account
              </p>

              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/45">
                You need an account before you can receive
                your unique referral link and track rewards.
              </p>

              <Link
                href="/auth"
                className="mt-6 inline-flex rounded-xl bg-[#9f2348] px-6 py-3 text-xs font-black tracking-wide text-white transition hover:bg-[#b52a53]"
              >
                CREATE ACCOUNT
              </Link>
            </div>
          )}

          {!loading && loggedIn && profile && (
            <>
              <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                    Total Referrals
                  </p>

                  <p className="mt-3 text-3xl font-black">
                    {profile.total_referrals}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                    Successful
                  </p>

                  <p className="mt-3 text-3xl font-black">
                    {profile.successful_referrals}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                    Scans Earned
                  </p>

                  <p className="mt-3 text-3xl font-black text-[#e89ab2]">
                    {profile.scans_earned}
                  </p>
                </div>

              </div>

              <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[#9f2348]/25 bg-[#9f2348]/10 p-6">

                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e89ab2]">
                  Your Referral Code
                </p>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1 rounded-xl border border-white/[0.08] bg-black/20 px-4 py-4">
                    <p className="text-xl font-black tracking-[0.18em]">
                      {profile.referral_code}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={copyReferralLink}
                    className="rounded-xl bg-[#9f2348] px-6 py-4 text-xs font-black tracking-wide transition hover:bg-[#b52a53]"
                  >
                    {copied
                      ? "✓ LINK COPIED"
                      : "COPY REFERRAL LINK"}
                  </button>
                </div>

                <p className="mt-4 break-all text-[11px] text-white/30">
                  {referralLink}
                </p>

              </div>

              <div className="mx-auto mt-8 max-w-3xl">

                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                      Referral Activity
                    </p>

                    <h2 className="mt-1 text-lg font-bold">
                      Your referrals
                    </h2>
                  </div>
                </div>

                {referrals.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-7 text-center">
                    <p className="text-sm font-semibold text-white/60">
                      No referrals yet.
                    </p>

                    <p className="mt-2 text-xs text-white/30">
                      Share your referral link to start
                      growing the RugReflex community.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrals.map(
                      (referral, index) => (
                        <div
                          key={referral.id}
                          className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-xs font-bold">
                              Referral #{referrals.length - index}
                            </p>

                            <p className="mt-1 text-[10px] text-white/30">
                              {new Date(
                                referral.created_at
                              ).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-xs font-bold uppercase text-[#e89ab2]">
                              {referral.status}
                            </p>

                            <p className="mt-1 text-[10px] text-white/30">
                              +{referral.reward_scans} scan
                              {referral.reward_scans === 1
                                ? ""
                                : "s"} reward
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

              </div>
            </>
          )}

          {error && (
            <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-center">
              <p className="text-xs font-semibold text-red-200">
                {error}
              </p>
            </div>
          )}

          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold">
                  INVITE
                </p>

                <p className="mt-1 text-[10px] leading-5 text-white/30">
                  Share your unique RugReflex referral link.
                </p>
              </div>

              <div>
                <p className="text-xs font-bold">
                  GROW
                </p>

                <p className="mt-1 text-[10px] leading-5 text-white/30">
                  New users join through your invitation.
                </p>
              </div>

              <div>
                <p className="text-xs font-bold">
                  EARN
                </p>

                <p className="mt-1 text-[10px] leading-5 text-white/30">
                  Successful referrals can earn additional
                  scan rewards.
                </p>
              </div>
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-[10px] leading-5 text-white/20">
            Referral rewards are subject to RugReflex program
            rules and may change as the platform develops.
          </p>

        </section>
      </div>
    </main>
    </>
  );
}
