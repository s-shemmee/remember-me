/**
 * pnpm seed:demo: demo accounts with realistic data, in local Supabase only.
 * The one cloud project is production and is never seeded: every cloud URL
 * is refused before anything is written (src/lib/seed-guard.ts).
 *
 *   pnpm db:start && pnpm seed:demo
 *
 * Four accounts: Maya (the main one: city, little line, birthday,
 * avatar) plus Khalid, Sara and Amine, all connected. Maya has 7 people
 * with several days each over the next 60 days and little things with an
 * emoji; Nadia has a pending invite, the rest aren't connected. Wishes have
 * images, MAD prices and shops; some are reserved by Maya, some taken by
 * the others. Khalid's birthday plan is partly done; a sealed note and
 * reminders are on. Everything goes through the app's own database functions with
 * each account's session, so it passes the same checks as real data.
 *
 * Re-running deletes the previous demo accounts first (only users the admin
 * API marked `demo_seed`), so it always starts clean. Secrets are read from
 * `supabase status` and never printed.
 */
import { spawnSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  addDays,
  nextOccurrence,
  todayIn,
  toIsoDate,
  type CalendarDate,
} from "../src/lib/dates.ts";
import { checkSeedTarget } from "../src/lib/seed-guard.ts";
import type { Database } from "../src/lib/supabase/types.ts";
import { DEMO_LOCAL_PASSWORD } from "../src/test/fake-values.ts";
import {
  ACCOUNTS,
  type AccountKey,
  DEMO_TIMEZONE,
  demoPeople,
  PLANS,
  SEALED_NOTE,
  splitThing,
  WISHES,
} from "./demo/data.ts";
import { giftPng } from "./demo/gift-png.ts";

type Client = SupabaseClient<Database>;
const AUTH = { auth: { persistSession: false, autoRefreshToken: false } };
const EMAIL = (name: string) => `demo.${name.toLowerCase()}@remember-me.test`;

function fail(message: string): never {
  console.error(`\nseed:demo refused: ${message}\n`);
  process.exit(1);
}

/** Unwraps a Supabase result: the data of the success branch, or throws with what failed. */
function must<R extends { data: unknown; error: unknown }>(
  res: R,
  what: string,
): NonNullable<Extract<R, { error: null }>["data"]> {
  if (res.error) throw new Error(`${what}: ${(res.error as { message: string }).message}`);
  return res.data as NonNullable<Extract<R, { error: null }>["data"]>;
}

/** Local keys from `supabase status` (parsed here, never printed). */
function localKeys(): { secret: string; publishable: string } {
  const out = spawnSync("pnpm exec supabase status -o env", { shell: true, encoding: "utf8" });
  const env = Object.fromEntries(
    (out.stdout ?? "")
      .split(/\r?\n/)
      .map((l) => /^([A-Z_]+)="?([^"]*)"?$/.exec(l.trim()))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  if (!env.SECRET_KEY || !env.PUBLISHABLE_KEY) {
    fail("Local Supabase isn't running (`pnpm db:start`), or `supabase status` gave no keys.");
  }
  return { secret: env.SECRET_KEY, publishable: env.PUBLISHABLE_KEY };
}

async function main() {
  // 1. Where: local Supabase, nothing else.
  const target = checkSeedTarget(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!target.ok) fail(target.reason);

  // The keys always come from the local stack, never from the environment.
  const keys = localKeys();
  const password = DEMO_LOCAL_PASSWORD;
  const emails = Object.fromEntries(ACCOUNTS.map((a) => [a.key, EMAIL(a.firstName)])) as Record<
    AccountKey,
    string
  >;

  console.log(`Seeding demo data into local Supabase (${target.url}).`);
  const admin: Client = createClient<Database>(target.url, keys.secret, AUTH);

  // 2. Reset: delete the previous demo accounts (and only those).
  const wanted = new Set(Object.values(emails));
  for (let page = 1; ; page++) {
    const { users } = must(await admin.auth.admin.listUsers({ page, perPage: 200 }), "list users");
    for (const u of users) {
      const isDemo = u.app_metadata?.demo_seed === true;
      if (!isDemo && u.email && wanted.has(u.email)) {
        fail(`${u.email} belongs to an account the seed didn't create. Remove it first.`);
      }
      if (!isDemo) continue;
      must(await admin.rpc("prepare_account_deletion", { p_user_id: u.id }), "prepare deletion");
      for (const bucket of ["avatars", "wish-images"]) {
        const files = must(
          await admin.storage.from(bucket).list(u.id, { limit: 1000 }),
          `list ${bucket}`,
        );
        if (files.length) {
          must(
            await admin.storage.from(bucket).remove(files.map((f) => `${u.id}/${f.name}`)),
            `empty ${bucket}`,
          );
        }
      }
      must(await admin.auth.admin.deleteUser(u.id), "delete user");
      console.log(`  removed the previous ${u.email}`);
    }
    if (users.length < 200) break;
  }

  // 3. Accounts, confirmed, each with its own session.
  const today = todayIn(DEMO_TIMEZONE);
  const db = {} as Record<AccountKey, Client>;
  const uid = {} as Record<AccountKey, string>;
  for (const a of ACCOUNTS) {
    const created = must(
      await admin.auth.admin.createUser({
        email: emails[a.key],
        password,
        email_confirm: true,
        user_metadata: { first_name: a.firstName },
        app_metadata: { demo_seed: true },
      }),
      `create ${a.firstName}`,
    );
    uid[a.key] = created.user!.id;
    const client = createClient<Database>(target.url, keys.publishable, AUTH);
    must(
      await client.auth.signInWithPassword({ email: emails[a.key], password }),
      `sign in ${a.firstName}`,
    );
    db[a.key] = client;

    const bday = addDays(today, a.birthdayIn);
    must(
      await client.rpc("complete_onboarding", {
        p_first_name: a.firstName,
        p_birthday_day: bday.day,
        p_birthday_month: bday.month,
        p_birth_year: a.birthYear,
        p_avatar_kind: "character",
        p_avatar_character: a.character,
        p_avatar_color: a.color,
        p_reminder_offsets: [7, 1, 0],
        p_reminder_email: true,
        p_reminder_push: false,
        p_timezone: DEMO_TIMEZONE,
      }),
      `onboard ${a.firstName}`,
    );
    must(
      await client
        .from("profiles")
        .update({ last_name: a.lastName, city: a.city, bio: a.bio, handle: a.handle })
        .eq("id", uid[a.key]),
      `profile ${a.firstName}`,
    );
    must(
      await client
        .from("reminder_settings")
        .update({ remind_my_day: true })
        .eq("profile_id", uid[a.key]),
      `reminders ${a.firstName}`,
    );
  }

  // 4. Maya's people and their days.
  const personId = new Map<string, string>();
  for (const p of demoPeople(today)) {
    const id = must(
      await db.main.rpc("save_person", {
        p_name: p.name,
        p_relation_kind: p.relationKind,
        p_relation: p.relation,
        p_color: p.color,
        p_birthday_day: p.birthday.day,
        p_birthday_month: p.birthday.month,
        p_birthday_year: p.birthday.year,
        p_little_things: p.littleThings.map((t) => splitThing(t).text),
        p_little_thing_emojis: p.littleThings.map((t) => splitThing(t).emoji),
        p_days: p.days,
      }),
      `add ${p.name}`,
    );
    personId.set(p.name, id);
    if (p.inMemory)
      must(await db.main.from("people").update({ in_memory: true }).eq("id", id), "in memory");
  }

  // 5. Connections: Maya invites each friend from their person (so linked); the friends connect too.
  const connect = async (from: AccountKey, to: AccountKey, person?: string) => {
    const token = must(
      await db[from].rpc("create_invite", person ? { p_person_id: personId.get(person)! } : {}),
      `invite ${from} → ${to}`,
    );
    must(await db[to].rpc("accept_invite", { p_token: token }), `accept ${from} → ${to}`);
  };
  for (const p of demoPeople(today)) if (p.account) await connect("main", p.account, p.name);
  await connect("khalid", "sara");
  await connect("khalid", "amine");
  await connect("sara", "amine");
  // The pending request: an invite made for Nadia, not accepted yet.
  for (const p of demoPeople(today)) {
    if (p.pendingInvite) {
      must(
        await db.main.rpc("create_invite", { p_person_id: personId.get(p.name)! }),
        `invite ${p.name}`,
      );
    }
  }

  // 6. Wishes (with generated gift illustrations), then reservations.
  const wishIds: { id: string; reservedBy?: AccountKey }[] = [];
  for (const a of ACCOUNTS) {
    const lists = must(
      await db[a.key].from("wishlists").select("id, kind").eq("owner_id", uid[a.key]),
      "lists",
    );
    const listId = (kind: "birthday" | "treat") => lists.find((l) => l.kind === kind)!.id;
    let position = 0;
    for (const w of WISHES[a.key]) {
      let imagePath: string | null = null;
      if (w.image) {
        imagePath = `${uid[a.key]}/demo-${position}.png`;
        must(
          await db[a.key].storage
            .from("wish-images")
            .upload(imagePath, giftPng(w.image), { contentType: "image/png" }),
          "upload image",
        );
      }
      const row = must(
        await db[a.key]
          .from("wishes")
          .insert({
            wishlist_id: listId(w.list),
            title: w.title,
            price_amount: w.price ?? null,
            currency: w.currency ?? "MAD",
            url: w.url ?? null,
            note: w.note ?? null,
            priority: w.priority,
            image_path: imagePath,
            position: position++,
          })
          .select("id")
          .single(),
        `wish ${w.title}`,
      );
      wishIds.push({ id: row.id, reservedBy: w.reservedBy });
    }
  }

  // 7. Maya's birthday plans, with some steps ticked.
  const people = demoPeople(today);
  for (const plan of PLANS) {
    let occasionId: string | null = null;
    let occurs: CalendarDate;
    if (plan.person) {
      const p = people.find((x) => x.name === plan.person)!;
      occasionId = must(
        await db.main
          .from("occasions")
          .select("id")
          .eq("person_id", personId.get(p.name)!)
          .eq("kind", "birthday")
          .single(),
        `occasion ${p.name}`,
      ).id;
      occurs = nextOccurrence(p.birthday, today);
    } else {
      occurs = addDays(today, ACCOUNTS[0]!.birthdayIn);
    }
    const planId = must(
      await db.main.rpc("start_plan", {
        p_occasion_id: occasionId as string,
        p_occurs_on: toIsoDate(occurs),
      }),
      `plan ${plan.person ?? "own day"}`,
    );
    if (plan.ticked.length) {
      must(
        await db.main
          .from("plan_steps")
          .update({ done_at: new Date().toISOString(), ticked_by: "me" })
          .eq("plan_id", planId)
          .in("label", plan.ticked),
        "tick steps",
      );
    }
  }

  // Reserving after the plans: Maya reserving Khalid's wish ticks "Gift" in her plan for Khalid.
  for (const w of wishIds) {
    if (w.reservedBy)
      must(await db[w.reservedBy].rpc("reserve_wish", { p_wish_id: w.id }), "reserve");
  }

  // 8. A sealed note to future Maya.
  must(await db.main.rpc("seal_future_note", { p_body: SEALED_NOTE }), "sealed note");

  console.log(`\nDone. ${people.length} people, ${wishIds.length} wishes, ${PLANS.length} plans.`);
  console.log("\nDemo login (local only):");
  console.log(`  Email:    ${emails.main}   (Maya, the main demo user)`);
  console.log(`  Password: ${DEMO_LOCAL_PASSWORD}`);
  console.log("  Friends (same password):");
  for (const a of ACCOUNTS.filter((x) => x.key !== "main"))
    console.log(`    ${a.firstName.padEnd(8)} ${emails[a.key]}`);
}

main().catch((error: unknown) => {
  console.error(`\nseed:demo failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
