import type { NextRequest } from "next/server";

import { decideRoute } from "@/features/auth/redirects";
import { redirectWithCookies, updateSession } from "@/lib/supabase/proxy";

/**
 * Runs before matched requests (Next 16 "proxy", Node runtime):
 * refreshes the Supabase session, then guards app pages and the auth pages.
 */
export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const decision = decideRoute(request.nextUrl.pathname, request.nextUrl.search, signedIn);

  if (decision.action === "redirect") {
    return redirectWithCookies(request, response(), decision.to);
  }
  return response();
}

export const config = {
  matcher: [
    /*
     * Everything except:
     * - _next/static, _next/image (build assets)
     * - monitoring (Sentry's tunnel route, see next.config.ts)
     * - api/health (no session needed)
     * - favicon and image/font/text files
     * Keep in sync with src/proxy.test.ts.
     */
    "/((?!_next/static|_next/image|monitoring|api/health|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|txt|xml)$).*)",
  ],
};
