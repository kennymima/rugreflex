export default function ProPage() {
  return (
    <main className="min-h-screen bg-[#100308] text-white">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">

        <nav className="mb-12 flex items-center justify-between border-b border-white/[0.07] pb-5">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-[#64122b]">
              R
            </div>
            <div>
              <p className="text-sm font-black tracking-[0.08em]">
                RUGREFLEX
              </p>
              <p className="text-[9px] uppercase tracking-[0.22em] text-white/35">
                Token Risk Intelligence
              </p>
            </div>
          </a>

          <a
            href="/"
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/60 transition hover:border-[#9f2348]/50 hover:text-white"
          >
            Scanner
          </a>
        </nav>

        <section className="rounded-[28px] border border-white/[0.08] bg-[#250711]/80 p-8 text-center sm:p-14">

          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9f2348]/15 text-xl font-black">
            ◆
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e89ab2]">
            Premium Intelligence
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
            RugReflex Pro
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
            Advanced token intelligence for users who want deeper analysis,
            increased scan capacity, monitoring and professional investigation
            tools.
          </p>

          <div className="mx-auto mt-10 grid max-w-3xl gap-3 text-left sm:grid-cols-2">

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="font-bold">50 Daily Scans</p>
              <p className="mt-2 text-xs text-white/35">
                Higher scan capacity for active users.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="font-bold">Advanced Reports</p>
              <p className="mt-2 text-xs text-white/35">
                Deeper intelligence and expanded reporting.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="font-bold">Wallet Intelligence</p>
              <p className="mt-2 text-xs text-white/35">
                Investigate wallet activity and relationships.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="font-bold">Monitoring Tools</p>
              <p className="mt-2 text-xs text-white/35">
                Track tokens and intelligence signals over time.
              </p>
            </div>

          </div>

          <div className="mt-10 rounded-2xl border border-[#9f2348]/20 bg-[#9f2348]/10 p-5">
            <p className="font-bold">Coming Soon</p>
            <p className="mt-2 text-xs text-white/45">
              RugReflex Pro will become available as the premium intelligence
              layer is launched.
            </p>
          </div>

        </section>
      </div>
    </main>
  );
}
