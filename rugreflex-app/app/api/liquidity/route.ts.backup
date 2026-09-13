import { NextRequest, NextResponse } from "next/server";

type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };
  quoteToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };
  priceUsd?: string;
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  volume?: {
    h24?: number;
  };
};

export async function GET(request: NextRequest) {
  try {
    const address =
      request.nextUrl.searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: "Token address is required.",
        },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(
        address
      )}`,
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(
        `DexScreener request failed: ${response.status}`
      );
    }

    const result = await response.json();

    const pairs: DexPair[] = Array.isArray(result?.pairs)
      ? result.pairs
      : [];

    /*
     * Only use Solana pairs.
     */
    const solanaPairs = pairs.filter(
      (pair) => pair.chainId === "solana"
    );

    /*
     * Select the pair with the greatest USD liquidity.
     */
    const sortedPairs = [...solanaPairs].sort(
      (a, b) =>
        (b.liquidity?.usd || 0) -
        (a.liquidity?.usd || 0)
    );

    const pair = sortedPairs[0];

    /*
     * No trading pair found.
     */
    if (!pair) {
      return NextResponse.json({
        success: true,
        address,
        liquidity: {
          status: "UNKNOWN",
          assessment: "NO LIQUIDITY POOL FOUND",
          note:
            "No active Solana trading pair with available liquidity data was found for this token.",
          liquidityUsd: 0,
          pairCount: 0,
          dex: null,
          pairAddress: null,
          priceUsd: null,
          volume24h: 0,
        },
      });
    }

    const liquidityUsd =
      pair.liquidity?.usd || 0;

    const volume24h =
      pair.volume?.h24 || 0;

    let assessment =
      "LIQUIDITY DATA RETRIEVED";

    let note =
      "A Solana liquidity pool was detected. Review liquidity size and trading activity before making a decision.";

    /*
     * Basic MVP liquidity assessment.
     */
    if (liquidityUsd < 5000) {
      assessment = "VERY LOW LIQUIDITY";

      note =
        "The largest detected Solana pool has less than $5,000 in liquidity. Low liquidity can increase price impact and exit risk.";
    } else if (liquidityUsd < 25000) {
      assessment = "LOW LIQUIDITY";

      note =
        "The largest detected Solana pool has relatively low liquidity. Large trades may experience significant price impact.";
    } else if (liquidityUsd < 100000) {
      assessment = "MODERATE LIQUIDITY";

      note =
        "A moderate amount of liquidity was detected. Review pool depth, trading volume and other risk signals.";
    } else {
      assessment = "STRONGER LIQUIDITY";

      note =
        "The largest detected Solana pool has at least $100,000 in liquidity. This is only one liquidity signal and does not eliminate other token risks.";
    }

    return NextResponse.json({
      success: true,
      address,

      liquidity: {
        status: "AVAILABLE",

        assessment,

        note,

        liquidityUsd,

        pairCount: solanaPairs.length,

        dex: pair.dexId || null,

        pairAddress:
          pair.pairAddress || null,

        priceUsd:
          pair.priceUsd
            ? Number(pair.priceUsd)
            : null,

        volume24h,

        marketCap:
          pair.marketCap || null,

        fdv:
          pair.fdv || null,

        pairUrl:
          pair.url || null,
      },
    });
  } catch (error) {
    console.error(
      "LIQUIDITY API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to analyze liquidity.",
      },
      { status: 500 }
    );
  }
}