import { getAsset } from "@/lib/helius";

export interface Holder {
  owner: string;
  amount: number;
  percentage: number;
}

export interface HolderData {
  totalAccounts: number;
  totalHolders: number;
  totalSupply: number;
  decimals: number;
  topHolderPercentage: number;
  top5Percentage: number;
  top10Percentage: number;
  top20Percentage: number;
  top50Percentage: number;
  concentrationRisk: string;
  holders: Holder[];
}

export async function getHolderData(
  address: string
): Promise<HolderData> {
  const apiKey = process.env.HELIUS_API_KEY;

  if (!apiKey) {
    throw new Error("HELIUS_API_KEY is missing");
  }

  const rpcUrl =
    `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

  const asset = await getAsset(address);

  const tokenInfo = asset?.token_info || {};
  const decimals = Number(tokenInfo.decimals ?? 0);
  const rawSupply = Number(tokenInfo.supply ?? 0);

  const totalSupply =
    decimals > 0
      ? rawSupply / Math.pow(10, decimals)
      : rawSupply;

  const allAccounts: any[] = [];

  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `rugreflex-holders-${page}`,
        method: "getTokenAccounts",
        params: {
          mint: address,
          page,
          limit: 1000,
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Helius holder request failed: ${response.status}`
      );
    }

    const json = await response.json();

    if (json.error) {
      throw new Error(
        json.error.message ||
          "Failed to fetch holder data from Helius"
      );
    }

    const accounts =
      json.result?.token_accounts || [];

    if (accounts.length === 0) {
      break;
    }

    allAccounts.push(...accounts);

    if (accounts.length < 1000) {
      break;
    }

    page++;
  }

  if (allAccounts.length === 0) {
    return {
      totalAccounts: 0,
      totalHolders: 0,
      totalSupply,
      decimals,
      topHolderPercentage: 0,
      top5Percentage: 0,
      top10Percentage: 0,
      top20Percentage: 0,
      top50Percentage: 0,
      concentrationRisk: "UNKNOWN",
      holders: [],
    };
  }

  const holderMap: Record<string, number> = {};

  for (const account of allAccounts) {
    const owner = account.owner;

    if (!owner) {
      continue;
    }

    const rawAmount = Number(account.amount ?? 0);

    const amount =
      decimals > 0
        ? rawAmount / Math.pow(10, decimals)
        : rawAmount;

    holderMap[owner] =
      (holderMap[owner] || 0) + amount;
  }

  const holders = Object.entries(holderMap)
    .filter(([, amount]) => amount > 0)
    .map(([owner, amount]) => ({
      owner,
      amount,
      percentage:
        totalSupply > 0
          ? Number(
              ((amount / totalSupply) * 100).toFixed(6)
            )
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const calculateConcentration = (
    count: number
  ) => {
    if (totalSupply <= 0) {
      return 0;
    }

    const amount = holders
      .slice(0, count)
      .reduce(
        (sum, holder) => sum + holder.amount,
        0
      );

    return Number(
      ((amount / totalSupply) * 100).toFixed(6)
    );
  };

  const topHolderPercentage =
    holders.length > 0
      ? holders[0].percentage
      : 0;

  const top5Percentage =
    calculateConcentration(5);

  const top10Percentage =
    calculateConcentration(10);

  const top20Percentage =
    calculateConcentration(20);

  const top50Percentage =
    calculateConcentration(50);

  let concentrationRisk = "LOW";

  if (
    totalSupply <= 0 ||
    holders.length === 0
  ) {
    concentrationRisk = "UNKNOWN";
  } else if (topHolderPercentage >= 50) {
    concentrationRisk = "VERY HIGH";
  } else if (topHolderPercentage >= 25) {
    concentrationRisk = "HIGH";
  } else if (topHolderPercentage >= 10) {
    concentrationRisk = "MEDIUM";
  } else if (top10Percentage >= 50) {
    concentrationRisk = "HIGH";
  } else if (top10Percentage >= 30) {
    concentrationRisk = "MEDIUM";
  }

  return {
    totalAccounts: allAccounts.length,
    totalHolders: holders.length,
    totalSupply,
    decimals,
    topHolderPercentage,
    top5Percentage,
    top10Percentage,
    top20Percentage,
    top50Percentage,
    concentrationRisk,
    holders,
  };
}
