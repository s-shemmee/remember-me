"use client";

/**
 * "Skip to content": the first Tab stop on every page. Next keeps the
 * previous page in the document (hidden) after client navigation, so there
 * can be two <main id="main">; this focuses the visible one. Without
 * JavaScript, the plain #main link still works.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      onClick={(event) => {
        const main = [...document.querySelectorAll<HTMLElement>("main#main")].find(
          (m) => m.getClientRects().length > 0,
        );
        if (!main) return;
        event.preventDefault();
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
        main.focus();
        main.scrollIntoView({ block: "start" });
      }}
      className="sr-only z-50 rounded-pill bg-card px-5 font-semibold shadow-card focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:inline-flex focus:min-h-11 focus:items-center"
    >
      Skip to content
    </a>
  );
}
