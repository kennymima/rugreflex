"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthGateModal from "./AuthGateModal";
import PromotionSubHeader from "./PromotionSubHeader";

export default function RugReflexNav() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateFeature, setGateFeature] = useState("this feature");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setAuthenticated(Boolean(data.user));
      setAuthLoading(false);
    });
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session?.user));
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const openGate = (feature: string) => {
    setGateFeature(feature);
    setGateOpen(true);
  };

  const handleLogout = async () => {
    setLoggingOut(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    window.location.href = "/";
  };

  return (
    <>
    <nav className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#100308]/85 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <div className="flex h-10 shrink-0 items-center sm:h-11">
            <img
              src="/rugreflex-logo.png"
              alt="RugReflex"
              className="block h-10 w-auto max-w-[64px] object-contain sm:h-11 sm:max-w-[72px]"
            />
          </div>

          <div>
            <p className="text-sm font-black tracking-[0.08em]">RUGREFLEX</p>
            <p className="hidden text-[9px] uppercase tracking-[0.22em] text-white/35 sm:block">
              Token Risk Intelligence
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 xl:flex">
          <Link href="/" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
            Home
          </Link>

          <Link href="/scan" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
            Scanner
          </Link>

          {authenticated ? (
            <Link href="/radar" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
              Alpha Radar
            </Link>
          ) : (
            <button type="button" onClick={() => openGate("Alpha Radar")} className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
              Alpha Radar
            </button>
          )}

          <Link href="/wallet" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
            Wallet Intelligence
          </Link>

          <Link href="/history" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
            History
          </Link>

          <Link href="/referrals" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
            Referrals
          </Link>

          {authenticated ? (
            <Link href="/chat" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
              RugReflex Assist
            </Link>
          ) : (
            <button type="button" onClick={() => openGate("RugReflex Assist")} className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
              RugReflex Assist
            </button>
          )}

          <Link href="/pro" className="rounded-lg px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/[0.08] hover:text-red-200">
            Pro
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/[0.08] hover:text-white xl:hidden"
          >
            <span className="text-lg leading-none">{mobileMenuOpen ? "×" : "☰"}</span>
          </button>
          {authLoading ? null : authenticated ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white/80 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
              >
                Account
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-white/55 transition hover:text-white disabled:opacity-50"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth?mode=login"
                className="rounded-xl px-3 py-2 text-xs font-semibold text-white/55 transition hover:text-white"
              >
                Log in
              </Link>

              <Link
                href="/auth?mode=signup"
                className="rounded-xl bg-white px-4 py-2 text-xs font-black text-[#64122b] transition hover:bg-white/90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>

    {mobileMenuOpen && (
      <div className="border-b border-white/[0.07] bg-[#100308]/95 px-5 py-4 xl:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-1">
          <Link href="/" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/[0.05] hover:text-white">
            Home
          </Link>
          <Link href="/scan" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/[0.05] hover:text-white">
            Scanner
          </Link>
          <Link href="/radar" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/[0.05] hover:text-white">
            Alpha Radar
          </Link>
          <Link href="/wallet" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/[0.05] hover:text-white">
            Wallet Intelligence
          </Link>
          <Link href="/history" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/[0.05] hover:text-white">
            History
          </Link>
          <Link href="/referrals" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/[0.05] hover:text-white">
            Referrals
          </Link>
          <Link href="/chat" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/[0.05] hover:text-white">
            Assist
          </Link>
          <Link href="/pro" onClick={() => setMobileMenuOpen(false)} className="mt-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white hover:bg-white/[0.08]">
            Pro
          </Link>
        </div>
      </div>
    )}

    <PromotionSubHeader />

    <AuthGateModal
      open={gateOpen}
      onClose={() => setGateOpen(false)}
      feature={gateFeature}
    />
    </>
  );
}
