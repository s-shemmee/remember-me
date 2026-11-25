"use client";

import * as React from "react";

import { NoorChatPanel } from "./chat-panel";

export type ChatFlags = { enabled: boolean };
export type OpenChat = { question?: string };

type ChatContextValue = { flags: ChatFlags; openChat: (opts?: OpenChat) => void };

const OFF: ChatContextValue = {
  flags: { enabled: false },
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
          firstQuestion={session.question}
          onClose={() => setSession(null)}
          returnFocus={() => opener.current}
        />
      )}
    </ChatContext>
  );
}
