import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { VISITOR_COOKIE_NAME } from "@/lib/visitor/id";

type HistoryPayload = {
  tokenMint: string;
  tokenName?: string | null;
  tokenSymbol?: string | null;
  riskScore?: number | null;
  riskLabel?: string | null;
  marketCap?: number | null;
  liquidityUsd?: number | null;
  volume24h?: number | null;
  totalHolders?: number | null;
  topHolderPercentage?: number | null;
  top10Percentage?: number | null;
  mintAuthorityActive?: boolean | null;
  freezeAuthorityActive?: boolean | null;
  reportSnapshot?: Record<string, unknown> | null;
};

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

async function getIdentity(request: NextRequest) {
  const supabase = await createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const visitorId =
    request.cookies.get(VISITOR_COOKIE_NAME)?.value ?? null;

  return {
    supabase,
    user,
    visitorId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const {
      supabase,
      user,
      visitorId,
    } = await getIdentity(request);

    const requestedId =
      request.nextUrl.searchParams.get("id");

    let query = supabase
      .from("scan_history")
      .select("*");

    if (user) {
      query = query.eq("user_id", user.id);
    } else if (visitorId) {
      query = query.eq(
        "visitor_id",
        visitorId
      );
    } else {
      return NextResponse.json({
        success: true,
        history: requestedId ? null : [],
      });
    }

    if (requestedId) {
      const {
        data,
        error,
      } = await query
        .eq("id", requestedId)
        .maybeSingle();

      if (error) {
        console.error(
          "Scan history detail fetch error:",
          error
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "Unable to load historical report.",
          },
          { status: 500 }
        );
      }

      if (!data) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Historical report not found.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        history: data,
      });
    }

    const {
      data,
      error,
    } = await query
      .order("scanned_at", {
        ascending: false,
      })
      .limit(50);

    if (error) {
      console.error(
        "Scan history fetch error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to load scan history.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      history: data ?? [],
    });
  } catch (error) {
    console.error(
      "Scan history GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load scan history.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body =
      (await request.json()) as HistoryPayload;

    if (
      !body.tokenMint ||
      typeof body.tokenMint !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Token mint address is required.",
        },
        { status: 400 }
      );
    }

    const {
      supabase,
      user,
      visitorId,
    } = await getIdentity(request);

    const historyRow = {
      user_id:
        user?.id ?? null,

      visitor_id:
        user ? null : visitorId,

      token_mint:
        body.tokenMint.trim(),

      token_name:
        body.tokenName ?? null,

      token_symbol:
        body.tokenSymbol ?? null,

      risk_score:
        isValidNumber(body.riskScore)
          ? Math.round(body.riskScore)
          : null,

      risk_label:
        body.riskLabel ?? null,

      market_cap:
        isValidNumber(body.marketCap)
          ? body.marketCap
          : null,

      liquidity_usd:
        isValidNumber(body.liquidityUsd)
          ? body.liquidityUsd
          : null,

      volume_24h:
        isValidNumber(body.volume24h)
          ? body.volume24h
          : null,

      total_holders:
        isValidNumber(body.totalHolders)
          ? Math.round(body.totalHolders)
          : null,

      top_holder_percentage:
        isValidNumber(
          body.topHolderPercentage
        )
          ? body.topHolderPercentage
          : null,

      top_10_percentage:
        isValidNumber(
          body.top10Percentage
        )
          ? body.top10Percentage
          : null,

      mint_authority_active:
        typeof body.mintAuthorityActive ===
        "boolean"
          ? body.mintAuthorityActive
          : null,

      freeze_authority_active:
        typeof body.freezeAuthorityActive ===
        "boolean"
          ? body.freezeAuthorityActive
          : null,

      report_snapshot:
        body.reportSnapshot ?? null,
    };

    const {
      data,
      error,
    } = await supabase
      .from("scan_history")
      .insert(historyRow)
      .select()
      .single();

    if (error) {
      console.error(
        "Scan history insert error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to save scan history.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      history: data,
    });
  } catch (error) {
    console.error(
      "Scan history POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save scan history.",
      },
      { status: 500 }
    );
  }
}
