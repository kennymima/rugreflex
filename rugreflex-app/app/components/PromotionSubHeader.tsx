"use client";

import ActiveAdvertisementsBanner from "./ActiveAdvertisementsBanner";
import PromotionContact from "./PromotionContact";

export default function PromotionSubHeader() {
  return (
    <div className="border-b border-white/[0.07] bg-[#100308]/95">
      <div className="mx-auto flex max-w-7xl items-center justify-center px-5 py-2 sm:px-6">
        <PromotionContact />
      </div>

      <ActiveAdvertisementsBanner />
    </div>
  );
}
