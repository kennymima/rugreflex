import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = await createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: settings, error: settingsError } = await admin
      .from("admin_settings")
      .select(
        "ads_enabled, payments_enabled, usdc_enabled, rflx_enabled, rflx_discount_percent"
      )
      .eq("id", 1)
      .single();

    if (settingsError) {
      return NextResponse.json(
        { error: "Unable to load advertising configuration." },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();

    const { data: activeAdvertisements, error: activeAdsError } = await admin
      .from("advertisements")
      .select(
        "id, token_name, token_symbol, token_address, logo, description, status, starts_at, expires_at, created_at, updated_at"
      )
      .eq("status", "active")
      .lte("starts_at", now)
      .gte("expires_at", now)
      .order("created_at", { ascending: false });

    if (activeAdsError) {
      return NextResponse.json(
        {
          error: "Unable to load active advertisements.",
          activeAdsError: activeAdsError.message,
        },
        { status: 500 }
      );
    }

    const { data: packages, error: packagesError } = await admin
      .from("ad_packages")
      .select("id, name, duration_days, price_usdc, active")
      .eq("active", true)
      .order("duration_days", { ascending: true });

    if (packagesError) {
      return NextResponse.json(
        {
          error: "Unable to load advertising packages.",
          packagesError: packagesError.message,
        },
        { status: 500 }
      );
    }

    let advertisements: unknown[] = [];

    if (user) {
      const { data: userAdvertisements, error: advertisementsError } = await admin
        .from("advertisements")
        .select(
          "id, token_name, token_symbol, token_address, logo, description, status, package_id, currency, amount, starts_at, expires_at, payment_record_id, created_at, updated_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (advertisementsError) {
        return NextResponse.json(
          {
            error: "Unable to load your advertising information.",
            advertisementsError: advertisementsError.message,
          },
          { status: 500 }
        );
      }

      advertisements = userAdvertisements || [];
    }

    return NextResponse.json({
      ads_enabled: Boolean(settings?.ads_enabled),
      payments_enabled: Boolean(settings?.payments_enabled),
      usdc_enabled: Boolean(settings?.usdc_enabled),
      rflx_enabled: Boolean(settings?.rflx_enabled),
      rflx_discount_percent: Number(settings?.rflx_discount_percent ?? 0),
      activeAdvertisements: activeAdvertisements || [],
      advertisements,
      packages: packages || [],
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load advertising information." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to submit an advertisement." },
        { status: 401 }
      );
    }

    const admin = await createAdminClient();

    const { data: settings, error: settingsError } = await admin
      .from("admin_settings")
      .select("ads_enabled")
      .eq("id", 1)
      .single();

    if (settingsError) {
      return NextResponse.json(
        { error: "Unable to check advertising availability." },
        { status: 500 }
      );
    }

    if (!settings?.ads_enabled) {
      return NextResponse.json(
        { error: "Advertising is currently unavailable." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const tokenName =
      typeof body.token_name === "string" ? body.token_name.trim() : "";
    const logo =
      typeof body.logo === "string" ? body.logo.trim() : "";
    const tokenSymbol =
      typeof body.token_symbol === "string" ? body.token_symbol.trim() : "";
    const tokenAddress =
      typeof body.token_address === "string"
        ? body.token_address.trim()
        : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;

    if (!tokenName || !logo || !tokenSymbol || !tokenAddress) {
      return NextResponse.json(
        {
          error:
            "Token name, logo, ticker/symbol and contract address are required.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("advertisements")
      .insert({
        user_id: user.id,
        token_name: tokenName,
        logo,
        token_symbol: tokenSymbol,
        token_address: tokenAddress,
        description: description || null,
        status: "pending_review",
      })
      .select()
      .single();

    if (error) {
      console.error("Advertisement insert error:", error);

      return NextResponse.json(
        {
          error: "Failed to submit advertising request.",
          advertisementsError: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        advertisement: data,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid advertising request." },
      { status: 400 }
    );
  }
}
