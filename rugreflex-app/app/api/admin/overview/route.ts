import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createAdminClient();

  const { data: adminUser, error: adminError } = await admin
    .from("admin_users")
    .select("role, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (adminError) {
    return NextResponse.json(
      { error: "Admin authorization failed" },
      { status: 500 }
    );
  }

  if (!adminUser || adminUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    usersResult,
    proUsersResult,
    pendingAdsResult,
    activeAdsResult,
    paymentsResult,
    expiredProResult,
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
    admin
      .from("pro_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    admin
      .from("advertisements")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("advertisements")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    admin
      .from("payment_records")
      .select("id", { count: "exact", head: true }),
    admin
      .from("pro_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "expired"),
  ]);

  const failedDatabaseQuery = [
    proUsersResult,
    pendingAdsResult,
    activeAdsResult,
    paymentsResult,
    expiredProResult,
  ].find((result) => result.error);

  if (failedDatabaseQuery || usersResult.error) {
    return NextResponse.json(
      { error: "Failed to load platform overview" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    totalUsers: usersResult.data?.total ?? 0,
    activeProUsers: proUsersResult.count ?? 0,
    expiredProUsers: expiredProResult.count ?? 0,
    pendingAdvertisements: pendingAdsResult.count ?? 0,
    activeAdvertisements: activeAdsResult.count ?? 0,
    paymentRecords: paymentsResult.count ?? 0,
  });
}
