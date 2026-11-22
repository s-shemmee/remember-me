import { connection } from "next/server";

import { aiEnabled } from "@/ai/config";
import { AskNoorChatBox } from "@/features/noor-chat/launchers";
import { noorChatEnabled } from "@/lib/flags";

import { AskNoorCard } from "./ask-noor-card";

/** Ask Noor, only when AI is on (AI_ENABLED, read per request). */
export async function AskNoorSection() {
  await connection();
  if (!aiEnabled()) return null;
  // With Noor's chat on, the box opens the chat panel instead.
  return noorChatEnabled() ? <AskNoorChatBox /> : <AskNoorCard />;
}
