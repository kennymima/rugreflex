import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const REFERRAL_COOKIE = "rugreflex_referral";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  const supabase = await createClient();

  if (code) {
    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(
        "Auth callback session exchange failed:",
        error
      );

      return NextResponse.redirect(
        new URL("/auth?error=confirmation_failed", requestUrl.origin)
      );
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const referralCookie = request.headers
      .get("cookie")
      ?.split("; ")
      .find((cookie) =>
        cookie.startsWith(`${REFERRAL_COOKIE}=`)
      );

    if (referralCookie) {
      const encodedCode = referralCookie.slice(
        `${REFERRAL_COOKIE}=`.length
      );

      let referralCode = "";

      try {
        referralCode = decodeURIComponent(encodedCode)
          .trim()
          .toUpperCase();
      } catch {
        referralCode = encodedCode
          .trim()
          .toUpperCase();
      }

      if (referralCode) {
        try {
          const admin = await createAdminClient();

          const {
            data: referrerProfile,
          } = await admin
            .from("referral_profiles")
            .select("user_id, referral_code")
            .eq("referral_code", referralCode)
            .maybeSingle();

          if (
            referrerProfile &&
            referrerProfile.user_id !== user.id
          ) {
            const {
              data: existingReferral,
            } = await admin
              .from("referrals")
              .select("id")
              .eq("referred_user_id", user.id)
              .maybeSingle();

            if (!existingReferral) {
              const {
                data: referral,
                error: referralError,
              } = await admin
                .from("referrals")
                .insert({
                  referrer_id:
                    referrerProfile.user_id,
                  referred_user_id:
                    user.id,
                  referral_code:
                    referralCode,
                  status: "completed",
                  reward_scans: 1,
                  reward_granted: false,
                  completed_at:
                    new Date().toISOString(),
                })
                .select("*")
                .single();

              if (!referralError && referral) {
                const {
                  error: rewardError,
                } = await admin
                  .from("referral_rewards")
                  .insert({
                    referrer_id:
                      referrerProfile.user_id,
                    referral_id:
                      referral.id,
                    reward_scans: 1,
                    scans_used: 0,
                    status: "available",
                  });

                if (rewardError) {
                  console.error(
                    "Referral reward creation failed:",
                    rewardError
                  );

                  await admin
                    .from("referrals")
                    .delete()
                    .eq("id", referral.id);
                } else {
                  const {
                    data: currentProfile,
                  } = await admin
                    .from("referral_profiles")
                    .select(
                      "total_referrals, successful_referrals, scans_earned"
                    )
                    .eq(
                      "user_id",
                      referrerProfile.user_id
                    )
                    .single();

                  if (currentProfile) {
                    await admin
                      .from("referral_profiles")
                      .update({
                        total_referrals:
                          (currentProfile.total_referrals ?? 0) +
                          1,
                        successful_referrals:
                          (currentProfile.successful_referrals ?? 0) +
                          1,
                        scans_earned:
                          (currentProfile.scans_earned ?? 0) +
                          1,
                        updated_at:
                          new Date().toISOString(),
                      })
                      .eq(
                        "user_id",
                        referrerProfile.user_id
                      );
                  }
                }
              } else if (referralError) {
                console.error(
                  "Referral creation failed:",
                  referralError
                );
              }
            }
          }
        } catch (referralError) {
          console.error(
            "Referral callback processing failed:",
            referralError
          );
        }
      }
    }
  }

  const response = NextResponse.redirect(
    new URL("/", requestUrl.origin)
  );

  response.cookies.set({
    name: REFERRAL_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
  });

  return response;
}
