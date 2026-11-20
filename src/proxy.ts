import { type NextRequest, NextResponse } from "next/server";

import { decideRoute } from "@/features/auth/redirects";
import { isHelpSlug } from "@/features/help/slugs";
import { redirectWithCookies, updateSession } from "@/lib/supabase/proxy";

/**
 * Runs before matched requests (Next 16 "proxy", Node runtime):
 * refreshes the Supabase session, then guards app pages and the auth pages.
 */
export async function proxy(request: NextRequest) {
  // An unknown help article is a real 404 from the first request. (With
  // partial prerendering, the page itself would stream a 200 before
  // notFound() runs.)
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/help/") && !isHelpSlug(pathname.slice("/help/".length))) {
    return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  }

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
     * - _vercel (Vercel Web Analytics: /_vercel/insights)
     * - api/health (no session needed)
     * - favicon and image/font/text files
     * Keep in sync with src/proxy.test.ts.
     */
    "/((?!_next/static|_next/image|_vercel|monitoring|api/health|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|txt|xml)$).*)",
  ],
};
