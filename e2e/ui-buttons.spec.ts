import { expect, type Page, test } from "@playwright/test";

import { buttonVariants } from "../src/components/ui/button";

/**
 * Hover never makes a button disappear into the surface behind it.
 *
 * Every Button variant sits on every surface (bg, card, card2), in light and
 * dark, plus the combination that used to break: "Plan their day" on People
 * (a transparent button given bg-card, inside a card2 box). For each one we
 * read real pixels from the screen: the hovered button must differ from the
 * surface around it, and from itself before the hover (so hover shows).
 */
const SURFACES = ["bg-bg", "bg-card", "bg-card2"] as const;
const CASES = [
  { name: "accent", className: buttonVariants({ variant: "accent" }) },
  { name: "card2", className: buttonVariants({ variant: "card2" }) },
  { name: "transparent", className: buttonVariants({ variant: "transparent" }) },
  {
    name: "transparent on bg-card (People: Plan their day)",
    className: `${buttonVariants({ variant: "transparent" })} bg-card`,
  },
];

/** Smallest visible difference we accept (sum of the RGB channel gaps). */
const MIN_GAP = 12;

async function pixel(page: Page, x: number, y: number): Promise<number[]> {
  const png = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }, png.toString("base64"));
}

const gap = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]!), 0);

for (const theme of ["light", "dark"] as const) {
  test(`every button variant stays visible on hover, on every surface (${theme})`, async ({
    page,
  }) => {
    await page.goto("/log-in");
    await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important}" });
    await page.evaluate(
      ({ theme, surfaces, cases }) => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.style.colorScheme = theme;
        const board = document.createElement("div");
        board.id = "board";
        board.style.cssText = "position:fixed;inset:0;z-index:9999;overflow:auto";
        board.className = "bg-bg";
        for (const surface of surfaces) {
          for (const c of cases) {
            const box = document.createElement("div");
            box.className = `${surface} p-6`;
            const button = document.createElement("button");
            button.className = c.className;
            button.textContent = "Plan their day";
            button.dataset.case = `${surface} / ${c.name}`;
            box.append(button);
            board.append(box);
          }
        }
        document.body.append(board);
      },
      { theme, surfaces: [...SURFACES], cases: CASES },
    );

    const buttons = page.locator("#board button");
    const count = await buttons.count();
    expect(count).toBe(SURFACES.length * CASES.length);
    const problems: string[] = [];

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      await button.scrollIntoViewIfNeeded();
      const label = (await button.getAttribute("data-case"))!;
      const box = (await button.boundingBox())!;
      const midY = box.y + box.height / 2;

      await page.mouse.move(0, 0);
      const surface = await pixel(page, box.x - 12, midY);
      const before = await pixel(page, box.x + 10, midY);

      await button.hover();
      const hovered = await button.boundingBox();
      const after = await pixel(page, hovered!.x + 10, hovered!.y + hovered!.height / 2);

      if (gap(after, surface) < MIN_GAP) problems.push(`${label}: hover matches the surface`);
      if (gap(after, before) < MIN_GAP) problems.push(`${label}: hover shows no change`);
    }

    expect(problems).toEqual([]);
  });
}

/**
 * The full matrix, as a screenshot per theme (attached to the report and
 * saved under test-results/): every variant × size × state on every surface.
 * States are forced with DevTools (CSS.forcePseudoState), so hover, focus and
 * pressed all show at once. Each cell is checked too:
 * - 44px target (icon 44×44), text contrast ≥ 4.5:1 on its surface;
 * - hover tints (a background image), focus-visible shows a ≥ 2px ring with
 *   ≥ 3:1 against the surface, pressed scales down;
 * - disabled and loading ("Saving…", aria-disabled) are dimmed and inert.
 */
const STATES = ["default", "hover", "focus-visible", "active", "disabled", "loading"] as const;
const SIZES = ["default", "lg", "icon"] as const;
const VARIANTS = ["accent", "card2", "transparent"] as const;

for (const theme of ["light", "dark"] as const) {
  test(`button matrix: variant × size × state × surface (${theme})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/log-in");
    await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important}" });
    const cells = [] as { id: string; surface: string; variant: string; size: string; state: string; className: string }[];
    for (const surface of SURFACES)
      for (const variant of VARIANTS)
        for (const size of SIZES)
          for (const state of STATES)
            cells.push({
              id: `c${cells.length}`,
              surface,
              variant,
              size,
              state,
              className: buttonVariants({ variant, size }),
            });

    await page.evaluate(
      ({ theme, cells, states }) => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.style.colorScheme = theme;
        const board = document.createElement("div");
        board.id = "matrix";
        board.className = "bg-bg text-text";
        board.style.cssText = "position:absolute;inset:0 auto auto 0;z-index:9999;width:1400px;padding:16px;font-size:12px";
        const plus = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5v14"/></svg>';
        let row: HTMLDivElement | null = null;
        let section: HTMLDivElement | null = null;
        cells.forEach((c, i) => {
          if (i % (states.length * 9) === 0) {
            section = document.createElement("div");
            section.className = `${c.surface} rounded-[16px] p-4 mb-3`;
            section.innerHTML = `<div style="font-weight:700;margin-bottom:8px">${c.surface}</div>`;
            board.append(section);
          }
          if (i % states.length === 0) {
            row = document.createElement("div");
            row.style.cssText = "display:grid;grid-template-columns:150px repeat(6,1fr);gap:12px;align-items:center;margin-bottom:8px";
            row.innerHTML = `<span>${c.variant} · ${c.size}</span>`;
            section!.append(row);
          }
          const b = document.createElement("button");
          b.id = c.id;
          b.className = c.className;
          if (c.state === "disabled") b.disabled = true;
          if (c.state === "loading") b.setAttribute("aria-disabled", "true");
          if (c.size === "icon") {
            b.innerHTML = plus;
            b.setAttribute("aria-label", c.state);
          } else {
            b.textContent = c.state === "loading" ? "Saving…" : c.state;
          }
          row!.append(b);
        });
        document.body.append(board);
      },
      { theme, cells, states: [...STATES] },
    );

    // Force the pseudo-states.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
    for (const c of cells) {
      if (!["hover", "focus-visible", "active"].includes(c.state)) continue;
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `#${c.id}` });
      const forced = c.state === "focus-visible" ? ["focus", "focus-visible"] : [c.state];
      await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: forced });
    }

    const results = await page.evaluate((cells) => {
      const parse = (s: string): number[] => {
        const n = s.match(/[\d.]+/g)!.map(Number);
        if (s.startsWith("color(")) return [n[0]! * 255, n[1]! * 255, n[2]! * 255, n[3] ?? 1];
        return [n[0]!, n[1]!, n[2]!, n[3] ?? 1];
      };
      const over = (top: number[], under: number[]) =>
        [0, 1, 2].map((i) => top[i]! * top[3]! + under[i]! * (1 - top[3]!)).concat(1);
      const lum = (c: number[]) => {
        const [r, g, b] = c.slice(0, 3).map((v) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      };
      const ratio = (a: number[], b: number[]) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x! + 0.05) / (y! + 0.05);
      };
      return cells.map((c) => {
        const el = document.getElementById(c.id)!;
        const cs = getComputedStyle(el);
        const surface = parse(getComputedStyle(el.closest(`.${c.surface}`)!).backgroundColor);
        const bg = over(parse(cs.backgroundColor), surface);
        return {
          ...c,
          // Layout size: a pressed button is drawn at 97%, its target isn't.
          w: el.offsetWidth,
          h: el.offsetHeight,
          contrast: ratio(parse(cs.color), bg),
          bgImage: cs.backgroundImage,
          outline: { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), contrast: ratio(parse(cs.outlineColor), surface) },
          scale: cs.scale,
          opacity: Number(cs.opacity),
          pointer: cs.pointerEvents,
        };
      });
    }, cells);

    const problems: string[] = [];
    for (const r of results) {
      const at = `${r.surface} / ${r.variant} · ${r.size} / ${r.state}`;
      if (r.h < 44 || r.w < 44) problems.push(`${at}: ${Math.round(r.w)}×${Math.round(r.h)} is under 44px`);
      if (r.size === "icon" && Math.round(r.w) !== Math.round(r.h)) problems.push(`${at}: icon not square`);
      if (r.state === "disabled" || r.state === "loading") {
        if (r.opacity > 0.6) problems.push(`${at}: not dimmed`);
        if (r.pointer !== "none") problems.push(`${at}: still clickable`);
        continue;
      }
      if (r.contrast < 4.5) problems.push(`${at}: text contrast ${r.contrast.toFixed(2)}`);
      if (r.state === "hover" && !r.bgImage.includes("gradient")) problems.push(`${at}: no hover tint`);
      if (r.state === "focus-visible") {
        if (r.outline.style === "none" || r.outline.width < 2) problems.push(`${at}: no focus ring`);
        else if (r.outline.contrast < 3) problems.push(`${at}: focus ring ${r.outline.contrast.toFixed(2)}:1`);
      }
      if (r.state === "active" && !r.scale.startsWith("0.97")) problems.push(`${at}: no pressed state`);
    }

    const shot = await page.locator("#matrix").screenshot({ path: testInfo.outputPath(`button-matrix-${theme}.png`) });
    await testInfo.attach(`button-matrix-${theme}`, { body: shot, contentType: "image/png" });
    expect(problems).toEqual([]);
  });
}
