export type TokenMap = Record<string, string>;

/** Reads the custom properties declared directly in one top-level CSS block (e.g. ":root"). */
export function parseBlock(css: string, selector: string): TokenMap {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match?.[1]) throw new Error(`No "${selector}" block found`);

  const body = match[1].replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens: TokenMap = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    if (name && value) tokens[name] = value.trim();
  }
  return tokens;
}

export function parseThemes(css: string): { light: TokenMap; dark: TokenMap } {
  return { light: parseBlock(css, ":root"), dark: parseBlock(css, ".dark") };
}
