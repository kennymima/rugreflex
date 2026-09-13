import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const profilesResponse = await fetch("https://api.dexscreener.com/token-profiles/latest/v1", { cache: "no-store" });

    if (!profilesResponse.ok) {
      return NextResponse.json({ error: `DexScreener request failed: ${profilesResponse.status}` }, { status: 502 });
    }

    const profiles = await profilesResponse.json();
    const candidates = (Array.isArray(profiles) ? profiles : [])
      .filter((item: any) => item?.chainId === "solana" && item?.tokenAddress)
      .slice(0, 20);

    const enriched = await Promise.all(candidates.map(async (candidate: any) => {
      try {
        const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(candidate.tokenAddress)}`, { cache: "no-store" });
        if (!response.ok) return null;
        const pairs = await response.json();
        const pair = Array.isArray(pairs) ? pairs.filter((p: any) => p?.chainId === "solana").sort((a: any, b: any) => (Number(b?.liquidity?.usd) || 0) - (Number(a?.liquidity?.usd) || 0))[0] : null;
        if (!pair) return null;
        return {
          tokenAddress: candidate.tokenAddress,
          description: candidate.description || "",
          icon: candidate.icon || "",
          url: candidate.url || pair.url || "",
          name: pair.baseToken?.name || "Unknown",
          symbol: pair.baseToken?.symbol || "UNKNOWN",
          priceUsd: Number(pair.priceUsd || 0),
          priceChange: pair.priceChange || {},
          volume: pair.volume || {},
          liquidityUsd: Number(pair.liquidity?.usd || 0),
          marketCap: Number(pair.marketCap || pair.fdv || 0),
          fdv: Number(pair.fdv || 0),
          pairCreatedAt: pair.pairCreatedAt || null,
          transactions: pair.txns || {},
          dex: pair.dexId || "Unknown",
          pairAddress: pair.pairAddress || "",
          boosts: pair.boosts || null
        };
      } catch {
        return null;
      }
    }));

    const scored = enriched.filter(Boolean).map((token: any) => {
      const h1 = Number(token.priceChange?.h1 || 0);
      const h24 = Number(token.priceChange?.h24 || 0);
      const volume24h = Number(token.volume?.h24 || 0);
      const liquidity = Number(token.liquidityUsd || 0);
      const buys = Number(token.transactions?.h1?.buys || 0);
      const sells = Number(token.transactions?.h1?.sells || 0);

      const totalTrades = buys + sells;
      const buyRatio = totalTrades > 0 ? buys / totalTrades : 0;

      // RugReflex qualification gate:
      // Evaluate each venue according to the market data it actually exposes.
      // Pump.fun pairs may not expose AMM liquidity, so activity and momentum
      // are used instead. AMM venues such as PumpSwap must show real liquidity.
      const isPumpFun = String(token.dex || "").toLowerCase() === "pumpfun";
      const recentMomentum = Number(token.priceChange?.h1 || 0);
      const dailyMomentum = Number(token.priceChange?.h24 || 0);
      const activeTrading = volume24h >= 10000 && totalTrades >= 50;
      const balancedFlow = buyRatio >= 0.40 && buyRatio <= 0.75;
      const healthyMomentum = recentMomentum >= -5 && dailyMomentum > 0;

      const qualifies =
        Number(token.priceUsd || 0) > 0 &&
        activeTrading &&
        balancedFlow &&
        healthyMomentum &&
        (isPumpFun || liquidity >= 5000);

      if (!qualifies) return null;

      /*
       * RugReflex qualification metadata.
       *
       * This is deliberately separate from the Alpha Score:
       * the score describes observable market activity, while
       * qualification describes whether the token passed the
       * Radar's current market-quality gate.
       */
      const qualificationChecks = {
        priceActive: Number(token.priceUsd || 0) > 0,
        tradingActivity: activeTrading,
        balancedBuySellFlow: balancedFlow,
        healthyMomentum,
        liquidityRequirement: isPumpFun || liquidity >= 5000,
      };

      const qualificationReasons = [
        qualificationChecks.priceActive
          ? "Active market price observed"
          : "No active market price",

        qualificationChecks.tradingActivity
          ? "Sufficient recent trading activity"
          : "Insufficient recent trading activity",

        qualificationChecks.balancedBuySellFlow
          ? "Buy/sell flow within Radar range"
          : "Buy/sell flow outside Radar range",

        qualificationChecks.healthyMomentum
          ? "Positive recent momentum observed"
          : "Momentum does not meet Radar criteria",

        qualificationChecks.liquidityRequirement
          ? isPumpFun
            ? "Pump.fun activity path accepted"
            : "Minimum liquidity requirement met"
          : "Minimum liquidity requirement not met",
      ];

      let score = 0;

      score += Math.min(20, Math.max(0, h1) / 10);
      score += Math.min(15, volume24h / 10000);
      if (isPumpFun) {
        score += 10;
      } else {
        score += Math.min(15, liquidity / 10000);
      }

      if (totalTrades > 0) {
        score += Math.min(15, buyRatio * 15);
      }

      if (h24 > 0) score += Math.min(10, h24 / 20);

      if (!isPumpFun) {
        if (liquidity === 0) score -= 25;
        else if (liquidity < 5000) score -= 10;
      }

      if (sells > buys * 1.5) score -= 10;

      score = Math.max(0, Math.min(100, Math.round(score)));

      return {
        ...token,

        /*
         * Radar qualification state used by the live-token UI.
         */
        radarEligible: true,
        qualificationChecks,
        qualificationReasons,

        alphaScore: score,
        alphaSignal:
          score >= 80 ? "STRONG ACTIVITY" :
          score >= 60 ? "INTERESTING" :
          score >= 40 ? "WATCH" :
          "LOW SIGNAL"
      };
    }).filter(Boolean).sort((a: any, b: any) => b.alphaScore - a.alphaScore);

    return NextResponse.json({ candidates: scored });
  } catch (error) {
    console.error("Radar discovery failed:", error);
    return NextResponse.json({ error: "Radar discovery failed." }, { status: 500 });
  }
}
