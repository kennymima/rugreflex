import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  const admin = await createAdminClient();
  const { data: adminUser } = await admin
    .from("admin_users")
    .select("user_id, role, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!adminUser || adminUser.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }

  return { admin };
}

export async function GET() {
  const result = await requireAdmin();

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  const { admin } = result;

  const usersResult = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (usersResult.error) {
    return NextResponse.json(
      { error: usersResult.error.message },
      { status: 500 }
    );
  }

  const users = usersResult.data.users;

  const userIds = users.map((user) => user.id);

  const [{ data: subscriptions }, { data: adminUsers }] = await Promise.all([
    userIds.length
      ? admin
          .from("pro_subscriptions")
          .select("user_id, status, starts_at, expires_at, currency")
          .in("user_id", userIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    userIds.length
      ? admin
          .from("admin_users")
          .select("user_id, role, active")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const subscriptionMap = new Map<string, { user_id: string; status: string; starts_at: string | null; expires_at: string | null; currency: string | null }>();

  for (const subscription of subscriptions ?? []) {
    if (!subscriptionMap.has(subscription.user_id)) {
      subscriptionMap.set(subscription.user_id, subscription);
    }
  }

  const adminMap = new Map(
    (adminUsers ?? []).map((item) => [item.user_id, item])
  );

  return NextResponse.json({
    users: users.map((user) => {
      const subscription = subscriptionMap.get(user.id);
      const adminRecord = adminMap.get(user.id);

      return {
        id: user.id,
        email: user.email ?? "",
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        pro_status: subscription?.status ?? "none",
        pro_expires_at: subscription?.expires_at ?? null,
        payment_currency: subscription?.currency ?? null,
        is_admin: Boolean(adminRecord?.active),
        role: adminRecord?.role ?? null,
      };
    }),
  });
}
