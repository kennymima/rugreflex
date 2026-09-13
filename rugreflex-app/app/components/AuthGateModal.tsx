"use client";

import Link from "next/link";

type Props = {
  open: boolean;
  onClose: () => void;
  feature: string;
};

export default function AuthGateModal({ open, onClose, feature }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-5 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-red-400/20 bg-[#1b070f] p-7 shadow-2xl shadow-black/50">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-red-400">
              RUGREFLEX
            </div>
            <h2 className="text-2xl font-black text-white">
              Unlock {feature}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl text-white/40 transition hover:bg-white/5 hover:text-white"
          >
            ×
          </button>
        </div>

        <p className="mb-6 text-sm leading-6 text-white/55">
          Create a free RugReflex account to access {feature}, intelligence
          tools and your personal workspace.
        </p>

        <div className="space-y-3">
          <Link
            href="/auth?mode=signup"
            onClick={onClose}
            className="block w-full rounded-xl bg-red-700 px-5 py-3.5 text-center text-sm font-black text-white transition hover:bg-red-600"
          >
            CREATE FREE ACCOUNT
          </Link>

          <Link
            href="/auth?mode=login"
            onClick={onClose}
            className="block w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-center text-sm font-bold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
          >
            SIGN IN
          </Link>
        </div>

        <p className="mt-5 text-center text-[11px] leading-5 text-white/30">
          Free accounts can access selected RugReflex intelligence features.
          Pro unlocks advanced access.
        </p>
      </div>
    </div>
  );
}
