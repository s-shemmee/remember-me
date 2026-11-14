"use client";

import * as React from "react";

import { listenForInstallPrompt } from "../browser";

/** Catches the browser's install prompt on any app page, for Settings → App. */
export function InstallPromptListener() {
  React.useEffect(() => listenForInstallPrompt(), []);
  return null;
}
