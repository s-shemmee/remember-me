import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { reminderLine, reminderPreview, reminderSubject } from "./copy";
import type { DueReminder, ReminderDay } from "./due";
import { renderAccountExistsEmail } from "../auth/account-exists-email";

import {
  EMAIL_COLORS,
  EMAIL_LOGO_PATH,
  EMAIL_PASTELS,
  renderReminderEmail,
  renderTestEmail,
} from "./email";
import { pushPayload } from "./push";

const day = (extra: Partial<ReminderDay> = {}): ReminderDay => ({
  occasionId: "o1",
  personId: "p1",
  personName: "Khalid",
  personColor: "butter",
  kind: "birthday",
  title: null,
  day: 13,
  month: 11,
  year: 1996,
  recurring: true,
  littleThing: "black coffee",
  archived: false,
  wishlistFriendId: null,
  ...extra,
});
const reminder = (offset: number, extra: Partial<ReminderDay> = {}): DueReminder => ({
  key: `o1|${offset}|2026-11-13`,
  offset,
  occursOn: { year: 2026, month: 11, day: 13 },
  day: day(extra),
});
const links = {
  appUrl: "https://app.example",
  unsubscribeUrl: "https://app.example/unsubscribe?token=abc",
};

describe("wording", () => {
  it("birthdays: 'turns N' with a year, the countdown, the little thing", () => {
    expect(reminderLine(reminder(7))).toEqual({
      headline: "Khalid turns 30 in 7 days 🎂",
      date: "Friday 13 November",
      detail: "Little thing: black coffee",
      gentle: false,
      wishlistLabel: null,
    });
    expect(reminderLine(reminder(0)).headline).toBe("Khalid turns 30 today 🎂");
    expect(reminderLine(reminder(1)).headline).toBe("Khalid turns 30 tomorrow 🎂");
    expect(reminderLine(reminder(14, { year: null })).headline).toBe(
      "Khalid's birthday is in 14 days 🎂",
    );
    expect(reminderLine(reminder(0, { year: null })).headline).toBe(
      "It's Khalid's birthday today 🎂",
    );
  });

  it("other days use their title", () => {
    expect(
      reminderLine(reminder(3, { kind: "work_milestone", title: "New job", year: null })).headline,
    ).toBe("Khalid · New job is in 3 days 💼");
    expect(reminderLine(reminder(3, { kind: "anniversary", year: null })).headline).toBe(
      "Khalid's anniversary is in 3 days 💞",
    );
  });

  it("'See Khalid's wishlist' only for a connected friend with free wishes", () => {
    expect(reminderLine(reminder(7, { wishlistFriendId: "f1" })).wishlistLabel).toBe(
      "See Khalid's wishlist",
    );
  });

  it("Remembrance is gentle: no celebrate, no gift, no little thing, no wishlist", () => {
    const quiet = reminderLine(
      reminder(3, {
        kind: "remembrance",
        personName: "Grandma",
        year: null,
        littleThing: "loved jasmine",
        wishlistFriendId: "f1",
      }),
    );
    expect(quiet).toEqual({
      headline: "Grandma's day of remembrance is in 3 days 🕊️",
      date: "Friday 13 November",
      detail: "A kind word can mean a lot.",
      gentle: true,
      wishlistLabel: null,
    });
    expect(
      reminderLine(
        reminder(3, { kind: "remembrance", personName: "Sara", title: "In memory of Dad" }),
      ).headline,
    ).toBe("In 3 days: Sara · In memory of Dad 🕊️");
    expect(
      reminderLine(
        reminder(0, { kind: "remembrance", personName: "Sara", title: "In memory of Dad" }),
      ).headline,
    ).toBe("Today: Sara · In memory of Dad 🕊️");
  });

  it("subject and preview", () => {
    expect(reminderSubject([reminder(7)])).toBe("Khalid turns 30 in 7 days 🎂");
    expect(
      reminderSubject([
        reminder(1),
        reminder(7, { personName: "Sara" }),
        reminder(7, { personName: "Omar" }),
      ]),
    ).toBe("Coming up: Khalid, Sara and 1 more");
    expect(reminderSubject([reminder(1), reminder(7, { personName: "Sara" })])).toBe(
      "Coming up: Khalid and Sara",
    );
    expect(reminderPreview([reminder(7)])).toBe(
      "Friday 13 November. I'll keep reminding you, gently.",
    );
  });
});

describe("rendered email", () => {
  it("HTML and plain text carry the person, day, countdown, little thing and links", async () => {
    const email = await renderReminderEmail({
      firstName: "Maya",
      reminders: [reminder(7, { wishlistFriendId: "f1" })],
      links,
    });
    expect(email.subject).toBe("Khalid turns 30 in 7 days 🎂");
    expect(email.html).toContain('lang="en"');
    expect(email.html).toContain("<title>Khalid turns 30 in 7 days 🎂</title>");
    expect(email.html).toContain("Hi Maya,");
    expect(email.html).toContain("Khalid turns 30 in 7 days 🎂");
    expect(email.html).toContain("Friday 13 November");
    expect(email.html).toContain("Little thing: black coffee");
    expect(email.html).toContain('href="https://app.example/wishlists?tab=friends&amp;friend=f1"');
    expect(email.html).toContain("See Khalid&#x27;s wishlist");
    expect(email.html).toContain('href="https://app.example/unsubscribe?token=abc"');
    expect(email.html).toContain('href="https://app.example/settings#reminders"');
    for (const part of [
      "Hi Maya,",
      "Khalid turns 30 in 7 days",
      "Friday 13 November",
      "Little thing: black coffee",
      "https://app.example/unsubscribe?token=abc",
    ]) {
      expect(email.text).toContain(part);
    }
    expect(email.text).not.toContain("<");
  });

  it("never mentions reservations", async () => {
    const email = await renderReminderEmail({
      firstName: "Maya",
      reminders: [reminder(7, { wishlistFriendId: "f1" })],
      links,
    });
    expect(`${email.html} ${email.text}`).not.toMatch(/reserv|taken|got this/i);
  });

  it("a Remembrance email has no celebrating, gifts or wishlists", async () => {
    const email = await renderReminderEmail({
      firstName: "Maya",
      reminders: [
        reminder(3, {
          kind: "remembrance",
          personName: "Grandma",
          year: null,
          littleThing: "jasmine",
          wishlistFriendId: "f1",
        }),
      ],
      links,
    });
    const all = `${email.subject} ${email.html} ${email.text}`;
    expect(all).toContain("Grandma's day of remembrance is in 3 days");
    expect(all).not.toMatch(/celebrat|gift|wishlist|🎉|🎂|Little thing/i);
  });

  it("the test email", async () => {
    const email = await renderTestEmail({ firstName: "Maya", links });
    expect(email.subject).toBe("Your Remember Me reminders are on 🕯️");
    expect(email.text).toContain("at 9:00 in the morning, your time");
    expect(email.html).toContain('href="https://app.example/unsubscribe?token=abc"');
  });

  it("uses the light theme's colours (kept in step with globals.css)", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const start = css.indexOf(":root");
    const light = css.slice(start, css.indexOf(".dark {", start));
    const value = (name: string) =>
      new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(light)?.[1];
    for (const [name, hex] of Object.entries(EMAIL_COLORS)) {
      expect(value(name), name).toBe(hex);
    }
    for (const [name, { fill, ink }] of Object.entries(EMAIL_PASTELS)) {
      expect(value(name), name).toBe(fill);
      expect(value(`${name}-ink`), `${name}-ink`).toBe(ink);
    }
  });
});

describe("your own day", () => {
  const mine = (offset: number) =>
    reminder(offset, { isYou: true, occasionId: "you", personName: "Maya", year: null });

  it("a week before: your day, and your wishlist", async () => {
    expect(reminderLine(mine(7))).toMatchObject({
      headline: "Your day is in 7 days ✨",
      detail: "Time to update your wishlist?",
      wishlistLabel: null,
    });
    const email = await renderReminderEmail({ firstName: "Maya", reminders: [mine(7)], links });
    expect(email.subject).toBe("Your day is in 7 days ✨");
    expect(email.html).toContain("Time to update your wishlist?");
    expect(email.html).toContain('href="https://app.example/wishlists?list=birthday"');
    expect(email.html).toContain("Remind me about my own day");
    expect(email.html).toContain('href="https://app.example/unsubscribe?token=abc"');
    // Never the "a day to keep in mind" email about your people.
    expect(email.html).not.toContain("days to keep in mind");
  });

  it("on the day: happy birthday", async () => {
    const email = await renderReminderEmail({ firstName: "Maya", reminders: [mine(0)], links });
    expect(email.subject).toBe("Happy birthday, Maya! 🎉");
    expect(email.text).toContain("Today is all about you.");
    expect(email.html).toContain('href="https://app.example/celebrate"');
    expect(reminderPreview([mine(0)])).toBe("Today is all about you.");
  });

  it("push: the same words, opening your wishlist or Celebrate Me", () => {
    expect(pushPayload([mine(7)], "b1")).toEqual({
      title: "Your day is in 7 days ✨",
      body: "Time to update your wishlist?",
      url: "/wishlists?list=birthday",
      tag: "b1",
    });
    expect(pushPayload([mine(0)], "b2")).toMatchObject({
      title: "Happy birthday, Maya! 🎉",
      body: "Today is all about you.",
      url: "/celebrate",
    });
  });
});

describe("the logo", () => {
  it("is our mark as an image inside a red cell (still red with images blocked), alt=\"\"", async () => {
    for (const email of [
      await renderReminderEmail({ firstName: "Maya", reminders: [reminder(7)], links }),
      await renderTestEmail({ firstName: "Maya", links }),
      await renderAccountExistsEmail(links.appUrl),
    ]) {
      const cell = email.html.match(/<td[^>]*aria-hidden="true"[^>]*><img[^>]*><\/td>/)?.[0];
      expect(cell).toBeDefined();
      expect(cell).toContain('bgcolor="#d63b48"');
      expect(cell).toContain("border-radius:8px");
      expect(cell).toContain(`src="${links.appUrl}${EMAIL_LOGO_PATH}"`);
      expect(cell).toContain('alt=""');
      expect(cell).toMatch(/width="28"[^>]*height="28"/);
      expect(email.html).not.toContain("♥");
      // The candle stays in Noor's sign-off only, and the logo stays out of the text version.
      const body = email.html.replace(/<title>.*?<\/title>/, "");
      expect(body.match(/🕯️/g)?.length ?? 0).toBeLessThanOrEqual(1);
      expect(email.text).not.toContain("logo.png");
      expect(email.text).toContain("Remember me");
    }
  });

  it("the auth templates use the same image, from the Site URL", () => {
    for (const name of ["confirm-signup", "magic-link", "reset-password", "change-email"]) {
      const html = readFileSync(`supabase/templates/${name}.html`, "utf8");
      const cell = html.match(/<td[^>]*aria-hidden="true"[^>]*><img[^>]*><\/td>/)?.[0];
      expect(cell, name).toBeDefined();
      expect(cell).toContain('bgcolor="#d63b48"');
      expect(cell).toContain('src="{{ .SiteURL }}/email/logo.png"');
      expect(cell).toContain('alt=""');
      expect(html, name).not.toMatch(/&#9829;|♥/);
    }
  });

  it("the PNG is the 2× mark: 56×56", () => {
    const png = readFileSync(`public${EMAIL_LOGO_PATH}`);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([56, 56]);
  });
});
