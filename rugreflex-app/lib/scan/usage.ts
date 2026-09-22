import {
  createAdminClient,
  createClient,
} from "@/lib/supabase/server";

export type ScanUserType =
  | "anonymous"
  | "registered"
  | "pro";

export type ScanUsageResult = {
  allowed: boolean;
  userType: ScanUserType;
  limit: number;
  used: number;
  remaining: number;
};

const ANONYMOUS_LIMIT = 3;
const REGISTERED_LIMIT = 5;
const PRO_LIMIT = 50;

async function getReferralBonusScans(
  userId: string
) {
  const supabase = await createAdminClient();

  const {
    data: rewards,
    error,
  } = await supabase
    .from("referral_rewards")
    .select(
      "id, reward_scans, scans_used, status"
    )
    .eq("referrer_id", userId)
    .in("status", [
      "available",
      "partially_used",
    ])
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Referral reward lookup error:",
      error
    );

    return {
      available: 0,
      rewards: [],
    };
  }

  const normalizedRewards =
    Array.isArray(rewards)
      ? rewards
      : [];

  const available =
    normalizedRewards.reduce(
      (total, reward) => {
        const rewardScans =
          Number(
            reward.reward_scans
          ) || 0;

        const scansUsed =
          Number(
            reward.scans_used
          ) || 0;

        return (
          total +
          Math.max(
            0,
            rewardScans - scansUsed
          )
        );
      },
      0
    );

  return {
    available,
    rewards:
      normalizedRewards,
  };
}

async function consumeReferralBonusScan(
  userId: string
) {
  const supabase = await createAdminClient();

  const {
    data: rewards,
    error,
  } = await supabase
    .from("referral_rewards")
    .select(
      "id, reward_scans, scans_used"
    )
    .eq("referrer_id", userId)
    .in("status", [
      "available",
      "partially_used",
    ])
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Referral reward consumption lookup error:",
      error
    );

    return false;
  }

  const rewardList =
    Array.isArray(rewards)
      ? rewards
      : [];

  for (const reward of rewardList) {
    const rewardScans =
      Number(
        reward.reward_scans
      ) || 0;

    const scansUsed =
      Number(
        reward.scans_used
      ) || 0;

    const remaining =
      rewardScans - scansUsed;

    if (remaining <= 0) {
      continue;
    }

    const newUsed =
      scansUsed + 1;

    const newStatus =
      newUsed >= rewardScans
        ? "used"
        : "partially_used";

    const { error: updateError } =
      await supabase
        .from("referral_rewards")
        .update({
          scans_used: newUsed,
          status: newStatus,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", reward.id)
        .eq(
          "scans_used",
          scansUsed
        );

    if (!updateError) {
      return true;
    }

    console.error(
      "Referral reward consumption update error:",
      updateError
    );
  }

  return false;
}

export async function checkAndConsumeScan(
  visitorId: string | null
): Promise<ScanUsageResult> {
  const authClient =
    await createClient();

  const {
    data: { user },
  } =
    await authClient.auth.getUser();

  const supabase =
    await createAdminClient();

  let userType: ScanUserType =
    "anonymous";

  let limit =
    ANONYMOUS_LIMIT;

  if (user) {
    const { data: subscription } =
      await supabase
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

    if (isPro) {
      userType = "pro";
      limit = PRO_LIMIT;
    } else {
      userType = "registered";
      limit = REGISTERED_LIMIT;
    }
  }

  if (!user && !visitorId) {
    throw new Error(
      "Anonymous visitor ID is required."
    );
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  let query = supabase
    .from("scan_usage")
    .select(
      "id, scan_count"
    )
    .eq(
      "scan_date",
      today
    )
    .limit(1);

  if (user) {
    query = query.eq(
      "user_id",
      user.id
    );
  } else {
    query = query.eq(
      "visitor_id",
      visitorId!
    );
  }

  const {
    data: existing,
    error: lookupError,
  } =
    await query.maybeSingle();

  if (lookupError) {
    console.error(
      "Scan usage lookup error:",
      lookupError
    );

    throw new Error(
      "Unable to check scan allowance."
    );
  }

  const used =
    existing?.scan_count ?? 0;

  /*
   * Referral bonuses apply only to
   * authenticated registered users.
   *
   * The normal 5/day allowance is
   * always consumed first.
   */
  let referralBonus = 0;

  if (user) {
    const bonus =
      await getReferralBonusScans(
        user.id
      );

    referralBonus =
      bonus.available;
  }

  const totalAvailable =
    limit + referralBonus;

  if (
    used >= totalAvailable
  ) {
    return {
      allowed: false,
      userType,
      limit: totalAvailable,
      used,
      remaining: 0,
    };
  }

  /*
   * Normal daily allowance:
   * continue using scan_usage exactly
   * as before.
   */
  if (used < limit) {
    const newCount =
      used + 1;

    if (existing) {
      const { error } =
        await supabase
          .from("scan_usage")
          .update({
            scan_count:
              newCount,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            existing.id
          );

      if (error) {
        console.error(
          "Scan usage update error:",
          error
        );

        throw new Error(
          "Unable to record scan usage."
        );
      }
    } else {
      const row = {
        user_id:
          user?.id ?? null,

        visitor_id:
          user
            ? null
            : visitorId,

        scan_date:
          today,

        scan_count: 1,

        updated_at:
          new Date().toISOString(),
      };

      const { error } =
        await supabase
          .from("scan_usage")
          .insert(row);

      if (error) {
        console.error(
          "Scan usage insert error:",
          error
        );

        throw new Error(
          "Unable to record scan usage."
        );
      }
    }

    return {
      allowed: true,
      userType,
      limit: totalAvailable,
      used: newCount,
      remaining:
        Math.max(
          0,
          totalAvailable -
            newCount
        ),
    };
  }

  /*
   * Base allowance has been exhausted.
   * Consume one referral reward instead.
   *
   * scan_usage is deliberately NOT
   * increased for referral scans.
   */
  if (
    user &&
    referralBonus > 0
  ) {
    const consumed =
      await consumeReferralBonusScan(
        user.id
      );

    if (consumed) {
      return {
        allowed: true,
        userType,
        limit: totalAvailable,
        used,
        remaining:
          Math.max(
            0,
            totalAvailable -
              (used + 1)
          ),
      };
    }
  }

  return {
    allowed: false,
    userType,
    limit: totalAvailable,
    used,
    remaining: 0,
  };
}
