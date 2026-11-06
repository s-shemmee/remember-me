import { type NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/features/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google sends people back here: /auth/callback?code=…&next=/…
 * Exchanges the code for a session (PKCE), then goes to a same-site page only.
 * If they cancelled at Google, there is no code and we go back to log in.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/log-in?error=google", request.url));
}
