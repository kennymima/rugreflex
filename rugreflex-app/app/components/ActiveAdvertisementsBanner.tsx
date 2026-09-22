"use client";

import { useAdvertising } from "./AdvertisingProvider";

export default function ActiveAdvertisementsBanner() {
  const { adsEnabled, activeAdvertisements: advertisements } = useAdvertising();

  if (!adsEnabled || advertisements.length === 0) {
    return null;
  }

  const items = [...advertisements, ...advertisements];

  return (
    <div className="overflow-hidden border-b border-white/[0.07] bg-black/30">
      <div
        className="flex min-w-max items-center gap-6 px-5 py-2.5"
        style={{
          animation: "rugreflex-ad-marquee 28s linear infinite",
        }}
      >
        {items.map((ad, index) => (
          <div
            key={`${ad.id}-${index}`}
            className="flex shrink-0 items-center gap-2.5 text-xs"
          >
            <span className="rounded-full border border-red-400/20 bg-red-500/[0.08] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-red-300">
              Promoted
            </span>

            {ad.logo ? (
              <img
                src={ad.logo}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.08] text-[9px] font-black text-white/60">
                {ad.token_name?.charAt(0)?.toUpperCase() || "T"}
              </div>
            )}

            <span className="font-bold text-white/85">
              {ad.token_name}
            </span>

            {ad.token_symbol && (
              <span className="text-white/35">
                ${ad.token_symbol}
              </span>
            )}

            {ad.description && (
              <span className="max-w-[260px] truncate text-white/45">
                {ad.description}
              </span>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes rugreflex-ad-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
