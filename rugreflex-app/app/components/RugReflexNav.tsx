"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AuthGateModal from "./AuthGateModal";

export default function RugReflexNav() {
  const [authenticated, setAuthenticated] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateFeature, setGateFeature] = useState("this feature");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setAuthenticated(Boolean(data.user));
    });
  }, []);

  const openGate = (feature: string) => {
    setGateFeature(feature);
    setGateOpen(true);
  };

  return (
    <>
    <nav className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#100308]/85 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-[#64122b] shadow-lg shadow-black/20">
            R
          </div>

          <div>
            <p className="text-sm font-black tracking-[0.08em]">RUGREFLEX</p>
            <p className="hidden text-[9px] uppercase tracking-[0.22em] text-white/35 sm:block">
              Token Risk Intelligence
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
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

          {authenticated ? (
            <Link href="/chat" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
              AI Chat
            </Link>
          ) : (
            <button type="button" onClick={() => openGate("AI Chat")} className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
              AI Chat
            </button>
          )}

          <Link href="/history" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
            History
          </Link>

          <Link href="/referrals" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white">
            Referrals
          </Link>

          <Link href="/pro" className="rounded-lg px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/[0.08] hover:text-red-200">
            Pro
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {authenticated ? (
            <Link href="/dashboard" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white/80 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white">
              Account
            </Link>
          ) : (
            <>
              <Link href="/auth?mode=login" className="rounded-xl px-3 py-2 text-xs font-semibold text-white/55 transition hover:text-white">
                Log in
              </Link>

              <Link href="/auth?mode=signup" className="rounded-xl bg-white px-4 py-2 text-xs font-black text-[#64122b] transition hover:bg-white/90">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>

    <AuthGateModal
      open={gateOpen}
      onClose={() => setGateOpen(false)}
      feature={gateFeature}
    />
    </>
  );
}
