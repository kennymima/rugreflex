import Link from "next/link";
import RugReflexNav from "@/app/components/RugReflexNav";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#100308] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-350px] h-[750px] w-[1100px] -translate-x-1/2 rounded-full bg-[#8f1738]/20 blur-[120px]" />
        <div className="absolute bottom-[-300px] left-[-250px] h-[650px] w-[650px] rounded-full bg-[#5b1026]/20 blur-[120px]" />
        <div className="absolute right-[-250px] top-[35%] h-[550px] w-[550px] rounded-full bg-[#9f2348]/10 blur-[120px]" />
      </div>

      <RugReflexNav />

      <section className="mx-auto max-w-7xl px-5 pb-20 pt-20 sm:px-6 lg:pb-28 lg:pt-28">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
              Solana Token Intelligence
            </span>
          </div>

          <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-6xl lg:text-8xl">
            Know the risk.
            <br />
            <span className="text-white/35">Find the signal.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-sm leading-7 text-white/40 sm:text-base">
            RugReflex analyzes observable blockchain and market signals to
            help you investigate Solana tokens before you make a decision.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/scan"
              className="rounded-2xl bg-white px-7 py-4 text-xs font-black tracking-[0.08em] text-[#64122b] shadow-xl shadow-black/20 transition hover:bg-white/90"
            >
              INVESTIGATE A TOKEN →
            </Link>

            <Link
              href="/radar"
              className="rounded-2xl border border-white/[0.1] bg-white/[0.04] px-7 py-4 text-xs font-black tracking-[0.08em] text-white transition hover:bg-white/[0.07]"
            >
              EXPLORE ALPHA RADAR
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-6xl gap-4 lg:grid-cols-3">
          <Link
            href="/scan"
            className="group rounded-3xl border border-white/[0.07] bg-white/[0.025] p-7 transition hover:border-white/[0.14] hover:bg-white/[0.04]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-sm font-black">
              01
            </div>

            <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
              Risk Intelligence
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Investigate before you buy
            </h2>

            <p className="mt-4 text-xs leading-6 text-white/35">
              Examine holder concentration, liquidity, security authorities,
              market data and other observable token signals in one
              investigation.
            </p>

            <span className="mt-6 inline-block text-[10px] font-bold uppercase tracking-wider text-white/50 group-hover:text-white">
              Open Scanner →
            </span>
          </Link>

          <Link
            href="/radar"
            className="group rounded-3xl border border-white/[0.07] bg-white/[0.025] p-7 transition hover:border-white/[0.14] hover:bg-white/[0.04]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-sm font-black">
              02
            </div>

            <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
              Alpha Radar
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Find emerging signals
            </h2>

            <p className="mt-4 text-xs leading-6 text-white/35">
              Monitor observable market activity and surface tokens showing
              notable momentum, liquidity and market signals for further
              investigation.
            </p>

            <span className="mt-6 inline-block text-[10px] font-bold uppercase tracking-wider text-white/50 group-hover:text-white">
              Open Alpha Radar →
            </span>
          </Link>

          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-sm font-black">
              03
            </div>

            <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
              AI Intelligence
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Ask. Investigate. Understand.
            </h2>

            <p className="mt-4 text-xs leading-6 text-white/35">
              Use RugReflex intelligence tools and AI Chat to turn complex
              token information into clearer questions and investigations.
            </p>

            <span className="mt-6 inline-block rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/30">
              Intelligence Workspace
            </span>
          </div>
        </div>

        <section className="mx-auto mt-20 max-w-6xl rounded-3xl border border-white/[0.07] bg-gradient-to-br from-[#2b0813]/70 to-[#160409]/70 p-7 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                Built for informed decisions
              </p>

              <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                One workspace for token intelligence.
              </h2>

              <p className="mt-4 max-w-2xl text-xs leading-6 text-white/35 sm:text-sm">
                Scan individual tokens, monitor emerging market signals,
                review investigations and use deeper intelligence tools as
                RugReflex evolves.
              </p>
            </div>

            <Link
              href="/scan"
              className="rounded-2xl border border-white/[0.1] bg-white/[0.05] px-6 py-4 text-center text-xs font-black tracking-[0.08em] transition hover:bg-white/[0.08]"
            >
              START INVESTIGATION →
            </Link>
          </div>
        </section>
      </section>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-[#64122b]">
              R
            </div>

            <div>
              <p className="text-sm font-black tracking-[0.08em]">
                RUGREFLEX
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/25">
                Solana Token Risk Intelligence
              </p>
            </div>
          </div>

          <p className="text-[10px] text-white/20">
            Observed intelligence — not financial advice.
          </p>
        </div>
      </footer>
    </main>
  );
}
