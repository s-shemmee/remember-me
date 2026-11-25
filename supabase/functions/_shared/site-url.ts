export function resolveAppUrl(configured: string | undefined, local: boolean): string {
  if (configured) return configured.replace(/\/+$/, "");
  if (local) return "http://localhost:3000";
  throw new Error("SITE_URL is required when using a non-local Supabase instance.");
}
