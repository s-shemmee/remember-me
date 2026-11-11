import { type NextRequest, NextResponse } from "next/server";

import { INVITE_COOKIE, isInviteToken } from "@/features/connections/invite-token";

/**
 * Back to the invite that was waiting. The app layout sends people here
 * once (after sign-up, log-in or onboarding); the cookie is cleared so it
 * never redirects again.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(INVITE_COOKIE)?.value;
  const response = NextResponse.redirect(
    new URL(isInviteToken(token) ? `/invite/${token}` : "/home", request.url),
  );
  response.cookies.delete(INVITE_COOKIE);
  return response;
}
