import { expect, type Page, test } from "@playwright/test";

import { expectAccessible, signUpAndOnboard } from "./helpers";

/**
 * CTA audit on the real pages: every button and link-button (and switch,
 * tab, radio and menu item) on the landing, auth and app pages, at 390 and
 * 1440, light and dark:
 * - a 44×44 target, and a filled button never matches the surface behind it;
 * - a visible focus ring from the keyboard (outline or ring shadow);
 * - hover never makes it match the surface behind it, and shows a change;
 * - text contrast via axe (expectAccessible).
 * The matrix of every variant and state is in e2e/ui-buttons.spec.ts.
 */
const CONTROLS =
  "button, a[data-slot=button], a[class*=rounded-pill], a[class*=bg-], [role=button], [role=switch], [role=tab], [role=radio], [role=menuitem], summary";

type Finding = string;

/** Runs in the page: what each control looks like right now. */
function snapshot(selector: string) {
  const parse = (c: string) => {
    const n = (c.match(/[\d.]+/g) ?? ["0", "0", "0", "0"]).map(Number);
    return c.startsWith("color(")
      ? [n[0]! * 255, n[1]! * 255, n[2]! * 255, n[3] ?? 1]
      : [n[0]!, n[1]!, n[2]!, n[3] ?? 1];
  };
  const over = (t: number[], u: number[]) =>
    [0, 1, 2].map((k) => t[k]! * t[3]! + u[k]! * (1 - t[3]!)).concat(1);
  return [...document.querySelectorAll<HTMLElement>("[data-audit]")].map((e) => {
    // The surface behind: ancestors' colours composited; unknown under a gradient.
    let surface = [255, 255, 255, 1];
    let gradient = false;
    const chain: Element[] = [];
    for (let p = e.parentElement; p; p = p.parentElement) chain.push(p);
    for (const p of chain.reverse()) {
      const cs = getComputedStyle(p);
      const c = parse(cs.backgroundColor);
      if (cs.backgroundImage !== "none") gradient = true;
      if (c[3]! > 0) {
        surface = over(c, surface);
        gradient = cs.backgroundImage !== "none";
      }
    }
    const cs = getComputedStyle(e);
    const own = parse(cs.backgroundColor);
    return {
      i: e.dataset.audit!,
      ownBg: own[3]! > 0,
      bg: over(own, surface),
      surface,
      gradient,
      tint: cs.backgroundImage.includes("gradient"),
      look: [cs.color, cs.boxShadow, cs.borderColor, cs.textDecorationLine, cs.backgroundColor].join("|"),
    };
  });
  void selector;
}

async function auditPage(page: Page, where: string): Promise<Finding[]> {
  await page.addStyleTag({
    content: "*,*::before,*::after{transition:none!important;animation:none!important}",
  });
  // Keyboard modality, so programmatic focus shows :focus-visible.
  await page.keyboard.press("Shift");
  const controls = await page.evaluate((selector) => {
    const out: { i: string; label: string; w: number; h: number; ring: boolean; disabled: boolean; button: boolean }[] = [];
    let n = 0;
    for (const e of document.querySelectorAll<HTMLElement>(selector)) {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      // Visually hidden until focused (the skip link): checked by its own test.
      if (r.width <= 2 || r.height <= 2 || cs.visibility === "hidden" || e.closest("[aria-hidden=true],[inert]")) continue;
      if (e instanceof HTMLInputElement) continue;
      const i = String(n++);
      e.dataset.audit = i;
      const disabled = e.matches(":disabled,[aria-disabled=true]");
      let ring = true;
      if (!disabled) {
        e.focus({ preventScroll: true });
        if (document.activeElement === e) {
          const f = getComputedStyle(e);
          ring =
            (f.outlineStyle !== "none" && parseFloat(f.outlineWidth) >= 2) ||
            (f.boxShadow !== "none" && e.matches(":focus-visible"));
        }
        e.blur();
      }
      const own = cs.backgroundColor;
      out.push({
        i,
        label: (
          e.getAttribute("aria-label") ||
          (e.getAttribute("aria-labelledby") ?? "")
            .split(" ")
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" ") ||
          (e as HTMLButtonElement).labels?.[0]?.textContent ||
          e.textContent ||
          ""
        )
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 40),
        // A transparent ::before can enlarge the touch area (Switch).
        ...(() => {
          const w = e.offsetWidth || r.width;
          const h = e.offsetHeight || r.height;
          const b = getComputedStyle(e, "::before");
          if (b.content === "none" || b.position !== "absolute") return { w, h };
          const px = (v: string) => (v.endsWith("px") ? parseFloat(v) : 0);
          return {
            w: Math.max(w, w - px(b.left) - px(b.right)),
            h: Math.max(h, h - px(b.top) - px(b.bottom)),
          };
        })(),
        ring,
        disabled,
        button:
          (own !== "rgba(0, 0, 0, 0)" && own !== "transparent") ||
          e.dataset.slot === "button" ||
          cs.borderRadius.startsWith("9"),
      });
    }
    return out;
  }, CONTROLS);

  const findings: Finding[] = [];
  const name = (c: (typeof controls)[number]) => `${where} · "${c.label}"`;
  for (const c of controls) {
    if (c.w < 43.5 || c.h < 43.5) findings.push(`${name(c)}: ${Math.round(c.w)}×${Math.round(c.h)} under 44px`);
    if (!c.disabled && !c.ring) findings.push(`${name(c)}: no focus ring`);
  }

  // Hover, forced on every button-like control at once (DevTools).
  const buttons = controls.filter((c) => c.button && !c.disabled);
  const before = new Map((await page.evaluate(snapshot, "")).map((b) => [b.i, b]));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "[data-audit]" });
  const ids = new Map<string, number>();
  for (const nodeId of nodeIds) {
    const { attributes } = await cdp.send("DOM.getAttributes", { nodeId });
    const k = attributes.indexOf("data-audit");
    ids.set(attributes[k + 1]!, nodeId);
  }
  for (const c of buttons) {
    const nodeId = ids.get(c.i);
    if (nodeId) await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] });
  }
  const after = new Map((await page.evaluate(snapshot, "")).map((b) => [b.i, b]));
  await cdp.detach();

  const gap = (a: number[], b: number[]) => a.slice(0, 3).reduce((s, v, k) => s + Math.abs(v - b[k]!), 0);
  for (const c of controls) {
    const b = before.get(c.i);
    if (!b || !c.button) continue;
    if (b.ownBg && !b.gradient && gap(b.bg, b.surface) < 12)
      findings.push(`${name(c)}: its background matches the surface (lost background)`);
    if (c.disabled) continue;
    const a = after.get(c.i);
    if (!a) continue;
    if (a.tint === b.tint && a.look === b.look && gap(a.bg, b.bg) < 12) findings.push(`${name(c)}: hover shows no change`);
    if (b.ownBg && gap(b.bg, b.surface) >= 12 && !a.gradient && !a.tint && gap(a.bg, a.surface) < 12)
      findings.push(`${name(c)}: hover matches the surface`);
  }
  return findings;
}

const SIGNED_OUT = ["/", "/log-in", "/sign-up", "/forgot-password"];
const SIGNED_IN = ["/home", "/people", "/calendar", "/wishlists", "/celebrate", "/profile", "/settings"];

for (const theme of ["light", "dark"] as const) {
  test(`CTA audit: landing, auth and app pages (${theme})`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.addInitScript((t) => localStorage.setItem("rm-theme", t), theme);
    const findings: Finding[] = [];

    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of SIGNED_OUT) {
        await page.goto(path);
        findings.push(...(await auditPage(page, `${path} ${width}`)));
      }
    }

    await signUpAndOnboard(page, "Maya");
    await page.goto("/people");
    await page.getByRole("button", { name: "Add someone" }).filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add someone" });
    await dialog.getByLabel("Their name").fill("Khalid");
    const bday = dialog.getByRole("group", { name: "Their birthday" });
    await bday.getByRole("combobox", { name: "Day" }).selectOption("3");
    await bday.getByRole("combobox", { name: "Month" }).selectOption("12");
    await dialog.getByRole("button", { name: "Add Khalid" }).click();
    await expect(dialog).toBeHidden();

    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of SIGNED_IN) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expectAccessible(page, `${path} ${width} ${theme}`);
        findings.push(...(await auditPage(page, `${path} ${width}`)));
      }
    }

    console.log(`${theme}: ${findings.length} findings`);
    expect([...new Set(findings)]).toEqual([]);
  });
}
