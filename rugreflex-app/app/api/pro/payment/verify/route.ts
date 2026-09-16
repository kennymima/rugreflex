import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type PaymentRecord = {
  id: number;
  user_id: string | null;
  payment_type: string;
  reference: string | null;
  currency: string;
  network: string;
  amount: number;
  receiving_wallet: string | null;
  transaction_signature: string | null;
  status: string;
  metadata: {
    plan_id?: number;
    plan_name?: string;
    duration_days?: number;
  } | null;
};

type TokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: {
    amount: string;
    decimals: number;
  };
};

function getHeliusRpcUrl() {
  const key = process.env.HELIUS_API_KEY;

  if (!key) {
    throw new Error("HELIUS_API_KEY is missing.");
  }

  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

async function getTransaction(signature: string) {
  const response = await fetch(getHeliusRpcUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "rugreflex-pro-payment-verification",
      method: "getTransaction",
      params: [
        signature,
        {
          encoding: "jsonParsed",
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Helius transaction request failed: ${response.status}`);
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(
      json.error.message || "Unable to retrieve Solana transaction."
    );
  }

  return json.result;
}

function tokenBalanceDelta(
  pre: TokenBalance[] | null | undefined,
  post: TokenBalance[] | null | undefined,
  mint: string,
  owner: string
) {
  const preByAccount = new Map<number, bigint>();
  const postByAccount = new Map<number, bigint>();

  for (const balance of pre ?? []) {
    if (
      balance.mint === mint &&
      balance.owner === owner
    ) {
      preByAccount.set(
        balance.accountIndex,
        BigInt(balance.uiTokenAmount.amount)
      );
    }
  }

  for (const balance of post ?? []) {
    if (
      balance.mint === mint &&
      balance.owner === owner
    ) {
      postByAccount.set(
        balance.accountIndex,
        BigInt(balance.uiTokenAmount.amount)
      );
    }
  }

  const accountIndexes = new Set([
    ...preByAccount.keys(),
    ...postByAccount.keys(),
  ]);

  let delta = BigInt(0);

  for (const accountIndex of accountIndexes) {
    delta +=
      (postByAccount.get(accountIndex) ?? BigInt(0)) -
      (preByAccount.get(accountIndex) ?? BigInt(0));
  }

  return delta;
}

function amountToBaseUnits(
  amount: number,
  decimals: number
) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid payment amount.");
  }

  const multiplier = 10 ** decimals;
  const units = Math.round(amount * multiplier);

  return BigInt(units);
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

    const reference =
      typeof body?.reference === "string"
        ? body.reference.trim()
        : "";

    const transactionSignature =
      typeof body?.transactionSignature === "string"
        ? body.transactionSignature.trim()
        : "";

    if (!reference || !transactionSignature) {
      return NextResponse.json(
        {
          error:
            "Payment reference and transaction signature are required.",
        },
        { status: 400 }
      );
    }

    const admin = await createAdminClient();

    const { data: payment, error: paymentError } =
      await admin
        .from("payment_records")
        .select(
          "id, user_id, payment_type, reference, currency, network, amount, receiving_wallet, transaction_signature, status, metadata"
        )
        .eq("reference", reference)
        .eq("payment_type", "pro")
        .maybeSingle<PaymentRecord>();

    if (paymentError) {
      return NextResponse.json(
        { error: "Unable to load the payment record." },
        { status: 500 }
      );
    }

    if (!payment) {
      return NextResponse.json(
        { error: "Payment record not found." },
        { status: 404 }
      );
    }

    if (payment.user_id !== user.id) {
      return NextResponse.json(
        { error: "This payment does not belong to the current user." },
        { status: 403 }
      );
    }

    if (payment.status !== "pending") {
      return NextResponse.json(
        {
          error: `This payment is already ${payment.status}.`,
        },
        { status: 409 }
      );
    }

    if (payment.network !== "Solana") {
      return NextResponse.json(
        { error: "Only Solana payments can be verified here." },
        { status: 400 }
      );
    }

    if (!payment.receiving_wallet) {
      return NextResponse.json(
        { error: "The payment receiving wallet is not configured." },
        { status: 503 }
      );
    }

    const {
      data: paymentConfig,
      error: configError,
    } = await admin
      .from("payment_config")
      .select(
        "currency, enabled, network, receiving_wallet, token_mint"
      )
      .eq("currency", payment.currency)
      .maybeSingle();

    if (configError) {
      return NextResponse.json(
        { error: "Unable to load payment verification configuration." },
        { status: 500 }
      );
    }

    if (!paymentConfig?.enabled) {
      return NextResponse.json(
        {
          error: `${payment.currency} payments are currently disabled.`,
        },
        { status: 403 }
      );
    }

    if (
      paymentConfig.network !== "Solana" ||
      !paymentConfig.token_mint
    ) {
      return NextResponse.json(
        {
          error:
            `${payment.currency} payment verification is not fully configured.`,
        },
        { status: 503 }
      );
    }

    if (
      paymentConfig.receiving_wallet &&
      paymentConfig.receiving_wallet !== payment.receiving_wallet
    ) {
      return NextResponse.json(
        {
          error:
            "The payment receiving wallet no longer matches the payment record.",
        },
        { status: 409 }
      );
    }

    const {
      data: existingSignature,
      error: signatureError,
    } = await admin
      .from("payment_records")
      .select("id, reference")
      .eq("transaction_signature", transactionSignature)
      .maybeSingle();

    if (signatureError) {
      return NextResponse.json(
        { error: "Unable to check transaction reuse." },
        { status: 500 }
      );
    }

    if (existingSignature) {
      return NextResponse.json(
        {
          error:
            "This Solana transaction has already been used for a payment.",
        },
        { status: 409 }
      );
    }

    const transaction = await getTransaction(
      transactionSignature
    );

    if (!transaction) {
      return NextResponse.json(
        {
          error:
            "The Solana transaction could not be found yet. Wait for confirmation and try again.",
        },
        { status: 400 }
      );
    }

    if (transaction.meta?.err) {
      return NextResponse.json(
        {
          error: "The Solana transaction failed.",
        },
        { status: 400 }
      );
    }

    const preTokenBalances =
      transaction.meta?.preTokenBalances as TokenBalance[] | undefined;

    const postTokenBalances =
      transaction.meta?.postTokenBalances as TokenBalance[] | undefined;

    const destinationDelta = tokenBalanceDelta(
      preTokenBalances,
      postTokenBalances,
      paymentConfig.token_mint,
      payment.receiving_wallet
    );

    const destinationBalance = [
      ...(preTokenBalances ?? []),
      ...(postTokenBalances ?? []),
    ].find(
      (balance) =>
        balance.mint === paymentConfig.token_mint &&
        balance.owner === payment.receiving_wallet
    );

    if (!destinationBalance) {
      return NextResponse.json(
        {
          error:
            "No matching SPL token transfer to the configured receiving wallet was found.",
        },
        { status: 400 }
      );
    }

    const decimals =
      destinationBalance.uiTokenAmount.decimals;

    const expectedAmount = amountToBaseUnits(
      Number(payment.amount),
      decimals
    );

    if (destinationDelta !== expectedAmount) {
      return NextResponse.json(
        {
          error:
            "The verified token amount does not match the required Pro payment.",
        },
        { status: 400 }
      );
    }

    const planId = Number(payment.metadata?.plan_id);

    if (!Number.isInteger(planId) || planId <= 0) {
      return NextResponse.json(
        {
          error:
            "The payment does not contain a valid Pro plan reference.",
        },
        { status: 500 }
      );
    }

    const { data: plan, error: planError } =
      await admin
        .from("pro_plans")
        .select("id, name, duration_days, active")
        .eq("id", planId)
        .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "The associated Pro plan could not be loaded." },
        { status: 500 }
      );
    }

    if (!plan.active) {
      return NextResponse.json(
        {
          error:
            "The associated Pro plan is no longer active.",
        },
        { status: 409 }
      );
    }

    const now = new Date();

    const { data: activeSubscription } =
      await admin
        .from("pro_subscriptions")
        .select("expires_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("expires_at", now.toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const startDate =
      activeSubscription?.expires_at &&
      new Date(activeSubscription.expires_at) > now
        ? new Date(activeSubscription.expires_at)
        : now;

    const expiresDate = new Date(startDate);
    expiresDate.setUTCDate(
      expiresDate.getUTCDate() + Number(plan.duration_days)
    );

    const { data: updatedPayment, error: updateError } =
      await admin
        .from("payment_records")
        .update({
          transaction_signature: transactionSignature,
          status: "verified",
          verified_at: now.toISOString(),
        })
        .eq("id", payment.id)
        .eq("status", "pending")
        .select(
          "id, reference, currency, amount, transaction_signature, status, verified_at"
        )
        .maybeSingle();

    if (updateError || !updatedPayment) {
      return NextResponse.json(
        {
          error:
            "The payment could not be finalized. Please retry verification.",
        },
        { status: 409 }
      );
    }

    const { data: subscription, error: subscriptionError } =
      await admin
        .from("pro_subscriptions")
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          status: "active",
          currency: payment.currency,
          amount: payment.amount,
          starts_at: startDate.toISOString(),
          expires_at: expiresDate.toISOString(),
          payment_record_id: payment.id,
        })
        .select(
          "id, plan_id, status, currency, amount, starts_at, expires_at, payment_record_id"
        )
        .single();

    if (subscriptionError || !subscription) {
      return NextResponse.json(
        {
          error:
            "Payment was verified, but Pro activation could not be completed automatically.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified and RugReflex Pro activated.",
      payment: updatedPayment,
      subscription,
    });
  } catch (error) {
    console.error("Pro payment verification error:", error);

    return NextResponse.json(
      {
        error:
          "Unable to verify the Pro payment at this time.",
      },
      { status: 500 }
    );
  }
}
