import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type PaymentCurrency = "USDC" | "RFLX";

function isPaymentCurrency(value: unknown): value is PaymentCurrency {
  return value === "USDC" || value === "RFLX";
}

function createReference() {
  return `PRO-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function getRflxMarketPrice(tokenMint: string) {
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(
      tokenMint
    )}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Unable to load the current RFLX market price.");
  }

  const data = await response.json();

  const pairs = Array.isArray(data?.pairs) ? data.pairs : [];

  const validPairs = pairs
    .map((pair: any) => ({
      priceUsd: Number(pair?.priceUsd),
      liquidityUsd: Number(pair?.liquidity?.usd),
    }))
    .filter(
      (pair: { priceUsd: number; liquidityUsd: number }) =>
        Number.isFinite(pair.priceUsd) &&
        pair.priceUsd > 0 &&
        Number.isFinite(pair.liquidityUsd) &&
        pair.liquidityUsd > 0
    )
    .sort(
      (
        a: { priceUsd: number; liquidityUsd: number },
        b: { priceUsd: number; liquidityUsd: number }
      ) => b.liquidityUsd - a.liquidityUsd
    );

  const selectedPair = validPairs[0];

  if (!selectedPair) {
    throw new Error("No valid RFLX market price is currently available.");
  }

  return selectedPair.priceUsd;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);

    const planId = Number(body?.planId);
    const currency = body?.currency;

    if (!Number.isInteger(planId) || planId <= 0) {
      return NextResponse.json(
        { error: "A valid Pro plan is required." },
        { status: 400 }
      );
    }

    if (!isPaymentCurrency(currency)) {
      return NextResponse.json(
        { error: "A valid payment currency is required." },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    const [
      { data: settings, error: settingsError },
      { data: plan, error: planError },
      { data: paymentConfig, error: paymentConfigError },
    ] = await Promise.all([
      admin
        .from("admin_settings")
        .select(
          "pro_enabled, payments_enabled, usdc_enabled, rflx_enabled, rflx_discount_percent"
        )
        .limit(1)
        .maybeSingle(),

      admin
        .from("pro_plans")
        .select("id, name, price_usdc, duration_days, active")
        .eq("id", planId)
        .eq("active", true)
        .maybeSingle(),

      admin
        .from("payment_config")
        .select(
          "currency, enabled, network, receiving_wallet, token_mint"
        )
        .eq("currency", currency)
        .maybeSingle(),
    ]);

    if (settingsError || planError || paymentConfigError) {
      return NextResponse.json(
        { error: "Unable to load Pro payment configuration." },
        { status: 500 }
      );
    }

    if (!settings?.pro_enabled) {
      return NextResponse.json(
        { error: "Pro subscriptions are currently disabled." },
        { status: 403 }
      );
    }

    if (!settings?.payments_enabled) {
      return NextResponse.json(
        { error: "Pro payments are currently disabled." },
        { status: 403 }
      );
    }

    if (!plan) {
      return NextResponse.json(
        { error: "The selected Pro plan is unavailable." },
        { status: 400 }
      );
    }

    const currencyEnabled =
      currency === "USDC"
        ? settings.usdc_enabled
        : settings.rflx_enabled;

    if (!currencyEnabled || !paymentConfig?.enabled) {
      return NextResponse.json(
        { error: `${currency} payments are currently disabled.` },
        { status: 403 }
      );
    }

    if (paymentConfig.network !== "Solana") {
      return NextResponse.json(
        {
          error: `${currency} payment network is not configured for Solana.`,
        },
        { status: 503 }
      );
    }

    if (!paymentConfig.receiving_wallet) {
      return NextResponse.json(
        { error: `${currency} receiving wallet is not configured.` },
        { status: 503 }
      );
    }

    const standardPrice = Number(plan.price_usdc);

    if (!Number.isFinite(standardPrice) || standardPrice < 0) {
      return NextResponse.json(
        { error: "The selected Pro plan has an invalid price." },
        { status: 500 }
      );
    }

    let amount = standardPrice;

    const discountPercent =
      Number(settings.rflx_discount_percent ?? 20);

    let rflxMarketPriceUsd: number | null = null;
    let rflxEquivalentAmount: number | null = null;

    if (currency === "RFLX") {
      if (!paymentConfig.token_mint) {
        return NextResponse.json(
          {
            error:
              "RFLX is enabled but its token mint is not configured.",
          },
          { status: 503 }
        );
      }

      if (
        !Number.isFinite(discountPercent) ||
        discountPercent < 0 ||
        discountPercent >= 100
      ) {
        return NextResponse.json(
          { error: "The configured RFLX discount is invalid." },
          { status: 500 }
        );
      }

      const currentRflxMarketPriceUsd = await getRflxMarketPrice(
        paymentConfig.token_mint
      );

      if (
        !Number.isFinite(currentRflxMarketPriceUsd) ||
        currentRflxMarketPriceUsd <= 0
      ) {
        return NextResponse.json(
          { error: "The current RFLX market price is invalid." },
          { status: 503 }
        );
      }

      rflxMarketPriceUsd = currentRflxMarketPriceUsd;

      rflxEquivalentAmount =
        standardPrice / currentRflxMarketPriceUsd;

      amount =
        rflxEquivalentAmount *
        (1 - discountPercent / 100);
    }

    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        { error: "Unable to calculate the payment amount." },
        { status: 500 }
      );
    }

    const reference = createReference();

    const metadata = {
      plan_id: plan.id,
      plan_name: plan.name,
      duration_days: plan.duration_days,
      standard_price_usdc: standardPrice,
      discount_percent: currency === "RFLX" ? discountPercent : 0,
      ...(currency === "RFLX"
        ? {
            rflx_market_price_usd: rflxMarketPriceUsd,
            rflx_equivalent_amount: rflxEquivalentAmount,
            quoted_rflx_amount: amount,
            quote_timestamp: new Date().toISOString(),
            rflx_token_mint: paymentConfig.token_mint,
          }
        : {}),
    };

    const { data: payment, error: paymentError } = await admin
      .from("payment_records")
      .insert({
        user_id: user.id,
        payment_type: "pro",
        reference,
        currency,
        network: "Solana",
        amount,
        receiving_wallet: paymentConfig.receiving_wallet,
        status: "pending",
        metadata,
      })
      .select(
        "id, reference, payment_type, currency, network, amount, receiving_wallet, status, created_at"
      )
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Unable to create the Pro payment record." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      payment,
      plan: {
        id: plan.id,
        name: plan.name,
        duration_days: plan.duration_days,
      },
      ...(currency === "RFLX"
        ? {
            quote: {
              marketPriceUsd: rflxMarketPriceUsd,
              equivalentAmount: rflxEquivalentAmount,
              discountPercent,
              finalAmount: amount,
              quotedAt: metadata.quote_timestamp,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error("Pro payment creation failed:", error);

    return NextResponse.json(
      { error: "Unable to create Pro payment." },
      { status: 500 }
    );
  }
}
