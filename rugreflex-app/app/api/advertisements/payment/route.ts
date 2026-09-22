import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type PaymentCurrency = "USDC" | "RFLX";

function isPaymentCurrency(value: unknown): value is PaymentCurrency {
  return value === "USDC" || value === "RFLX";
}

async function getRflxMarketPrice(tokenMint: string) {
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(
      tokenMint
    )}`,
    { cache: "no-store" }
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

  if (!validPairs[0]) {
    throw new Error("No valid RFLX market price is currently available.");
  }

  return validPairs[0].priceUsd;
}

function createReference() {
  return `AD-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const advertisementId = Number(searchParams.get("advertisementId"));

    if (!Number.isInteger(advertisementId) || advertisementId <= 0) {
      return NextResponse.json(
        { error: "A valid advertisement is required." },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    const { data: advertisement, error: advertisementError } = await admin
      .from("advertisements")
      .select("id, user_id, status, package_id, currency, amount, payment_record_id")
      .eq("id", advertisementId)
      .maybeSingle();

    if (advertisementError) {
      return NextResponse.json(
        { error: "Unable to load the advertisement payment." },
        { status: 500 }
      );
    }

    if (!advertisement) {
      return NextResponse.json(
        { error: "Advertisement not found." },
        { status: 404 }
      );
    }

    if (advertisement.user_id !== user.id) {
      return NextResponse.json(
        { error: "This advertisement does not belong to the current user." },
        { status: 403 }
      );
    }

    if (!advertisement.payment_record_id) {
      return NextResponse.json({
        success: true,
        payment: null,
      });
    }

    const { data: payment, error: paymentError } = await admin
      .from("payment_records")
      .select(
        "id, reference, payment_type, currency, network, amount, receiving_wallet, status, created_at"
      )
      .eq("id", advertisement.payment_record_id)
      .eq("user_id", user.id)
      .eq("payment_type", "advertisement")
      .maybeSingle();

    if (paymentError) {
      return NextResponse.json(
        { error: "Unable to load the existing advertising payment." },
        { status: 500 }
      );
    }

    if (!payment) {
      return NextResponse.json({
        success: true,
        payment: null,
      });
    }

    return NextResponse.json({
      success: true,
      payment,
      advertisement: {
        id: advertisement.id,
        package_id: advertisement.package_id,
        currency: advertisement.currency,
        amount: advertisement.amount,
        status: advertisement.status,
      },
    });
  } catch (error) {
    console.error("Advertisement payment recovery error:", error);

    return NextResponse.json(
      { error: "Unable to load the advertising payment." },
      { status: 500 }
    );
  }
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

    const advertisementId = Number(body?.advertisementId);
    const packageId = Number(body?.packageId);
    const currency = body?.currency;

    if (!isPaymentCurrency(currency)) {
      return NextResponse.json(
        { error: "A valid payment currency is required." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(advertisementId) || advertisementId <= 0) {
      return NextResponse.json(
        { error: "A valid advertisement is required." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(packageId) || packageId <= 0) {
      return NextResponse.json(
        { error: "A valid advertising package is required." },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    const [
      { data: settings, error: settingsError },
      { data: advertisement, error: advertisementError },
      { data: adPackage, error: packageError },
      { data: paymentConfig, error: paymentConfigError },
    ] = await Promise.all([
      admin
        .from("admin_settings")
        .select(
          "ads_enabled, payments_enabled, usdc_enabled, rflx_enabled, rflx_discount_percent"
        )
        .eq("id", 1)
        .maybeSingle(),

      admin
        .from("advertisements")
        .select("id, user_id, status, package_id, payment_record_id")
        .eq("id", advertisementId)
        .maybeSingle(),

      admin
        .from("ad_packages")
        .select("id, name, duration_days, price_usdc, active")
        .eq("id", packageId)
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

    if (
      settingsError ||
      advertisementError ||
      packageError ||
      paymentConfigError
    ) {
      return NextResponse.json(
        { error: "Unable to load advertising payment configuration." },
        { status: 500 }
      );
    }

    if (!settings?.ads_enabled) {
      return NextResponse.json(
        { error: "Advertising is currently disabled." },
        { status: 403 }
      );
    }

    if (!settings.payments_enabled) {
      return NextResponse.json(
        { error: "Payments are currently disabled." },
        { status: 403 }
      );
    }

    const currencyEnabled =
      currency === "USDC"
        ? settings.usdc_enabled
        : settings.rflx_enabled;

    if (!currencyEnabled) {
      return NextResponse.json(
        { error: `${currency} payments are currently disabled.` },
        { status: 403 }
      );
    }

    if (!advertisement) {
      return NextResponse.json(
        { error: "Advertisement not found." },
        { status: 404 }
      );
    }

    if (advertisement.user_id !== user.id) {
      return NextResponse.json(
        { error: "This advertisement does not belong to the current user." },
        { status: 403 }
      );
    }

    if (advertisement.status !== "approved") {
      return NextResponse.json(
        {
          error:
            advertisement.status === "pending"
              ? "This advertisement is still awaiting approval."
              : `This advertisement is ${advertisement.status}.`,
        },
        { status: 409 }
      );
    }

    if (advertisement.payment_record_id) {
      return NextResponse.json(
        {
          error:
            "A payment has already been created for this advertisement.",
        },
        { status: 409 }
      );
    }

    if (!adPackage) {
      return NextResponse.json(
        { error: "The selected advertising package is unavailable." },
        { status: 400 }
      );
    }

    if (!paymentConfig?.enabled) {
      return NextResponse.json(
        { error: `${currency} payments are currently disabled.` },
        { status: 403 }
      );
    }

    if (paymentConfig.network !== "Solana") {
      return NextResponse.json(
        {
          error:
            `${currency} advertising payments are not configured for Solana.`,
        },
        { status: 503 }
      );
    }

    if (!paymentConfig.receiving_wallet) {
      return NextResponse.json(
        { error: `The ${currency} receiving wallet is not configured.` },
        { status: 503 }
      );
    }

    if (!paymentConfig.token_mint) {
      return NextResponse.json(
        { error: `The ${currency} token mint is not configured.` },
        { status: 503 }
      );
    }

    const standardPrice = Number(adPackage.price_usdc);
    const durationDays = Number(adPackage.duration_days);

    if (
      !Number.isFinite(standardPrice) ||
      standardPrice <= 0 ||
      !Number.isInteger(durationDays) ||
      durationDays <= 0
    ) {
      return NextResponse.json(
        { error: "The selected advertising package has invalid settings." },
        { status: 500 }
      );
    }

    let amount = standardPrice;

    const discountPercent =
      Number(settings.rflx_discount_percent ?? 20);

    let rflxMarketPriceUsd: number | null = null;
    let rflxEquivalentAmount: number | null = null;

    if (currency === "RFLX") {
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

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Unable to calculate the advertising payment amount." },
        { status: 500 }
      );
    }

    const reference = createReference();

    const quoteTimestamp = new Date().toISOString();

    const metadata = {
      advertisement_id: advertisement.id,
      package_id: adPackage.id,
      package_name: adPackage.name,
      duration_days: durationDays,
      standard_price_usdc: standardPrice,
      discount_percent: currency === "RFLX" ? discountPercent : 0,
      token_mint: paymentConfig.token_mint,
      quote_timestamp: quoteTimestamp,
      ...(currency === "RFLX"
        ? {
            rflx_market_price_usd: rflxMarketPriceUsd,
            rflx_equivalent_amount: rflxEquivalentAmount,
            quoted_rflx_amount: amount,
            rflx_token_mint: paymentConfig.token_mint,
          }
        : {}),
    };

    const { data: payment, error: paymentError } = await admin
      .from("payment_records")
      .insert({
        user_id: user.id,
        payment_type: "advertisement",
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
      console.error(
        "Advertisement payment record insert failed:",
        paymentError
      );

      return NextResponse.json(
        { error: "Unable to create the advertising payment record." },
        { status: 500 }
      );
    }

    const { error: advertisementUpdateError } = await admin
      .from("advertisements")
      .update({
        package_id: adPackage.id,
        currency,
        amount,
        payment_record_id: payment.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", advertisement.id)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .is("payment_record_id", null);

    if (advertisementUpdateError) {
      await admin
        .from("payment_records")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      return NextResponse.json(
        { error: "Unable to attach the payment to the advertisement." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      payment,
      package: {
        id: adPackage.id,
        name: adPackage.name,
        duration_days: durationDays,
        price_usdc: standardPrice,
      },
      ...(currency === "RFLX"
        ? {
            quote: {
              marketPriceUsd: rflxMarketPriceUsd,
              equivalentAmount: rflxEquivalentAmount,
              discountPercent,
              finalAmount: amount,
              quotedAt: quoteTimestamp,
            },
          }
        : {}),
    });
  } catch (error) {
    console.error("Advertisement payment creation error:", error);

    return NextResponse.json(
      { error: "Unable to create the advertising payment." },
      { status: 500 }
    );
  }
}
