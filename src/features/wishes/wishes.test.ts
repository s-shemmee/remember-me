import { describe, expect, it } from "vitest";

import { checkImageFile, fitWithin } from "./image";
import { formatPrice, isWebLink, shopOf, wishFieldErrors, wishFormSchema } from "./schema";

const LIST = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const USER = "16fd2706-8baf-433b-82eb-8c7fada847da";
const valid = {
  id: null,
  wishlistId: LIST,
  title: " Ottolenghi cookbook ",
  url: " https://www.librairie.ma/ottolenghi ",
  price: "420",
  currency: "MAD",
  note: "",
  priority: "love",
  imagePath: null,
};
const errorsOf = (input: unknown) => {
  const r = wishFormSchema.safeParse(input);
  return r.success ? {} : wishFieldErrors(r.error);
};

describe("wish form", () => {
  it("accepts a full wish and cleans it up", () => {
    const r = wishFormSchema.safeParse({
      ...valid,
      price: "12,50",
      imagePath: `${USER}/a1b2.webp`,
    });
    expect(r.success && r.data).toMatchObject({
      title: "Ottolenghi cookbook",
      url: "https://www.librairie.ma/ottolenghi",
      price: 12.5,
      note: "",
    });
  });

  it("only needs a title, of at most 80 characters", () => {
    expect(wishFormSchema.safeParse({ ...valid, url: "", price: "" }).data).toMatchObject({
      url: null,
      price: null,
    });
    expect(errorsOf({ ...valid, title: "  " }).title).toBe("What do you wish for?");
    expect(errorsOf({ ...valid, title: "x".repeat(81) }).title).toBe("Keep it to 80 characters.");
    expect(errorsOf({ ...valid, title: "x".repeat(80) })).toEqual({});
  });

  it("only takes web links", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.ma", "librairie.ma"]) {
      expect(errorsOf({ ...valid, url: bad }).url).toBe("Use a web link that starts with https://");
    }
    expect(isWebLink("http://jumia.ma/x")).toBe(true);
    expect(shopOf("https://www.jumia.ma/item?id=1")).toBe("jumia.ma");
    expect(shopOf(null)).toBeNull();
  });

  it("checks price, currency, note and the image path", () => {
    for (const bad of ["-1", "12.345", "abc", "1e5"]) {
      expect(errorsOf({ ...valid, price: bad }).price).toBe("Use a price like 450 or 12.50.");
    }
    expect(errorsOf({ ...valid, currency: "XYZ" }).currency).toBeDefined();
    expect(errorsOf({ ...valid, note: "n".repeat(281) }).note).toBe("Keep it to 280 characters.");
    expect(errorsOf({ ...valid, imagePath: "../etc/passwd" }).imagePath).toBeDefined();
    expect(errorsOf({ ...valid, priority: "must" }).priority).toBeDefined();
  });

  it("formats prices as in the screens", () => {
    expect(formatPrice(420, "MAD")).toBe("420 MAD");
    expect(formatPrice(1900, "MAD")).toBe("1,900 MAD");
    expect(formatPrice(12.5, "EUR")).toBe("12.50 EUR");
    expect(formatPrice(null, "MAD")).toBeNull();
  });
});

describe("wish photos", () => {
  it("accepts JPEG, PNG and WebP only, under 20 MB before shrinking", () => {
    expect(checkImageFile({ type: "image/jpeg", size: 5_000_000 })).toEqual({ ok: true });
    expect(checkImageFile({ type: "image/webp", size: 10 })).toEqual({ ok: true });
    expect(checkImageFile({ type: "image/svg+xml", size: 10 })).toMatchObject({ ok: false });
    expect(checkImageFile({ type: "application/pdf", size: 10 })).toMatchObject({ ok: false });
    expect(checkImageFile({ type: "image/jpeg", size: 21 * 1024 * 1024 })).toEqual({
      ok: false,
      message: "That photo is too big. Try one under 20 MB.",
    });
  });

  it("shrinks to 1600px on the longest side, never enlarges", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
