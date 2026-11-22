"use client";

import * as React from "react";

import { NoorChatPanel } from "./chat-panel";

/** Who the chat is about, on a person's page (their next day that isn't gentle). */
export type ChatPerson = {
  personId: string;
  name: string;
  occasionId: string;
  occursOn: string;
};

export type ChatFlags = {
  /** NOOR_CHAT_ENABLED and AI_ENABLED: the panel, with help answers. */
  enabled: boolean;
  /** AI_GIFT_IDEAS_ENABLED: gift ideas inside the chat. */
  gifts: boolean;
  /** AI_MESSAGES_ENABLED: message drafts inside the chat. */
  messages: boolean;
};

/** What a launcher asks for: a person's context, a first question, or a flow to start. */
export type OpenChat = {
  person?: ChatPerson | null;
  question?: string;
  start?: "gifts" | "message";
};

type ChatContextValue = { flags: ChatFlags; openChat: (opts?: OpenChat) => void };

const OFF: ChatContextValue = {
  flags: { enabled: false, gifts: false, messages: false },
  openChat: () => {},
};
const ChatContext = React.createContext<ChatContextValue>(OFF);

/** The chat's flags and the way to open it (off, and a no-op, outside the provider). */
export function useNoorChat() {
  return React.useContext(ChatContext);
}

/**
 * Noor's chat for every signed-in page. No floating launcher: it opens from
 * Home's nudge card, a person's page, and Help & feedback. Nothing is stored:
 * closing clears the thread.
 */
export function NoorChatProvider({
  flags,
  children,
}: {
  flags: ChatFlags;
  children: React.ReactNode;
}) {
  const [session, setSession] = React.useState<(OpenChat & { key: number }) | null>(null);
  const opener = React.useRef<HTMLElement | null>(null);

  const openChat = React.useCallback(
    (opts: OpenChat = {}) => {
      if (!flags.enabled) return;
      opener.current = document.activeElement as HTMLElement | null;
      setSession({ ...opts, key: Date.now() });
    },
    [flags.enabled],
  );
  const value = React.useMemo(() => ({ flags, openChat }), [flags, openChat]);

  return (
    <ChatContext value={value}>
      {children}
      {flags.enabled && session && (
        <NoorChatPanel
          key={session.key}
          flags={flags}
          person={session.person ?? null}
          firstQuestion={session.question}
          start={session.start}
          onClose={() => setSession(null)}
          returnFocus={() => opener.current}
        />
      )}
    </ChatContext>
  );
}
