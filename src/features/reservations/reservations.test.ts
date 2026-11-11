import { describe, expect, it } from "vitest";

import {
  birthdayLine,
  type Friend,
  friendDaysUntil,
  type FriendWish,
  friendSays,
  giftsSorted,
  joinNames,
  noticeText,
  nudgeWishLine,
  pickNudgeWish,
  reserveErrorMessage,
  sortFriends,
} from "./logic";

const wish = (id: string, extra: Partial<FriendWish> = {}): FriendWish => ({
  id,
  title: `Wish ${id}`,
  url: null,
  price: null,
  currency: "MAD",
  note: null,
  priority: "like",
  imageUrl: null,
  status: "free",
  ...extra,
});
const friend = (name: string, daysUntil: number | null, wishes: FriendWish[] = []): Friend => ({
  profileId: name,
  name,
  pastel: "lilac",
  character: null,
  birthday: daysUntil === null ? null : { day: 1, month: 1 },
  daysUntil,
  linkedPersonId: null,
  wishes,
});

describe("friends", () => {
  it("sorts by the soonest birthday, unknown ones last", () => {
    const sorted = sortFriends([friend("Sara", 120), friend("Nadia", null), friend("Khalid", 2)]);
    expect(sorted.map((f) => f.name)).toEqual(["Khalid", "Sara", "Nadia"]);
  });

  it("counts days to the next birthday, 29 February included", () => {
    expect(friendDaysUntil({ day: 13, month: 11 }, { year: 2026, month: 11, day: 11 })).toBe(2);
    // 2027 isn't a leap year: 28 February.
    expect(friendDaysUntil({ day: 29, month: 2 }, { year: 2027, month: 2, day: 27 })).toBe(1);
    expect(friendDaysUntil(null, { year: 2026, month: 11, day: 11 })).toBeNull();
  });

  it("says when their birthday is", () => {
    expect(birthdayLine(0)).toBe("Birthday today");
    expect(birthdayLine(1)).toBe("Birthday tomorrow");
    expect(birthdayLine(2)).toBe("Birthday in 2 days");
    expect(birthdayLine(120)).toBe("Birthday in 4 months");
    expect(birthdayLine(null)).toBe("No birthday shared");
  });

  it("Noor's line counts only my reservations", () => {
    expect(friendSays(friend("Khalid", 2, [wish("1")]))).toBe(
      "Nothing reserved for Khalid yet. Pick something and I'll keep it secret 🤫",
    );
    expect(friendSays(friend("Khalid", 2, [wish("1", { status: "mine" }), wish("2")]))).toBe(
      "Nice, you have 1 gift reserved for Khalid. Khalid will never know it was you 🤫",
    );
    // Someone else's reservation doesn't count as mine.
    expect(friendSays(friend("Khalid", 2, [wish("1", { status: "taken" })]))).toMatch(
      /^Nothing reserved/,
    );
    expect(friendSays(friend("Khalid", 2))).toMatch(/hasn't added any wishes yet/);
  });
});

describe("Home", () => {
  it("Noor offers the first free Love it, else the first free wish", () => {
    expect(
      pickNudgeWish([
        wish("1", { status: "taken", priority: "love" }),
        wish("2"),
        wish("3", { priority: "love" }),
      ])?.id,
    ).toBe("3");
    expect(pickNudgeWish([wish("1", { priority: "nice" }), wish("2")])?.id).toBe("2");
    expect(pickNudgeWish([wish("1", { status: "mine" }), wish("2", { status: "taken" })])).toBe(
      null,
    );
  });

  it("names the wish and its price", () => {
    expect(nudgeWishLine({ title: "match ball", price: 350, currency: "MAD" }, "Khalid")).toBe(
      "The match ball (350 MAD) on Khalid's wishlist is still free. Want me to reserve it for you?",
    );
    expect(nudgeWishLine({ title: "match ball", price: null, currency: "MAD" }, "Khalid")).toBe(
      "The match ball on Khalid's wishlist is still free. Want me to reserve it for you?",
    );
  });

  it("joins names", () => {
    expect(joinNames(["Khalid"])).toBe("Khalid");
    expect(joinNames(["Khalid", "Yasmine"])).toBe("Khalid & Yasmine");
    expect(joinNames(["Khalid", "Sara", "Yasmine"])).toBe("Khalid, Sara & Yasmine");
    expect(joinNames(["A", "B", "C", "D"])).toBe("A, B & 2 more");
  });

  it("Gifts sorted counts friends with a birthday in 30 days and wishes", () => {
    expect(giftsSorted([])).toEqual({ value: "None yet", line: "connect with your people" });
    expect(giftsSorted([friend("Sara", 120, [wish("1")]), friend("Khalid", 2)])).toEqual({
      value: "All calm",
      line: "no wishlist birthdays in 30 days",
    });
    expect(giftsSorted([friend("Khalid", 2, [wish("1", { status: "taken" })])])).toEqual({
      value: "0 of 1",
      line: "birthday soon with a wishlist",
    });
    expect(
      giftsSorted([
        friend("Yasmine", 20, [wish("1", { status: "mine" })]),
        friend("Khalid", 2, [wish("2"), wish("3", { status: "mine" })]),
        friend("Nadia", 24, [wish("4")]),
        friend("Rim", 30, [wish("5")]),
        friend("Sara", 31, [wish("6", { status: "mine" })]),
      ]),
    ).toEqual({ value: "2 of 4", line: "reserved, for Khalid & Yasmine" });
  });
});

describe("words", () => {
  it("explains a lost race and the quiet note", () => {
    expect(reserveErrorMessage("taken")).toBe("Just taken by someone else");
    expect(noticeText("Khalid")).toBe("Khalid removed a wish you'd reserved");
  });
});
