import { connection } from "next/server";

import { aiEnabled } from "@/ai/config";

import { AskNoorCard } from "./ask-noor-card";

/** Ask Noor, only when AI is on (AI_ENABLED, read per request). */
export async function AskNoorSection() {
  await connection();
  if (!aiEnabled()) return null;
  return <AskNoorCard />;
}
