import { NextResponse } from "next/server";

import { buildExport, exportFileName } from "@/features/account/export";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /settings/export: your data as a JSON download. Everything is read
 * with your own session (RLS), so it can only ever be yours.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user)
    return NextResponse.redirect(
      new URL("/log-in", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    );

  const [
    profile,
    settings,
    devices,
    people,
    wishlists,
    wishes,
    reservations,
    friendWishes,
    friends,
    plans,
    notes,
    sealed,
    connections,
    giftIdeas,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "first_name, birthday_day, birthday_month, birth_year, avatar_kind, avatar_color, avatar_character, timezone, share_birthday, theme, created_at",
      )
      .maybeSingle(),
    supabase
      .from("reminder_settings")
      .select("offsets_days, send_time, email, push, remind_my_day")
      .maybeSingle(),
    supabase.from("push_subscriptions").select("device_label, created_at, last_used_at"),
    supabase
      .from("people")
      .select(
        "name, relation_kind, relation, color, little_things, in_memory, created_at, occasions(kind, title, day, month, year, recurring)",
      )
      .is("archived_at", null)
      .order("created_at"),
    supabase.from("wishlists").select("id, title, kind, visibility").eq("owner_id", user.id),
    supabase
      .from("wishes")
      .select("wishlist_id, title, url, price_amount, currency, note, priority, created_at")
      .eq("owner_id", user.id)
      .is("removed_at", null)
      .order("position"),
    // Only your own reservations are readable (RLS).
    supabase.from("reservations").select("wish_id, created_at").is("cancelled_at", null),
    supabase.rpc("friend_wishes"),
    supabase.rpc("my_friends"),
    supabase
      .from("plans")
      .select("occurs_on, note, occasions(people(name)), plan_steps(label, position, done_at)")
      .order("occurs_on"),
    // Only notes already open are readable (RLS); a sealed one stays sealed.
    supabase.from("future_notes").select("opens_on, body, created_at").order("opens_on"),
    supabase.rpc("my_sealed_note"),
    // First names only, never their email, birth year or timezone.
    supabase.rpc("my_connections"),
    supabase
      .from("gift_idea_results")
      .select("budget, ideas, created_at, people(name)")
      .order("created_at"),
  ]);

  const wishById = new Map((friendWishes.data ?? []).map((w) => [w.id, w]));
  const nameById = new Map(
    (friends.data ?? []).map((f) => [f.profile_id, f.first_name ?? "A friend"]),
  );
  const reserved = (reservations.data ?? []).flatMap((r) => {
    const wish = wishById.get(r.wish_id);
    return wish
      ? [
          {
            friendFirstName: nameById.get(wish.owner_id) ?? "A friend",
            wishTitle: wish.title,
            reservedAt: r.created_at,
          },
        ]
      : [];
  });

  const exportedAt = new Date().toISOString();
  const body = buildExport({
    exportedAt,
    email: user.email ?? null,
    profile: profile.data,
    reminderSettings: settings.data,
    devices: devices.data ?? [],
    people: people.data ?? [],
    wishlists: wishlists.data ?? [],
    wishes: wishes.data ?? [],
    reserved,
    plans: (plans.data ?? []).map((p) => ({
      for: p.occasions?.people?.name ?? null,
      occursOn: p.occurs_on,
      note: p.note,
      steps: [...p.plan_steps]
        .sort((a, b) => a.position - b.position)
        .map((st) => ({ label: st.label, done: st.done_at !== null })),
    })),
    giftIdeas: (giftIdeas.data ?? []).map((g) => ({
      for: g.people?.name ?? "Someone",
      budget: g.budget,
      madeAt: g.created_at,
      ideas: g.ideas as { title: string; why: string }[],
    })),
    openedNotes: (notes.data ?? []).map((n) => ({
      opensOn: n.opens_on,
      body: n.body,
      writtenAt: n.created_at,
    })),
    sealedNote: sealed.data?.[0]
      ? { opensOn: sealed.data[0].opens_on, writtenAt: sealed.data[0].created_at }
      : null,
    connections: (connections.data ?? []).map((c) => ({
      firstName: c.first_name,
      connectedAt: c.connected_at,
      yourPerson: c.linked_person_name ?? null,
    })),
  });

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(exportedAt)}"`,
      "Cache-Control": "no-store",
    },
  });
}
