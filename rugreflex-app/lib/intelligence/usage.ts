import { createAdminClient } from "@/lib/supabase/server";

export const RESEARCH_MONTHLY_LIMIT = Number(
  process.env.RUGREFLEX_RESEARCH_MONTHLY_LIMIT ?? 100
);

type ResearchUsageResult = {
  allowed: boolean;
  reason:
    | "allowed"
    | "unauthenticated"
    | "not_pro"
    | "limit_reached";
  used: number;
  remaining: number;
};

export async function checkAndConsumeResearch(): Promise<ResearchUsageResult> {
  const admin = await createAdminClient();

  const {
    data: { user },
  } = await admin.auth.getUser();

  if (!user) {
    return {
      allowed: false,
      reason: "unauthenticated",
      used: 0,
      remaining: 0,
    };
  }

  const { data: subscription } = await admin
    .from("pro_subscriptions")
    .select("status, expires_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isPro =
    subscription?.status === "active" &&
    Boolean(subscription.expires_at) &&
    new Date(subscription.expires_at).getTime() > Date.now();

  if (!isPro) {
    return {
      allowed: false,
      reason: "not_pro",
      used: 0,
      remaining: 0,
    };
  }

  const now = new Date();
  const usageMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  )
    .toISOString()
    .slice(0, 10);

  const { data, error } = await admin.rpc("consume_research_usage", {
    p_user_id: user.id,
    p_usage_month: usageMonth,
    p_monthly_limit: RESEARCH_MONTHLY_LIMIT,
  });

  if (error) {
    throw new Error("Unable to update research usage.");
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    throw new Error("Research usage response was empty.");
  }

  return {
    allowed: Boolean(result.allowed),
    reason: result.allowed ? "allowed" : "limit_reached",
    used: Number(result.used ?? 0),
    remaining: Number(result.remaining ?? 0),
  };
}
