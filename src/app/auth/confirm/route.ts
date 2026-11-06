import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/features/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "email",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
];

const isOtpType = (value: string | null): value is EmailOtpType =>
  value !== null && (OTP_TYPES as readonly string[]).includes(value);

/**
 * Email links land here: /auth/confirm?token_hash=…&type=email|recovery&next=/…
 * Verifies the token server side (sets the session cookie), then sends people
 * on to a same-site page only.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const fallback = type === "recovery" ? "/reset-password" : "/home";
  const next = safeNextPath(searchParams.get("next"), fallback);

  if (tokenHash && isOtpType(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/log-in?error=link", request.url));
}
