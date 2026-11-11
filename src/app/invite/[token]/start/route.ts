import { type NextRequest, NextResponse } from "next/server";

import {
  INVITE_COOKIE,
  INVITE_COOKIE_MAX_AGE,
  isInviteToken,
} from "@/features/connections/invite-token";

/**
 * "Create an account" / "Log in" on an invite: remember the invite in a
 * cookie (httpOnly, secure, sameSite=lax, 7 days) so the person comes back
 * to accept it after signing up, confirming and onboarding.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const then = request.nextUrl.searchParams.get("then") === "log-in" ? "/log-in" : "/sign-up";
  const valid = isInviteToken(token);
  const response = NextResponse.redirect(new URL(valid ? then : "/", request.url));
  if (valid) {
    response.cookies.set(INVITE_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: INVITE_COOKIE_MAX_AGE,
    });
  }
  return response;
}
