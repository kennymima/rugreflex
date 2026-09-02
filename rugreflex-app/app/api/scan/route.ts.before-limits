import { NextRequest, NextResponse } from "next/server";
import {
  getAsset,
  getTokenSupply,
} from "@/lib/helius";
import {
  getDexScreenerData,
} from "@/lib/dexscreener";

export async function GET(
  request: NextRequest
) {
  try {
    const mint =
      request.nextUrl.searchParams.get("mint")?.trim();

    if (!mint) {
      return NextResponse.json(
        {
          success: false,
          error: "Token mint address is required",
        },
        { status: 400 }
      );
    }

    /*
     * =====================================================
     * FETCH CORE TOKEN + MARKET DATA IN PARALLEL
     * =====================================================
     */

    const [asset, supply, market] =
      await Promise.all([
        getAsset(mint),
        getTokenSupply(mint),
        getDexScreenerData(mint),
      ]);

    if (!asset) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Token not found or Helius returned no asset data.",
        },
        { status: 404 }
      );
    }

    /*
     * =====================================================
     * TOKEN METADATA
     * =====================================================
     */

    const content =
      asset?.content || {};

    const metadata =
      content?.metadata || {};

    const tokenName =
      metadata?.name ||
      asset?.token_info?.symbol ||
      "Unknown Token";

    const symbol =
      metadata?.symbol ||
      asset?.token_info?.symbol ||
      "UNKNOWN";

    const image =
      metadata?.image || null;

    const description =
      metadata?.description || null;

    /*
     * =====================================================
     * SUPPLY
     * =====================================================
     */

    const decimals =
      supply?.decimals ??
      asset?.token_info?.decimals ??
      0;

    const rawSupply =
      Number(supply?.amount || 0);

    const totalSupply =
      decimals > 0
        ? rawSupply / 10 ** decimals
        : rawSupply;

    /*
     * =====================================================
     * TOKEN AUTHORITIES
     *
     * Helius asset authority data can expose scopes.
     * We normalize it into a simple RugReflex format.
     * =====================================================
     */

    const authorities =
      Array.isArray(asset?.authorities)
        ? asset.authorities
        : [];

    let mintAuthority:
      string | null = null;

    let freezeAuthority:
      string | null = null;

    for (const authority of authorities) {
      const scopes = Array.isArray(
        authority?.scopes
      )
        ? authority.scopes
        : [];

      const type =
        authority?.type || "";

      if (
        type === "mint" ||
        scopes.includes("mint")
      ) {
        mintAuthority =
          authority?.address || null;
      }

      if (
        type === "freeze" ||
        scopes.includes("freeze")
      ) {
        freezeAuthority =
          authority?.address || null;
      }
    }

    /*
     * =====================================================
     * SECURITY
     * =====================================================
     */

    const security = {
      mintAuthority,
      freezeAuthority,

      mintAuthorityActive:
        mintAuthority !== null,

      freezeAuthorityActive:
        freezeAuthority !== null,
    };

    /*
     * =====================================================
     * MARKET DATA
     * =====================================================
     */

    const marketData = {
      priceUsd:
        market.priceUsd ?? null,

      marketCap:
        market.marketCap ?? null,

      fdv:
        market.fdv ?? null,

      liquidityUsd:
        market.liquidityUsd ?? null,

      volume24h:
        market.volume24h ?? null,

      dex:
        market.dex ?? null,

      pairAddress:
        market.pairAddress ?? null,

      pairUrl:
        market.pairUrl ?? null,

      pairCount:
        market.pairs?.length ?? 0,
    };

    /*
     * =====================================================
     * UNIFIED RUGREFLEX SCAN RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      scan: {
        mint,

        token: {
          mint,
          name: tokenName,
          symbol,
          image,
          description,
          decimals,
          supply: totalSupply,
        },

        market: marketData,

        security,

        timestamp:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "RugReflex unified scan error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to scan token",
      },
      { status: 500 }
    );
  }
}
