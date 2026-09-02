import { createAdminClient } from "@/lib/supabase/server";

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

const ANONYMOUS_LIMIT = 30;
const REGISTERED_LIMIT = 5;
const PRO_LIMIT = 50;

export async function checkAndConsumeScan(
  visitorId: string | null
): Promise<ScanUsageResult> {
  const supabase = await createAdminClient();

  /*
   * =====================================================
   * IDENTIFY USER
   * =====================================================
   */

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * =====================================================
   * DETERMINE USER TYPE
   * =====================================================
   *
   * For now:
   *
   * Anonymous  = 3 scans/day
   * Registered = 5 scans/day
   * Pro        = 50 scans/day
   *
   * Pro subscription logic will be connected later.
   */

  let userType: ScanUserType = "anonymous";
  let limit = ANONYMOUS_LIMIT;

  if (user) {
    userType = "registered";
    limit = REGISTERED_LIMIT;

    /*
     * PRO WILL BE ENABLED HERE LATER.
     *
     * Example:
     *
     * if (userIsPro) {
     *   userType = "pro";
     *   limit = PRO_LIMIT;
     * }
     */
  }

  /*
   * Anonymous users must provide a visitor ID.
   */

  if (!user && !visitorId) {
    throw new Error(
      "Anonymous visitor ID is required."
    );
  }

  /*
   * =====================================================
   * TODAY
   * =====================================================
   */

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  /*
   * =====================================================
   * FIND EXISTING USAGE
   * =====================================================
   */

  let query = supabase
    .from("scan_usage")
    .select(
      "id, scan_count"
    )
    .eq("scan_date", today)
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
  } = await query.maybeSingle();

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
   * =====================================================
   * LIMIT REACHED
   * =====================================================
   */

  if (used >= limit) {
    return {
      allowed: false,
      userType,
      limit,
      used,
      remaining: 0,
    };
  }

  /*
   * =====================================================
   * CONSUME SCAN
   * =====================================================
   */

  const newCount =
    used + 1;

  if (existing) {
    const { error } =
      await supabase
        .from("scan_usage")
        .update({
          scan_count: newCount,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", existing.id);

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

      scan_date: today,

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
    limit,
    used: newCount,
    remaining:
      Math.max(
        0,
        limit - newCount
      ),
  };
}
