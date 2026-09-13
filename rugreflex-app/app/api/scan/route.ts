import { NextRequest, NextResponse } from "next/server";
import {
  getAsset,
} from "@/lib/helius";
import {
  getDexScreenerData,
} from "@/lib/dexscreener";
import {
  checkAndConsumeScan,
} from "@/lib/scan/usage";
import {
  VISITOR_COOKIE_NAME,
  createVisitorId,
} from "@/lib/visitor/id";

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
     * VISITOR IDENTIFICATION
     * =====================================================
     */

    const existingVisitorId =
      request.cookies.get(
        VISITOR_COOKIE_NAME
      )?.value ?? null;

    const visitorId =
      existingVisitorId ??
      createVisitorId();

    /*
     * =====================================================
     * FETCH CORE TOKEN + MARKET DATA IN PARALLEL
     * =====================================================
     */

    const [asset, market] =
      await Promise.all([
        getAsset(mint),
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
     * CHECK DAILY SCAN ALLOWANCE
     * =====================================================
     */

    const usage =
      await checkAndConsumeScan(
        visitorId
      );

    if (!usage.allowed) {
      const response =
        NextResponse.json(
          {
            success: false,
            error:
              usage.userType === "anonymous"
                ? `You have reached your ${usage.limit} free scans for today.`
                : "You have reached your daily scan limit.",
            scanLimit: {
              userType:
                usage.userType,
              limit:
                usage.limit,
              used:
                usage.used,
              remaining:
                usage.remaining,
            },
            upgradeRequired:
              usage.userType !== "pro",
          },
          { status: 429 }
        );

      if (!existingVisitorId) {
        response.cookies.set(
          VISITOR_COOKIE_NAME,
          visitorId,
          {
            httpOnly: true,
            secure:
              process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge:
              60 * 60 * 24 * 365,
            path: "/",
          }
        );
      }

      return response;
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
      asset?.token_info?.decimals ??
      0;

    const totalSupply =
      Number(asset?.token_info?.supply || 0);

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

    const response =
      NextResponse.json({
        success: true,

        scanLimit: {
          userType:
            usage.userType,
          limit:
            usage.limit,
          used:
            usage.used,
          remaining:
            usage.remaining,
        },

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

    /*
     * =====================================================
     * SAVE ANONYMOUS VISITOR COOKIE
     * =====================================================
     */

    if (!existingVisitorId) {
      response.cookies.set(
        VISITOR_COOKIE_NAME,
        visitorId,
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge:
            60 * 60 * 24 * 365,
          path: "/",
        }
      );
    }

    return response;
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
