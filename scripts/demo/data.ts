/**
 * The demo data for `pnpm seed:demo`: pure, every date relative to `today`.
 * Fictional people only, no real photos. src/lib/seed-demo.test.ts checks
 * the shape: 7 people with several days each, little things with an emoji,
 * connected / not connected / one pending invite, wishes with images, MAD
 * prices and shops, some reserved by Maya and some taken by others.
 */
import { addDays, type CalendarDate } from "../../src/lib/dates.ts";

export const DEMO_TIMEZONE = "Africa/Casablanca";

export const COLORS = ["rose", "sky", "peach", "lilac", "mint", "butter"] as const;
export const RELATIONS = ["Best friend", "Family", "Partner", "Friend", "Colleague"] as const;
type Color = (typeof COLORS)[number];
type Relation = (typeof RELATIONS)[number];

export type AccountKey = "main" | "khalid" | "sara" | "amine";

export type DemoAccount = {
  key: AccountKey;
  firstName: string;
  lastName: string;
  /** Days from today to their birthday. */
  birthdayIn: number;
  birthYear: number;
  character: string;
  color: Color;
  city: string;
  /** The little line on their profile (bio). */
  bio: string;
  handle: string;
};

export const ACCOUNTS: DemoAccount[] = [
  {
    key: "main",
    firstName: "Maya",
    lastName: "Alaoui",
    birthdayIn: 18,
    birthYear: 1997,
    character: "sunflower",
    color: "rose",
    city: "Rabat",
    bio: "Collector of sunsets, good tea and better people.",
    handle: "maya",
  },
  {
    key: "khalid",
    firstName: "Khalid",
    lastName: "Bennani",
    birthdayIn: 0,
    birthYear: 1996,
    character: "fox",
    color: "peach",
    city: "Casablanca",
    bio: "Raja till the end.",
    handle: "khalid_b",
  },
  {
    key: "sara",
    firstName: "Sara",
    lastName: "Idrissi",
    birthdayIn: 41,
    birthYear: 1996,
    character: "moon",
    color: "lilac",
    city: "City",
    bio: "Candles lit, lemon cake in the oven.",
    handle: "sara_i",
  },
  {
    key: "amine",
    firstName: "Amine",
    lastName: "Tazi",
    birthdayIn: 23,
    birthYear: 1995,
    character: "panda",
    color: "sky",
    city: "Tangier",
    bio: "Climbing walls, mostly the fun kind.",
    handle: "amine_t",
  },
];

export type DayInput = {
  kind: "anniversary" | "graduation" | "work_milestone" | "remembrance" | "other";
  title?: string;
  day: number;
  month: number;
  year?: number;
  recurring: boolean;
};

export type DemoPerson = {
  name: string;
  relationKind: Relation;
  /** "How you'd describe them" (≤ 30). */
  relation?: string;
  color: Color;
  birthday: { day: number; month: number; year?: number };
  /** 2–4, each starting with an emoji (≤ 60 characters). */
  littleThings: string[];
  inMemory?: boolean;
  /** One of the other demo accounts: invited from this person, so linked. */
  account?: Exclude<AccountKey, "main">;
  /** An invite made for them and not accepted yet (the pending request). */
  pendingInvite?: boolean;
  days: DayInput[];
};

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** A day and month `n` days from today; with a birth year that suits 29 February. */
function on(today: CalendarDate, n: number, year?: number) {
  const d = addDays(today, n);
  let y = year;
  if (y !== undefined && d.month === 2 && d.day === 29 && !isLeap(y)) y = y - (y % 4);
  return { day: d.day, month: d.month, ...(y === undefined ? {} : { year: y }) };
}

/** A one-off day `n` days from today (with its real year). */
function once(today: CalendarDate, n: number) {
  const d = addDays(today, n);
  return { day: d.day, month: d.month, year: d.year };
}

/** "⚽ Loves football" → the emoji and the text, as the app stores them. */
export function splitThing(thing: string): { emoji: string; text: string } {
  const [emoji = "", ...rest] = thing.split(" ");
  return { emoji, text: rest.join(" ") };
}

/** Maya's seven people, over the next 60 days. */
export function demoPeople(today: CalendarDate): DemoPerson[] {
  const birth = (n: number, year?: number) => on(today, n, year);
  return [
    {
      name: "Khalid",
      relationKind: "Best friend",
      color: "rose",
      birthday: birth(0, 1996),
      littleThings: ["⚽ Loves football", "☕ Black coffee, no sugar", "🎧 Old Gnawa records"],
      account: "khalid",
      days: [
        { kind: "other", title: "Friendiversary", ...on(today, 26, 2012), recurring: true },
        { kind: "other", title: "Driving test", ...once(today, 9), recurring: false },
      ],
    },
    {
      name: "Yasmine",
      relationKind: "Family",
      relation: "Little sister",
      color: "lilac",
      birthday: birth(1, 2003),
      littleThings: ["📚 Sci-fi novels", "🌻 Sunflowers", "🍵 Matcha lattes", "🎨 Watercolours"],
      days: [
        { kind: "graduation", title: "Master's graduation", ...once(today, 20), recurring: false },
      ],
    },
    {
      name: "Mom & Dad",
      relationKind: "Family",
      relation: "Parents",
      color: "sky",
      birthday: birth(3, 1966),
      littleThings: ["🫖 Mint tea after lunch", "🎶 Oum Kalthoum", "🌿 Their rooftop garden"],
      days: [
        {
          kind: "anniversary",
          title: "Wedding anniversary",
          ...on(today, 6, 1990),
          recurring: true,
        },
        { kind: "other", title: "Dad's birthday", ...on(today, 38, 1963), recurring: true },
      ],
    },
    {
      name: "Omar",
      relationKind: "Colleague",
      color: "mint",
      birthday: birth(5),
      littleThings: ["🍫 Dark chocolate", "🎙️ Podcasts on the commute"],
      days: [
        {
          kind: "work_milestone",
          title: "5 years at the studio",
          ...on(today, 12, 2021),
          recurring: true,
        },
      ],
    },
    {
      name: "Nadia",
      relationKind: "Friend",
      relation: "Friend from uni",
      color: "butter",
      birthday: birth(14, 1997),
      littleThings: ["🧘 Sunday yoga", "🌸 Jasmine", "📷 Film photos"],
      pendingInvite: true,
      days: [
        { kind: "graduation", title: "PhD defence", ...once(today, 34), recurring: false },
        { kind: "other", title: "Uni reunion", ...once(today, 47), recurring: false },
      ],
    },
    {
      name: "Amine",
      relationKind: "Friend",
      relation: "Climbing buddy",
      color: "peach",
      birthday: birth(23, 1995),
      littleThings: ["🧗 Bouldering", "🌮 Street food", "🏃 Morning runs"],
      account: "amine",
      days: [{ kind: "other", title: "Half marathon", ...once(today, 30), recurring: false }],
    },
    {
      name: "Sara",
      relationKind: "Friend",
      color: "rose",
      birthday: birth(41, 1996),
      littleThings: ["🕯️ Candles", "🍋 Lemon cake", "📖 Poetry"],
      account: "sara",
      days: [
        { kind: "anniversary", title: "Sara & Youssef", ...on(today, 52, 2022), recurring: true },
      ],
    },
  ];
}

export type DemoWish = {
  title: string;
  list: "birthday" | "treat";
  price?: number;
  currency?: "MAD" | "EUR";
  /** The shop's page: the app shows its name ("jumia.ma"). */
  url?: string;
  note?: string;
  priority: "love" | "like" | "nice";
  /** A generated illustration (never a real photo). */
  image?: Color;
  /** Reserved by this other demo account (only on "My birthday" lists). */
  reservedBy?: AccountKey;
};

export const WISHES: Record<AccountKey, DemoWish[]> = {
  main: [
    {
      title: "Ceramic tea set",
      list: "birthday",
      price: 450,
      url: "https://www.jumia.ma/ceramic-tea-set",
      priority: "love",
      image: "sky",
      reservedBy: "sara",
    },
    {
      title: "Linen tote bag",
      list: "birthday",
      price: 180,
      url: "https://www.zara.com/ma/linen-tote",
      priority: "like",
      image: "butter",
      reservedBy: "khalid",
    },
    {
      title: "A day at the hammam",
      list: "birthday",
      price: 350,
      note: "The one in the medina, please",
      priority: "love",
      image: "peach",
    },
    {
      title: "Instant film camera",
      list: "birthday",
      price: 990,
      url: "https://www.electroplanet.ma/instant-camera",
      priority: "love",
      image: "lilac",
    },
    {
      title: "Moroccan kitchen cookbook",
      list: "birthday",
      price: 220,
      url: "https://www.virginmegastore.ma/moroccan-kitchen",
      priority: "nice",
      image: "mint",
    },
    {
      title: "Weekend in Chefchaouen",
      list: "treat",
      price: 1500,
      priority: "love",
      image: "mint",
    },
    {
      title: "Pottery class",
      list: "treat",
      price: 300,
      url: "https://www.dabadoo.ma/pottery-class",
      priority: "like",
      image: "rose",
    },
    {
      title: "New running shoes",
      list: "treat",
      price: 800,
      url: "https://www.decathlon.ma/running-shoes",
      priority: "nice",
      image: "sky",
    },
  ],
  khalid: [
    {
      title: "Raja home jersey",
      list: "birthday",
      price: 450,
      url: "https://www.decathlon.ma/raja-jersey",
      priority: "love",
      image: "mint",
      reservedBy: "main",
    },
    {
      title: "Match ball",
      list: "birthday",
      price: 350,
      url: "https://www.decathlon.ma/match-ball",
      priority: "like",
      image: "butter",
    },
    {
      title: "Pour-over coffee kit",
      list: "birthday",
      price: 520,
      url: "https://www.jumia.ma/pour-over-kit",
      priority: "love",
      image: "peach",
      reservedBy: "amine",
    },
  ],
  sara: [
    {
      title: "Scented candle set",
      list: "birthday",
      price: 200,
      url: "https://www.jumia.ma/candle-set",
      priority: "love",
      image: "lilac",
      reservedBy: "amine",
    },
    {
      title: "Poetry collection",
      list: "birthday",
      price: 150,
      url: "https://www.virginmegastore.ma/poetry",
      priority: "like",
      image: "rose",
      reservedBy: "main",
    },
    {
      title: "Lemon cake recipe book",
      list: "birthday",
      price: 140,
      priority: "nice",
      image: "butter",
    },
  ],
  amine: [
    {
      title: "Climbing chalk bag",
      list: "birthday",
      price: 180,
      url: "https://www.decathlon.ma/chalk-bag",
      priority: "love",
      image: "sky",
    },
    {
      title: "Running watch",
      list: "birthday",
      price: 1200,
      url: "https://www.electroplanet.ma/running-watch",
      priority: "love",
      image: "mint",
      reservedBy: "khalid",
    },
    {
      title: "Trail socks",
      list: "birthday",
      price: 90,
      url: "https://www.decathlon.ma/trail-socks",
      priority: "nice",
      reservedBy: "main",
    },
  ],
};

/** Maya's plans: Khalid's birthday partly done, and her own day. */
export const PLANS: { person: string | null; ticked: string[] }[] = [
  { person: "Khalid", ticked: ["Message"] },
  { person: null, ticked: ["Treat yourself"] },
];

export const SEALED_NOTE =
  "Dear future me, I hope this year was gentle with you. Remember the sunset in Essaouira, and call Grandma's sister more often.";
