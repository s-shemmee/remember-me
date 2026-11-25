"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect } from "react";
import {
  Toaster as Sonner,
  toast as sonnerToast,
  type ExternalToast,
  type ToasterProps,
} from "sonner";

import { useIsDark } from "@/lib/use-theme";

/** Toasts with an action (like Undo) stay visible long enough to use it. */
export const ACTION_TOAST_MIN_MS = 6000;

/**
 * Sonner, restyled: card background, radius 24, card shadow, our fonts.
 * Follows the `.dark` class on <html> (no next-themes). Sonner pauses the
 * timer on hover and while focus is inside the toast region.
 * Mount once, in the root layout.
 */
function Toaster(props: ToasterProps) {
  const isDark = useIsDark();
  usePauseToastsOnFocus();

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      position="bottom-center"
      gap={12}
      icons={{
        success: <CircleCheckIcon className="size-5" aria-hidden />,
        info: <InfoIcon className="size-5" aria-hidden />,
        warning: <TriangleAlertIcon className="size-5" aria-hidden />,
        error: <OctagonXIcon className="size-5" aria-hidden />,
        loading: <Loader2Icon className="size-5 animate-spin" aria-hidden />,
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--line)",
          "--border-radius": "24px",
          "--width": "min(380px, calc(100vw - 32px))",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "!font-sans !text-15 !shadow-card !gap-3 !px-5 !py-4",
          title: "!font-semibold",
          description: "!text-sub !text-13",
          actionButton:
            "!min-h-11 !rounded-pill !bg-accent !px-4 !text-15 !font-semibold !text-on-accent",
          cancelButton:
            "!min-h-11 !rounded-pill !bg-card2 !px-4 !text-15 !font-semibold !text-text",
        },
      }}
      {...props}
    />
  );
}

/**
 * Sonner pauses its timers while the list is "expanded", which only happens
 * on hover. Keyboard users who Tab into a toast need the same pause, so when
 * focus enters the list we send it the mouse event that expands it, and when
 * focus leaves we send the one that collapses it.
 */
function usePauseToastsOnFocus() {
  useEffect(() => {
    const listOf = (node: EventTarget | null) =>
      node instanceof Element ? node.closest<HTMLElement>("[data-sonner-toaster]") : null;

    const onFocusIn = (event: FocusEvent) => {
      const list = listOf(event.target);
      if (list && !list.contains(event.relatedTarget as Node | null)) {
        list.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      const list = listOf(event.target);
      if (list && !list.contains(event.relatedTarget as Node | null)) {
        list.dispatchEvent(
          new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }),
        );
      }
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
}

type ToastOptions = ExternalToast;

function withActionMinimum(options?: ToastOptions): ToastOptions | undefined {
  if (!options?.action) return options;
  return { ...options, duration: Math.max(options.duration ?? 0, ACTION_TOAST_MIN_MS) };
}

/**
 * Our `toast`: Sonner's, but any toast with an action is kept for at least
 * ACTION_TOAST_MIN_MS so people have time to Undo.
 */
const toast = Object.assign(
  (message: Parameters<typeof sonnerToast>[0], options?: ToastOptions) =>
    sonnerToast(message, withActionMinimum(options)),
  {
    success: (message: Parameters<typeof sonnerToast.success>[0], options?: ToastOptions) =>
      sonnerToast.success(message, withActionMinimum(options)),
    error: (message: Parameters<typeof sonnerToast.error>[0], options?: ToastOptions) =>
      sonnerToast.error(message, withActionMinimum(options)),
    info: (message: Parameters<typeof sonnerToast.info>[0], options?: ToastOptions) =>
      sonnerToast.info(message, withActionMinimum(options)),
    dismiss: sonnerToast.dismiss,
  },
);

export { Toaster, toast, withActionMinimum };
