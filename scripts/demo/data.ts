/**
 * The demo data for `pnpm seed:demo`: pure, every date relative to `today`.
 * Fictional people only (Moroccan and international names), no real photos.
 * src/lib/seed-demo.test.ts checks it covers every relation, colour and
 * occasion type, and that days fall today, tomorrow, this week and up to 60
 * days out.
 */
import { addDays, type CalendarDate } from "../../src/lib/dates.ts";

export const DEMO_TIMEZONE = "Africa/Casablanca";

export const COLORS = ["rose", "sky", "peach", "lilac", "mint", "butter"] as const;
export const RELATIONS = ["Best friend", "Family", "Partner", "Friend", "Colleague"] as const;
type Color = (typeof COLORS)[number];
type Relation = (typeof RELATIONS)[number];

export type AccountKey = "main" | "amina" | "badr" | "sara";

export type DemoAccount = {
  key: AccountKey;
  firstName: string;
  /** Days from today to their birthday. */
  birthdayIn: number;
  birthYear: number;
  character: string;
  color: Color;
};

export const ACCOUNTS: DemoAccount[] = [
  {
    key: "main",
    firstName: "Maya",
    birthdayIn: 18,
    birthYear: 1997,
    character: "sunflower",
    color: "rose",
  },
  {
    key: "amina",
    firstName: "Amina",
    birthdayIn: 4,
    birthYear: 1997,
    character: "fox",
    color: "peach",
  },
  {
    key: "badr",
    firstName: "Badr",
    birthdayIn: 23,
    birthYear: 1995,
    character: "panda",
    color: "sky",
  },
  {
    key: "sara",
    firstName: "Sara",
    birthdayIn: 41,
    birthYear: 1996,
    character: "moon",
    color: "lilac",
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
  littleThings: string[];
  inMemory?: boolean;
  /** One of the other demo accounts: invited from this person, so linked. */
  account?: Exclude<AccountKey, "main">;
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

/** The main account's people: 26, every relation and colour, over the next 60 days. */
export function demoPeople(today: CalendarDate): DemoPerson[] {
  const birth = (n: number, year?: number) => on(today, n, year);
  return [
    {
      name: "Khalid",
      relationKind: "Best friend",
      color: "rose",
      birthday: birth(0, 1996),
      littleThings: ["Black coffee", "Vinyl records"],
      days: [],
    },
    {
      name: "Yasmine",
      relationKind: "Friend",
      color: "lilac",
      birthday: birth(1),
      littleThings: ["Matcha", "Sunflowers"],
      days: [],
    },
    {
      name: "Mom",
      relationKind: "Family",
      relation: "Mom",
      color: "sky",
      birthday: birth(3, 1968),
      littleThings: ["Mint tea", "Oum Kalthoum"],
      days: [
        {
          kind: "anniversary",
          title: "Mom & Dad's wedding",
          ...on(today, 6, 1990),
          recurring: true,
        },
      ],
    },
    {
      name: "Amina",
      relationKind: "Best friend",
      color: "peach",
      birthday: birth(4, 1997),
      littleThings: ["Orange blossom", "Poetry"],
      account: "amina",
      days: [],
    },
    {
      name: "Omar",
      relationKind: "Colleague",
      color: "mint",
      birthday: birth(5),
      littleThings: ["Dark chocolate"],
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
      name: "Léa",
      relationKind: "Friend",
      color: "butter",
      birthday: birth(6, 1995),
      littleThings: ["Croissants", "Film cameras"],
      days: [],
    },
    {
      name: "Youssef",
      relationKind: "Family",
      relation: "Little brother",
      color: "sky",
      birthday: birth(8, 2004),
      littleThings: ["Football", "Video games"],
      days: [
        { kind: "graduation", title: "Master's graduation", ...once(today, 20), recurring: false },
      ],
    },
    {
      name: "Kenji",
      relationKind: "Colleague",
      color: "mint",
      birthday: birth(10),
      littleThings: ["Ramen"],
      days: [],
    },
    {
      name: "Nadia",
      relationKind: "Friend",
      color: "rose",
      birthday: birth(12, 1993),
      littleThings: ["Yoga", "Jasmine"],
      days: [],
    },
    {
      name: "Grandma Fatima",
      relationKind: "Family",
      relation: "Grandma",
      color: "lilac",
      birthday: birth(14, 1940),
      littleThings: [],
      inMemory: true,
      days: [
        {
          kind: "remembrance",
          title: "Remembering Grandma",
          ...on(today, 33, 2022),
          recurring: true,
        },
      ],
    },
    {
      name: "Mehdi",
      relationKind: "Partner",
      color: "peach",
      birthday: birth(17, 1994),
      littleThings: ["Surfing", "Msemen"],
      days: [
        { kind: "anniversary", title: "Our anniversary", ...on(today, 27, 2019), recurring: true },
      ],
    },
    {
      name: "Sofia",
      relationKind: "Friend",
      color: "butter",
      birthday: birth(19),
      littleThings: ["Bookshops"],
      days: [],
    },
    {
      name: "Rachid",
      relationKind: "Colleague",
      color: "mint",
      birthday: birth(21, 1985),
      littleThings: ["Chess"],
      days: [],
    },
    {
      name: "Badr",
      relationKind: "Friend",
      color: "sky",
      birthday: birth(23, 1995),
      littleThings: ["Running"],
      account: "badr",
      days: [],
    },
    {
      name: "Imane",
      relationKind: "Best friend",
      color: "rose",
      birthday: birth(24),
      littleThings: ["Pastries", "Old films"],
      days: [],
    },
    {
      name: "Daniel",
      relationKind: "Friend",
      color: "lilac",
      birthday: birth(27),
      littleThings: ["Jazz"],
      days: [],
    },
    {
      name: "Hajar",
      relationKind: "Family",
      relation: "Cousin",
      color: "peach",
      birthday: birth(30, 2000),
      littleThings: ["Henna"],
      days: [],
    },
    {
      name: "Priya",
      relationKind: "Colleague",
      color: "butter",
      birthday: birth(33),
      littleThings: ["Chai"],
      days: [],
    },
    {
      name: "Zineb",
      relationKind: "Friend",
      color: "mint",
      birthday: birth(36, 1998),
      littleThings: ["Plants"],
      days: [],
    },
    {
      name: "Lucas",
      relationKind: "Friend",
      color: "sky",
      birthday: birth(40),
      littleThings: ["Climbing"],
      days: [],
    },
    {
      name: "Sara",
      relationKind: "Friend",
      color: "rose",
      birthday: birth(41, 1996),
      littleThings: ["Candles", "Lemon cake"],
      account: "sara",
      days: [],
    },
    {
      name: "Karim",
      relationKind: "Family",
      relation: "Uncle",
      color: "lilac",
      birthday: birth(43, 1972),
      littleThings: ["Gnawa music"],
      days: [],
    },
    {
      name: "Mariam",
      relationKind: "Friend",
      color: "peach",
      birthday: birth(47),
      littleThings: ["Ceramics"],
      days: [{ kind: "other", title: "Housewarming", ...once(today, 50), recurring: false }],
    },
    {
      name: "Tom",
      relationKind: "Colleague",
      color: "butter",
      birthday: birth(53),
      littleThings: ["Board games"],
      days: [],
    },
    {
      name: "Ghita",
      relationKind: "Best friend",
      color: "mint",
      birthday: birth(57, 1999),
      littleThings: ["Argan oil", "Travel"],
      days: [],
    },
    {
      name: "Aya",
      relationKind: "Family",
      relation: "Niece",
      color: "sky",
      birthday: birth(59, 2018),
      littleThings: ["Unicorns"],
      days: [],
    },
  ];
}

export type DemoWish = {
  title: string;
  list: "birthday" | "treat";
  price?: number;
  currency?: "MAD" | "EUR";
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
      currency: "MAD",
      url: "https://example.com/tea-set",
      priority: "love",
      image: "sky",
      reservedBy: "amina",
    },
    {
      title: "Linen tote bag",
      list: "birthday",
      price: 180,
      currency: "MAD",
      priority: "like",
      image: "butter",
      reservedBy: "badr",
    },
    {
      title: "A day at the hammam",
      list: "birthday",
      price: 350,
      currency: "MAD",
      note: "The one in the medina, please",
      priority: "love",
      reservedBy: "sara",
    },
    {
      title: "Film camera",
      list: "birthday",
      price: 120,
      currency: "EUR",
      url: "https://example.com/film-camera",
      priority: "love",
      image: "peach",
    },
    {
      title: "Cookbook: Moroccan kitchen",
      list: "birthday",
      price: 220,
      currency: "MAD",
      priority: "nice",
    },
    {
      title: "Wireless earbuds",
      list: "birthday",
      price: 900,
      currency: "MAD",
      priority: "like",
      image: "lilac",
    },
    {
      title: "Weekend in Chefchaouen",
      list: "treat",
      price: 1500,
      currency: "MAD",
      priority: "love",
      image: "mint",
    },
    { title: "Pottery class", list: "treat", price: 300, currency: "MAD", priority: "like" },
    {
      title: "New running shoes",
      list: "treat",
      price: 800,
      currency: "MAD",
      priority: "nice",
      image: "rose",
    },
  ],
  amina: [
    {
      title: "Poetry collection",
      list: "birthday",
      price: 150,
      currency: "MAD",
      priority: "love",
      image: "peach",
      reservedBy: "main",
    },
    {
      title: "Orange blossom perfume",
      list: "birthday",
      price: 400,
      currency: "MAD",
      priority: "like",
      image: "butter",
    },
    {
      title: "Silk scarf",
      list: "birthday",
      price: 260,
      currency: "MAD",
      priority: "nice",
      reservedBy: "sara",
    },
  ],
  badr: [
    {
      title: "Running watch",
      list: "birthday",
      price: 1200,
      currency: "MAD",
      priority: "love",
      image: "sky",
    },
    {
      title: "Trail running socks",
      list: "birthday",
      price: 90,
      currency: "MAD",
      priority: "nice",
      reservedBy: "amina",
    },
  ],
  sara: [
    {
      title: "Scented candle set",
      list: "birthday",
      price: 200,
      currency: "MAD",
      priority: "love",
      image: "lilac",
      reservedBy: "badr",
    },
    {
      title: "Lemon cake recipe book",
      list: "birthday",
      price: 140,
      currency: "MAD",
      priority: "like",
    },
  ],
};

/** The main account's birthday plans: whose next day, and which steps are ticked. */
export const PLANS: { person: string | null; ticked: string[] }[] = [
  { person: "Khalid", ticked: ["Gift", "Message"] },
  { person: "Yasmine", ticked: ["Message"] },
  { person: "Mom", ticked: [] },
  { person: null, ticked: ["Treat yourself"] },
];

export const SEALED_NOTE =
  "Dear future me, I hope this year was gentle with you. Remember the sunset in Essaouira, and call Grandma's sister more often.";
