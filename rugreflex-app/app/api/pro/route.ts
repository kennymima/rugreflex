import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const admin = await createAdminClient();

    const [{ data: settings }, { data: plans }, { data: payments }] =
      await Promise.all([
        admin
          .from("admin_settings")
          .select(
            "pro_enabled, payments_enabled, usdc_enabled, rflx_enabled, rflx_discount_percent"
          )
          .limit(1)
          .maybeSingle(),

        admin
          .from("pro_plans")
          .select("id, name, price_usdc, duration_days, features, active")
          .eq("active", true)
          .order("duration_days", { ascending: true }),

        admin
          .from("payment_config")
          .select("currency, enabled, network")
          .in("currency", ["USDC", "RFLX"]),
      ]);

    if (!settings?.pro_enabled) {
      return NextResponse.json({
        enabled: false,
        plans: [],
        payments: [],
      });
    }

    const enabledPayments = (payments ?? []).filter((payment) => {
      if (!payment.enabled) return false;

      if (payment.currency === "USDC") {
        return settings.usdc_enabled;
      }

      if (payment.currency === "RFLX") {
        return settings.rflx_enabled;
      }

      return false;
    });

    return NextResponse.json({
      enabled: true,
      plans: plans ?? [],
      payments: enabledPayments,
      ...(settings.rflx_enabled
        ? {
            rflxDiscountPercent:
              settings.rflx_discount_percent ?? 20,
          }
        : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load Pro configuration." },
      { status: 500 }
    );
  }
}
