import { HELP_SLUGS } from "@/features/help/slugs";
import { siteUrl } from "@/lib/env";
import { connection } from "next/server";

export async function GET() {
  await connection();
  const base = siteUrl();
  const links = [
    ["Remember Me", "/"],
    ["Sign up", "/sign-up"],
    ["Help center", "/help"],
    ...HELP_SLUGS.map((slug) => [slug, `/help/${slug}`]),
    ["Privacy Policy", "/privacy"],
    ["Terms of use", "/terms"],
  ] as const;
  const body = [
    "# Remember Me",
    "",
    "> A web app for remembering birthdays and special days, sharing wishlists, and planning celebrations.",
    "",
    ...links.map(([label, path]) => `- [${label}](${base}${path})`),
    "- Contact: contact@shemme.codes",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
