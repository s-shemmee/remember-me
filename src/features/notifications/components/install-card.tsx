"use client";

import { ShareIcon, SmartphoneIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";

import { installPromptStore, isStandalone, promptInstall } from "../browser";
import { installState, isAppleMobile } from "../device";
import { INSTALL_COPY } from "../messages";

const noop = () => () => undefined;
const isClient = () => true;
const isServer = () => false;

/**
 * Settings → App: "Install app" where the browser offers it, the Share →
 * Add to Home Screen steps on iPhone and iPad, or "installed".
 */
export function InstallCard() {
  const canPrompt = React.useSyncExternalStore(
    installPromptStore.subscribe,
    installPromptStore.get,
    installPromptStore.getServer,
  );
  // The server can't know how the app was opened: decide once mounted.
  const mounted = React.useSyncExternalStore(noop, isClient, isServer);
  const [message, setMessage] = React.useState("");

  const state = mounted
    ? installState({
        standalone: isStandalone(),
        canPrompt,
        appleMobile: isAppleMobile(navigator.userAgent, navigator.maxTouchPoints),
      })
    : null;

  const install = async () => {
    const accepted = await promptInstall();
    setMessage(accepted ? "Installed. You'll find Remember Me with your apps ✓" : "");
  };

  return (
    <section
      id="app"
      aria-labelledby="app-title"
      className="flex scroll-mt-6 flex-col gap-4 rounded-card-lg bg-card p-6 shadow-card sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="app-title"
          className="flex items-center gap-2 text-22 font-extrabold tracking-[-0.02em]"
        >
          <SmartphoneIcon aria-hidden className="size-5 text-accent-text" />
          App
        </h2>
        <p className="text-15 text-sub">Remember Me on your home screen</p>
      </div>
      {state === null ? (
        <div aria-busy="true" className="h-11" />
      ) : state === "ios" ? (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-15">
          <li>Open Remember Me in Safari.</li>
          <li>
            Tap the Share button <ShareIcon aria-hidden className="inline size-4 align-[-2px]" />.
          </li>
          <li>Choose Add to Home Screen, then Add.</li>
        </ol>
      ) : (
        <p className="text-15">{INSTALL_COPY[state]}</p>
      )}
      {state === "prompt" && (
        <Button className="w-fit" onClick={() => void install()}>
          Install app
        </Button>
      )}
      <p role="status" aria-live="polite" className="text-14 text-sub empty:hidden">
        {message}
      </p>
    </section>
  );
}
