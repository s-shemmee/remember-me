/**
 * A connected person's own look (their account's photo or character), as
 * you're allowed to see it: only for your connections (my_friends(), and
 * Storage's can_view_avatar for the photo). Your own fields for them (the
 * name you gave, colour, relation, notes, little things, dates) never
 * change: without a look, the avatar is their initials in your colour.
 */
export type Look = {
  /** A signed URL (an hour) for their current photo. */
  photoUrl: string | null;
  /** Their character emoji, when that's their avatar. */
  character: string | null;
};

/** Your people's looks, by person id: only people linked to a connection that has one. */
export function looksByPerson(
  friends: { linkedPersonId: string | null; photoUrl?: string | null; character: string | null }[],
): Map<string, Look> {
  const looks = new Map<string, Look>();
  for (const f of friends) {
    if (!f.linkedPersonId) continue;
    const photoUrl = f.photoUrl ?? null;
    if (!photoUrl && !f.character) continue;
    looks.set(f.linkedPersonId, { photoUrl, character: photoUrl ? null : f.character });
  }
  return looks;
}
