import { readFileSync } from "node:fs";
import path from "node:path";

import { parseThemes, type TokenMap } from "@/styles/parse-tokens";
import { coreTokens, pastels, typeScale, type Pastel } from "@/styles/tokens";

import { ComponentsDemo } from "./components-demo";

// Temporary token and font check page for M0. The (marketing) landing replaces it in M6.

const pastelClasses: Record<Pastel, string> = {
  peach: "bg-peach text-peach-ink",
  lilac: "bg-lilac text-lilac-ink",
  mint: "bg-mint text-mint-ink",
  sky: "bg-sky text-sky-ink",
  rose: "bg-rose text-rose-ink",
  butter: "bg-butter text-butter-ink",
};

const sizeClasses: Record<(typeof typeScale)[number], string> = {
  64: "text-64",
  48: "text-48",
  44: "text-44",
  34: "text-34",
  24: "text-24",
  22: "text-22",
  19: "text-19",
  17: "text-17",
  16: "text-16",
  15: "text-15",
  14: "text-14",
  13: "text-13",
  12: "text-12",
};

const radii = [
  { label: "pill", className: "rounded-pill" },
  { label: "chip", className: "rounded-chip" },
  { label: "input", className: "rounded-input" },
  { label: "card", className: "rounded-card" },
  { label: "panel", className: "rounded-panel" },
];

function readTokens() {
  const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  return parseThemes(css);
}

export default function TokensPage() {
  const themes = readTokens();

  return (
    <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-8">
      <h1 className="text-34 font-extrabold tracking-heading">
        Design <em className="font-serif font-normal text-accent-text">tokens</em>
      </h1>
      <p className="mt-2 max-w-prose text-15 text-sub">
        A quick check of colours, type and shape from the design system, in both themes.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ThemePanel title="Light" tokens={themes.light} />
        <ThemePanel title="Dark" tokens={themes.dark} dark />
      </div>

      <ComponentsDemo />
    </main>
  );
}

function ThemePanel({ title, tokens, dark }: { title: string; tokens: TokenMap; dark?: boolean }) {
  return (
    <section
      aria-labelledby={`${title}-heading`}
      // min-w-0: grid items won't shrink below their content otherwise (390px overflow).
      className={[
        dark ? "dark" : "light",
        "min-w-0 rounded-panel bg-bg p-5 text-text ring-1 ring-line sm:p-8",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <h2 id={`${title}-heading`} className="text-24 font-extrabold tracking-heading">
        {title}
      </h2>

      <Logo />

      <h3 className="mt-8 text-17 font-bold">Colours</h3>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {coreTokens.map(({ name, use }) => (
          <li key={name} className="rounded-card bg-card p-3 shadow-card">
            <span
              aria-hidden
              className="block h-12 rounded-chip ring-1 ring-line"
              style={{ background: `var(--${name})` }}
            />
            <span className="mt-2 block text-13 font-bold">{name}</span>
            <span className="block text-12 text-sub">{tokens[name]}</span>
            <span className="block text-12 text-sub">{use}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-8 text-17 font-bold">Person pastels</h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {pastels.map((p) => (
          <li
            key={p}
            className={`${pastelClasses[p]} rounded-pill px-4 py-2 text-13 font-bold`}
            title={`${tokens[p]} / ${tokens[`${p}-ink`]}`}
          >
            {p}: in 2 days
          </li>
        ))}
      </ul>

      <h3 className="mt-8 text-17 font-bold">Type scale</h3>
      <ul className="mt-3 space-y-1 overflow-hidden">
        {typeScale.map((size) => (
          <li
            key={size}
            className={`${sizeClasses[size]} truncate leading-tight font-extrabold tracking-heading`}
          >
            {size}px Remember
          </li>
        ))}
      </ul>

      <h3 className="mt-8 text-17 font-bold">Fonts</h3>
      <div className="mt-3 space-y-3 rounded-card bg-card p-5 shadow-card">
        <p className="text-15">
          <span className="font-normal">Plus Jakarta Sans 400</span>,{" "}
          <span className="font-semibold">600</span>, <span className="font-extrabold">800</span>
        </p>
        <p className="text-34 leading-tight font-extrabold tracking-heading">
          One gentle <em className="font-serif font-normal">place</em>
        </p>
        <p className="font-hand text-19 text-sub">what&apos;s inside ✨</p>
        <p className="font-system text-15">System font for iOS mock-ups</p>
      </div>

      <h3 className="mt-8 text-17 font-bold">Shape and depth</h3>
      <ul className="mt-3 flex flex-wrap gap-3">
        {radii.map(({ label, className }) => (
          <li
            key={label}
            className={`${className} flex h-16 min-w-20 items-center justify-center bg-card px-4 text-13 font-semibold shadow-card`}
          >
            {label}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-11 rounded-pill bg-accent px-6 text-15 font-semibold text-on-accent transition-transform duration-200 ease-soft hover:-translate-y-px active:scale-[.97]"
        >
          Start remembering
        </button>
        <button
          type="button"
          className="min-h-11 rounded-pill bg-card2 px-6 text-15 font-semibold text-text transition-transform duration-200 ease-soft hover:-translate-y-px active:scale-[.97]"
        >
          See how it works
        </button>
      </div>
    </section>
  );
}

function Logo() {
  return (
    <p className="mt-4 flex items-center gap-2 text-19 font-extrabold tracking-heading">
      <span aria-hidden className="grid size-8 place-items-center rounded-chip bg-accent">
        <svg viewBox="0 0 24 24" className="size-4 fill-on-accent">
          <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.7 3.2 5 6.8 5c2 0 3.5 1.1 5.2 3 1.7-1.9 3.2-3 5.2-3 3.6 0 5.6 3.7 4.3 6.8C19.5 16.4 12 21 12 21z" />
        </svg>
      </span>
      Remember <em className="font-serif text-22 font-normal text-accent-text">me</em>
    </p>
  );
}
