import { describe, expect, it, vi } from "vitest";

import {
  ATTEMPTS,
  generateGiftIdeas,
  type GiftDeps,
  hasPriceOrLink,
  mentionsALittleThing,
  validateIdeas,
} from "./ideas";
import type { GiftPromptInput } from "./prompt";

const INPUT: GiftPromptInput = {
  firstName: "Khalid",
  relation: "Best friend",
  occasion: "birthday",
  budget: null,
  littleThings: ["Mint tea", "Hiking"],
  freeWishes: [],
};

const idea = (title: string, why = "Because they love mint tea in the morning.") => ({
  title,
  why,
});
const reply = (ideas: unknown) => JSON.stringify({ ideas });
const GOOD = reply([idea("A mint tea set"), idea("A hiking day"), idea("A tea journal")]);

describe("validateIdeas (the schema)", () => {
  it("accepts 3 to 5 ideas within the limits", () => {
    expect(validateIdeas(GOOD)).toHaveLength(3);
    expect(validateIdeas("```json\n" + GOOD + "\n```")).toHaveLength(3);
  });

  it("rejects fewer than 3 or more than 5", () => {
    expect(validateIdeas(reply([idea("One"), idea("Two")]))).toBeNull();
    expect(validateIdeas(reply(Array.from({ length: 6 }, (_, i) => idea(`Idea ${i}`))))).toBeNull();
  });

  it("rejects a title over 60 or a why over 140 characters", () => {
    expect(validateIdeas(reply([idea("x".repeat(61)), idea("B"), idea("C")]))).toBeNull();
    expect(validateIdeas(reply([idea("Aa", "y".repeat(141)), idea("Bb"), idea("Cc")]))).toBeNull();
  });

  it("rejects prices, currencies, links and emails", () => {
    for (const bad of [
      "A tea set for $25",
      "Around 200 MAD",
      "Under 30 euros",
      "Something for £10",
      "From www.teashop.com",
      "See https://example.org",
      "Ask @teashop on social media",
      "Order on teashop.ma",
    ]) {
      expect(hasPriceOrLink(bad), bad).toBe(true);
      expect(
        validateIdeas(reply([idea(bad.slice(0, 60)), idea("Bb"), idea("Cc")])),
        bad,
      ).toBeNull();
    }
    expect(hasPriceOrLink("A 3-day hiking trip")).toBe(false);
  });

  it("rejects anything that isn't our JSON", () => {
    expect(validateIdeas("Here are some ideas: tea!")).toBeNull();
    expect(validateIdeas(JSON.stringify({ ideas: "tea" }))).toBeNull();
  });

  it("drops duplicate titles, and needs 3 left", () => {
    expect(validateIdeas(reply([idea("Tea"), idea("tea"), idea("Hike")]))).toBeNull();
  });

  it("no em dashes in what Noor says", () => {
    const ideas = validateIdeas(reply([idea("Tea — mint"), idea("Bb"), idea("Cc")]));
    expect(ideas?.[0]?.title).toBe("Tea, mint");
  });
});

describe("generateGiftIdeas: retry, then fallback, then a friendly message", () => {
  const deps = (...replies: (string | Error)[]): GiftDeps => {
    const generate = vi.fn();
    for (const r of replies) {
      if (r instanceof Error) generate.mockRejectedValueOnce(r);
      else generate.mockResolvedValueOnce(r);
    }
    return { generate };
  };

  it("Groq first", async () => {
    const d = deps(GOOD);
    await expect(generateGiftIdeas(INPUT, d)).resolves.toMatchObject({ kind: "ideas" });
    expect(d.generate).toHaveBeenCalledTimes(1);
    expect(vi.mocked(d.generate).mock.calls[0]![1]).toBe("groq");
  });

  it("invalid JSON: Groq once more", async () => {
    const d = deps("not json", GOOD);
    await expect(generateGiftIdeas(INPUT, d)).resolves.toMatchObject({ kind: "ideas" });
    expect(vi.mocked(d.generate).mock.calls.map((c) => c[1])).toEqual(["groq", "groq"]);
  });

  it("still invalid (or failing): Cloudflare as the fallback", async () => {
    const d = deps(new Error("429"), reply([idea("$5 mug"), idea("B"), idea("C")]), GOOD);
    await expect(generateGiftIdeas(INPUT, d)).resolves.toMatchObject({ kind: "ideas" });
    expect(vi.mocked(d.generate).mock.calls.map((c) => c[1])).toEqual(ATTEMPTS);
  });

  it("nothing usable: 'unavailable' (Noor says so kindly), never a made-up list", async () => {
    const d = deps("x", "y", new Error("down"));
    await expect(generateGiftIdeas(INPUT, d)).resolves.toEqual({ kind: "unavailable" });
    expect(d.generate).toHaveBeenCalledTimes(3);
  });
});

describe("mentionsALittleThing (evals)", () => {
  it("true when an idea shares a word with a little thing", () => {
    expect(mentionsALittleThing(validateIdeas(GOOD)!, ["Mint tea"])).toBe(true);
    expect(mentionsALittleThing(validateIdeas(GOOD)!, ["Origami"])).toBe(false);
  });
});
