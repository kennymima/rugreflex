import { NextResponse } from "next/server";
import {
  createClient,
  createAdminClient,
} from "@/lib/supabase/server";

function generateReferralCode(length = 8) {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < length; i++) {
    code += characters.charAt(
      Math.floor(
        Math.random() * characters.length
      )
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
    return null;
  }

  return user;
}

async function ensureReferralProfile(
  supabase: Awaited<
    ReturnType<typeof createAdminClient>
  >,
  userId: string
) {
  const {
    data: existing,
    error: lookupError,
  } = await supabase
    .from("referral_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      lookupError.message
    );
  }

  if (existing) {
    return existing;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const referralCode =
      generateReferralCode();

    const {
      data,
      error,
    } = await supabase
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

/*
 * =====================================================
 * GET REFERRAL DASHBOARD
 * =====================================================
 */

export async function GET() {
  try {
    const user =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const supabase =
      await createAdminClient();

    const profile =
      await ensureReferralProfile(
        supabase,
        user.id
      );

    const {
      data: referrals,
      error: referralsError,
    } = await supabase
      .from("referrals")
      .select(
        "id, referral_code, status, reward_scans, reward_granted, created_at, completed_at"
      )
      .eq(
        "referrer_id",
        user.id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (referralsError) {
      throw new Error(
        referralsError.message
      );
    }

    const {
      data: rewards,
      error: rewardsError,
    } = await supabase
      .from("referral_rewards")
      .select(
        "id, referral_id, reward_scans, scans_used, status, created_at, updated_at"
      )
      .eq(
        "referrer_id",
        user.id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (rewardsError) {
      throw new Error(
        rewardsError.message
      );
    }

    return NextResponse.json({
      success: true,
      profile,
      referrals:
        referrals ?? [],
      rewards:
        rewards ?? [],
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
            : "Unable to load referral data.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =====================================================
 * RECORD SUCCESSFUL REFERRAL
 * =====================================================
 */

export async function POST(
  request: Request
) {
  try {
    const user =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const referralCode =
      typeof body?.referralCode ===
      "string"
        ? body.referralCode
            .trim()
            .toUpperCase()
        : "";

    if (!referralCode) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Referral code is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      await createAdminClient();

    /*
     * Find the referrer.
     */

    const {
      data: referrerProfile,
      error:
        referrerError,
    } = await supabase
      .from("referral_profiles")
      .select(
        "user_id, referral_code"
      )
      .eq(
        "referral_code",
        referralCode
      )
      .maybeSingle();

    if (referrerError) {
      throw new Error(
        referrerError.message
      );
    }

    if (!referrerProfile) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid referral code.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Prevent self-referral.
     */

    if (
      referrerProfile.user_id ===
      user.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You cannot refer yourself.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Prevent the same account from
     * being referred more than once.
     */

    const {
      data: existingReferral,
      error:
        existingReferralError,
    } = await supabase
      .from("referrals")
      .select(
        "id, referrer_id, status, reward_granted"
      )
      .eq(
        "referred_user_id",
        user.id
      )
      .maybeSingle();

    if (existingReferralError) {
      throw new Error(
        existingReferralError.message
      );
    }

    if (existingReferral) {
      return NextResponse.json({
        success: true,
        alreadyReferred: true,
        message:
          "This account has already been referred.",
      });
    }

    /*
     * Create the successful referral.
     *
     * The reward is created separately.
     * This keeps referral rewards independent
     * from the existing scan allowance system.
     */

    const {
      data: referral,
      error: referralError,
    } = await supabase
      .from("referrals")
      .insert({
        referrer_id:
          referrerProfile.user_id,

        referred_user_id:
          user.id,

        referral_code:
          referralCode,

        status:
          "completed",

        reward_scans: 1,

        reward_granted: false,

        completed_at:
          new Date().toISOString(),
      })
      .select("*")
      .single();

    if (referralError) {
      throw new Error(
        referralError.message
      );
    }

    /*
     * Create exactly one reward ledger entry.
     */

    const {
      data: reward,
      error: rewardError,
    } = await supabase
      .from("referral_rewards")
      .insert({
        referrer_id:
          referrerProfile.user_id,

        referral_id:
          referral.id,

        reward_scans: 1,

        scans_used: 0,

        status:
          "available",
      })
      .select("*")
      .single();

    if (rewardError) {
      /*
       * If reward creation fails, remove the
       * referral we just created so we do not
       * leave an incomplete referral behind.
       */

      await supabase
        .from("referrals")
        .delete()
        .eq(
          "id",
          referral.id
        );

      throw new Error(
        rewardError.message
      );
    }

    /*
     * Update referrer statistics.
     */

    const {
      data: currentProfile,
      error:
        currentProfileError,
    } = await supabase
      .from("referral_profiles")
      .select(
        "total_referrals, successful_referrals"
      )
      .eq(
        "user_id",
        referrerProfile.user_id
      )
      .single();

    if (currentProfileError) {
      throw new Error(
        currentProfileError.message
      );
    }

    const {
      error: updateProfileError,
    } = await supabase
      .from("referral_profiles")
      .update({
        total_referrals:
          (currentProfile.total_referrals ??
            0) + 1,

        successful_referrals:
          (currentProfile.successful_referrals ??
            0) + 1,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "user_id",
        referrerProfile.user_id
      );

    if (updateProfileError) {
      throw new Error(
        updateProfileError.message
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Referral recorded successfully.",
      referral,
      reward,
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
      {
        status: 500,
      }
    );
  }
}
