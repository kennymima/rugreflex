import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = await createAdminClient();

  const { data } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ? admin : null;
}

export async function GET() {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { data, error } = await admin
      .from("advertisements")
      .select("*, ad_packages(*)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Unable to load advertising requests." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      advertisements: data || [],
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load advertising requests." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const id = Number(body.id);
    const status = body.status;

    if (
      !Number.isInteger(id) ||
      !["approved", "rejected"].includes(status)
    ) {
      return NextResponse.json(
        { error: "Invalid advertisement update." },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("advertisements")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending_review")
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Advertising request could not be updated." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      advertisement: data,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid advertising update." },
      { status: 400 }
    );
  }
}
