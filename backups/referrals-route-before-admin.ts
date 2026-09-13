import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateReferralCode(length = 8) {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < length; i++) {
    code += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  return code;
}

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
    };
  }

  return {
    supabase,
    user,
  };
}

async function ensureReferralProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data: existing, error: lookupError } =
    await supabase
      .from("referral_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existing) {
    return existing;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const referralCode = generateReferralCode();

    const { data, error } =
      await supabase
        .from("referral_profiles")
        .insert({
          user_id: userId,
          referral_code: referralCode,
        })
        .select("*")
        .single();

    if (!error && data) {
      return data;
    }

    if (
      !error?.message
        .toLowerCase()
        .includes("duplicate")
    ) {
      throw new Error(
        error?.message ||
          "Unable to create referral profile."
      );
    }
  }

  throw new Error(
    "Unable to generate a unique referral code."
  );
}

export async function GET() {
  try {
    const {
      supabase,
      user,
    } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be logged in to use referrals.",
        },
        { status: 401 }
      );
    }

    const profile =
      await ensureReferralProfile(
        supabase,
        user.id
      );

    const { data: referrals, error } =
      await supabase
        .from("referrals")
        .select(
          "id, referred_user_id, status, reward_scans, reward_granted, created_at, completed_at"
        )
        .eq("referrer_id", user.id)
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      profile,
      referrals: referrals ?? [],
    });
  } catch (error) {
    console.error(
      "Referral GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load referral information.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const {
      supabase,
      user,
    } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be logged in to use referrals.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const referralCode =
      typeof body?.referralCode === "string"
        ? body.referralCode
            .trim()
            .toUpperCase()
        : "";

    if (!referralCode) {
      return NextResponse.json(
        {
          success: false,
          error: "Referral code is required.",
        },
        { status: 400 }
      );
    }

    const { data: referrer, error: referrerError } =
      await supabase
        .from("referral_profiles")
        .select("user_id, referral_code")
        .eq("referral_code", referralCode)
        .maybeSingle();

    if (referrerError) {
      throw new Error(
        referrerError.message
      );
    }

    if (!referrer) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid referral code.",
        },
        { status: 404 }
      );
    }

    if (referrer.user_id === user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "You cannot use your own referral code.",
        },
        { status: 400 }
      );
    }

    const { data: existingReferral, error: existingError } =
      await supabase
        .from("referrals")
        .select("id")
        .eq("referred_user_id", user.id)
        .maybeSingle();

    if (existingError) {
      throw new Error(
        existingError.message
      );
    }

    if (existingReferral) {
      return NextResponse.json(
        {
          success: false,
          error: "This account has already used a referral.",
        },
        { status: 409 }
      );
    }

    const { data: referral, error: referralError } =
      await supabase
        .from("referrals")
        .insert({
          referrer_id: referrer.user_id,
          referred_user_id: user.id,
          referral_code: referralCode,
          status: "completed",
          reward_scans: 1,
          reward_granted: false,
          completed_at: new Date().toISOString(),
        })
        .select("*")
        .single();

    if (referralError) {
      if (
        referralError.message
          .toLowerCase()
          .includes("duplicate")
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This account has already used a referral.",
          },
          { status: 409 }
        );
      }

      throw new Error(
        referralError.message
      );
    }

    const { data: referrerProfile, error: profileError } =
      await supabase
        .from("referral_profiles")
        .select(
          "total_referrals, successful_referrals"
        )
        .eq("user_id", referrer.user_id)
        .single();

    if (profileError) {
      throw new Error(
        profileError.message
      );
    }

    const { error: updateError } =
      await supabase
        .from("referral_profiles")
        .update({
          total_referrals:
            (referrerProfile.total_referrals ?? 0) +
            1,
          successful_referrals:
            (referrerProfile.successful_referrals ?? 0) +
            1,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "user_id",
          referrer.user_id
        );

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    return NextResponse.json({
      success: true,
      referral,
      message:
        "Referral successfully recorded.",
    });
  } catch (error) {
    console.error(
      "Referral POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to process referral.",
      },
      { status: 500 }
    );
  }
}
