export default function ReferralsPage() {
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
            Invite people to RugReflex and earn rewards as the ecosystem
            grows.
          </p>

          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 text-left">

            <p className="font-bold">Referral System</p>

            <p className="mt-3 text-xs leading-6 text-white/40">
              The referral program will connect invitations, user growth and
              rewards while helping RugReflex grow through its community.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">

              <div className="rounded-xl border border-white/[0.07] p-4">
                <p className="text-xs font-bold">Invite</p>
                <p className="mt-1 text-[10px] text-white/30">
                  Share your referral link
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.07] p-4">
                <p className="text-xs font-bold">Grow</p>
                <p className="mt-1 text-[10px] text-white/30">
                  Friends join RugReflex
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.07] p-4">
                <p className="text-xs font-bold">Earn</p>
                <p className="mt-1 text-[10px] text-white/30">
                  Receive future rewards
                </p>
              </div>

            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-[#9f2348]/20 bg-[#9f2348]/10 p-5">
            <p className="font-bold">Coming Soon</p>
            <p className="mt-2 text-xs text-white/45">
              Referral links, referral tracking and rewards will be activated
              as the RugReflex growth system is launched.
            </p>
          </div>

        </section>
      </div>
    </main>
  );
}
