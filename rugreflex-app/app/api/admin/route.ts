import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = await createAdminClient();

  const { data, error } = await admin
    .from("admin_users")
    .select("role, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json(
        { error: "Admin authorization failed" },
        { status: 500 }
      ),
    };
  }

  if (!data || data.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { admin };
}

export async function GET() {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  const admin = auth.admin;

  const [
    { data: settings, error: settingsError },
    { data: plans, error: plansError },
    { data: paymentConfig, error: paymentError },
    { data: adPackages, error: adPackagesError },
  ] = await Promise.all([
    admin.from("admin_settings").select("*").limit(1).maybeSingle(),
    admin.from("pro_plans").select("*").order("duration_days", {
      ascending: true,
    }),
    admin.from("payment_config").select("*").order("id", {
      ascending: true,
    }),
    admin.from("ad_packages").select("*").order("duration_days", {
      ascending: true,
    }),
  ]);

  if (
    settingsError ||
    plansError ||
    paymentError ||
    adPackagesError
  ) {
    return NextResponse.json(
      { error: "Failed to load admin configuration" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    settings,
    plans: plans ?? [],
    paymentConfig: paymentConfig ?? [],
    adPackages: adPackages ?? [],
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  const admin = auth.admin;
  const body = await request.json();

  /*
   * Global feature settings
   */
  const allowedSettings = [
    "pro_enabled",
    "ads_enabled",
    "payments_enabled",
    "usdc_enabled",
    "rflx_enabled",
    "rflx_discount_percent",
  ];

  const updates: Record<string, unknown> = {};

  for (const key of allowedSettings) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from("admin_settings")
      .update(updates)
      .eq("id", 1)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update admin settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings: data });
  }

  /*
   * Payment configuration
   */
  if (body.paymentConfig) {
    const config = body.paymentConfig;

    if (!["USDC", "RFLX"].includes(config.currency)) {
      return NextResponse.json(
        { error: "Unsupported payment currency" },
        { status: 400 }
      );
    }

    const paymentUpdates: Record<string, unknown> = {};

    if ("enabled" in config) paymentUpdates.enabled = Boolean(config.enabled);
    if ("network" in config) paymentUpdates.network = config.network;
    if ("receiving_wallet" in config) {
      paymentUpdates.receiving_wallet = config.receiving_wallet;
    }

    paymentUpdates.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from("payment_config")
      .update(paymentUpdates)
      .eq("currency", config.currency)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update payment configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ paymentConfig: data });
  }

  /*
   * Pro plan configuration
   */
  if (body.proPlan) {
    const plan = body.proPlan;

    if (!plan.id) {
      return NextResponse.json(
        { error: "Pro plan ID is required" },
        { status: 400 }
      );
    }

    const planUpdates: Record<string, unknown> = {};

    if ("name" in plan) planUpdates.name = plan.name;
    if ("price_usdc" in plan) planUpdates.price_usdc = plan.price_usdc;
    if ("duration_days" in plan) {
      planUpdates.duration_days = plan.duration_days;
    }
    if ("active" in plan) planUpdates.active = Boolean(plan.active);

    planUpdates.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from("pro_plans")
      .update(planUpdates)
      .eq("id", plan.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update Pro plan" },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan: data });
  }

  /*
   * Advertisement package configuration
   */
  if (body.adPackage) {
    const packageData = body.adPackage;

    if (!packageData.id) {
      return NextResponse.json(
        { error: "Advertisement package ID is required" },
        { status: 400 }
      );
    }

    const packageUpdates: Record<string, unknown> = {};

    if ("name" in packageData) {
      packageUpdates.name = packageData.name;
    }

    if ("duration_days" in packageData) {
      packageUpdates.duration_days = packageData.duration_days;
    }

    if ("price_usdc" in packageData) {
      packageUpdates.price_usdc = packageData.price_usdc;
    }

    if ("active" in packageData) {
      packageUpdates.active = Boolean(packageData.active);
    }

    packageUpdates.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from("ad_packages")
      .update(packageUpdates)
      .eq("id", packageData.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update advertisement package" },
        { status: 500 }
      );
    }

    return NextResponse.json({ adPackage: data });
  }

  return NextResponse.json(
    { error: "No valid configuration supplied" },
    { status: 400 }
  );
}
