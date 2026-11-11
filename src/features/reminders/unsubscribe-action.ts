"use server";

import { getEnv } from "@/lib/env";

import { looksLikeUnsubscribeToken } from "./unsubscribe-token";

export type UnsubscribeState = { status: "idle" | "done" | "invalid" | "error" };

/**
 * The /unsubscribe page's one button. The signature is checked by the
 * unsubscribe Edge Function (the secret never reaches the Next app).
 */
export async function unsubscribeEmail(
  _prev: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  const token = formData.get("token");
  if (!looksLikeUnsubscribeToken(token)) return { status: "invalid" };
  try {
    const res = await fetch(`${getEnv().NEXT_PUBLIC_SUPABASE_URL}/functions/v1/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    if (res.ok) return { status: "done" };
    return { status: res.status === 400 ? "invalid" : "error" };
  } catch {
    return { status: "error" };
  }
}
