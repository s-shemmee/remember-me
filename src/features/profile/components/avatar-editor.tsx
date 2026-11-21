"use client";

import { PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, ChoiceItem } from "@/components/ui/choice-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel, FieldNote } from "@/components/ui/field";
import { CHARACTERS, characterEmoji, PASTELS } from "@/features/onboarding/constants";
import { ColorSwatches } from "@/features/people/components/color-swatches";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

import { discardAvatarUpload, saveLook } from "../actions";
import { checkImageFile, prepareAvatar } from "../avatar-image";
import { AVATARS_BUCKET } from "../constants";

export type Look = {
  kind: "initials" | "character" | "photo";
  color: Pastel;
  character: string | null;
  photoPath: string | null;
};

const LOOK_KINDS = [
  { value: "initials", label: "Initials" },
  { value: "character", label: "Character" },
  { value: "photo", label: "Photo" },
] as const;

const chip =
  "inline-flex min-h-11 items-center rounded-pill bg-card2 px-4 text-15 font-semibold text-text data-[state=checked]:bg-text data-[state=checked]:text-bg";

/**
 * Your avatar on the profile header, with Edit: initials, a character or a
 * photo, and a colour (Shuffle picks for you). A photo is cropped and
 * re-encoded in the browser (no EXIF/GPS) and stored in your own folder; one
 * uploaded but not saved is removed again.
 */
export function AvatarEditor({
  userId,
  name,
  initial,
  initialPhotoUrl,
}: {
  userId: string;
  name: string;
  initial: Look;
  initialPhotoUrl: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saved, setSaved] = React.useState({ look: initial, photoUrl: initialPhotoUrl });
  const [look, setLookState] = React.useState(initial);
  const [photoUrl, setPhotoUrl] = React.useState(initialPhotoUrl);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState<"" | "upload" | "save">("");
  const unsaved = React.useRef<string | null>(null);
  const editButton = React.useRef<HTMLButtonElement>(null);

  const setLook = (patch: Partial<Look>) => setLookState((l) => ({ ...l, ...patch }));

  const start = () => {
    setLookState(saved.look);
    setPhotoUrl(saved.photoUrl);
    setError("");
    setOpen(true);
  };

  const close = () => {
    if (unsaved.current) void discardAvatarUpload(unsaved.current);
    unsaved.current = null;
    setOpen(false);
  };

  const shuffle = () => {
    const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;
    setLook({
      kind: Math.random() < 0.5 ? "initials" : "character",
      color: pick(PASTELS),
      character: pick(CHARACTERS).key,
    });
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const check = checkImageFile(file);
    if (!check.ok) return void setError(check.message);
    setBusy("upload");
    setError("");
    try {
      const image = await prepareAvatar(file);
      const path = `${userId}/${crypto.randomUUID()}.${image.ext}`;
      const { error: uploadError } = await createSupabaseBrowserClient()
        .storage.from(AVATARS_BUCKET)
        .upload(path, image.blob, { contentType: image.type, upsert: false });
      if (uploadError) throw uploadError;
      if (unsaved.current) void discardAvatarUpload(unsaved.current);
      unsaved.current = path;
      setPhotoUrl(URL.createObjectURL(image.blob));
      setLook({ kind: "photo", photoPath: path });
    } catch {
      setError("That photo didn't upload. Please try another one.");
    } finally {
      setBusy("");
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("save");
    const result = await saveLook({
      ...look,
      character: look.character as never,
      photoPath: look.kind === "photo" ? look.photoPath : null,
    });
    setBusy("");
    if (!result.ok) return void setError(result.message);
    unsaved.current = null;
    setSaved({ look, photoUrl });
    setOpen(false);
    router.refresh();
  };

  const avatar = (l: Look, url: string | null, className: string) => {
    const emoji = l.kind === "character" ? characterEmoji(l.character) : null;
    return (
      <Avatar
        name={name}
        pastel={l.color}
        src={l.kind === "photo" ? url : null}
        character={emoji ?? null}
        decorative
        className={cn(className, emoji ? "text-[42px]" : "text-34")}
      />
    );
  };

  return (
    <div className="relative shrink-0">
      {avatar(saved.look, saved.photoUrl, "size-24")}
      <Button
        ref={editButton}
        variant="card2"
        size="icon"
        onClick={start}
        className="absolute -right-1 -bottom-1 border-2 border-card"
        aria-label="Edit your avatar"
      >
        <PencilIcon aria-hidden className="size-[18px]" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            editButton.current?.focus();
          }}
        >
          <form onSubmit={(e) => void save(e)} noValidate className="flex flex-col gap-5">
            <DialogTitle>Your avatar</DialogTitle>
            <DialogDescription>How your people see you.</DialogDescription>
            <div className="flex flex-wrap items-center gap-4">
              {avatar(look, photoUrl, "size-20")}
              <div className="flex flex-col gap-2">
                <ChoiceGroup
                  aria-label="Avatar"
                  value={look.kind}
                  onValueChange={(next) => {
                    const kind = next as Look["kind"];
                    // Character with nothing picked yet: start with the first one.
                    setLook(
                      kind === "character" && !look.character
                        ? { kind, character: CHARACTERS[0].key }
                        : { kind },
                    );
                  }}
                >
                  {LOOK_KINDS.map((k) => (
                    <ChoiceItem key={k.value} value={k.value} className={chip}>
                      {k.label}
                    </ChoiceItem>
                  ))}
                </ChoiceGroup>
                <Button type="button" variant="transparent" className="w-fit" onClick={shuffle}>
                  Shuffle
                </Button>
              </div>
            </div>

            {look.kind === "character" && (
              <ChoiceGroup
                aria-label="Character"
                value={look.character ?? ""}
                onValueChange={(character) => setLook({ character })}
                className="grid grid-cols-4 gap-2"
              >
                {CHARACTERS.map((c) => (
                  <ChoiceItem
                    key={c.key}
                    value={c.key}
                    aria-label={c.label}
                    className="grid aspect-square place-items-center rounded-[16px] bg-card2 text-[28px] data-[state=checked]:shadow-[0_0_0_2.5px_var(--text)]"
                  >
                    <span aria-hidden>{c.emoji}</span>
                  </ChoiceItem>
                ))}
              </ChoiceGroup>
            )}

            {look.kind === "photo" && (
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="profile-photo">Your photo</FieldLabel>
                <input
                  id="profile-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-describedby="profile-photo-note"
                  aria-invalid={error ? true : undefined}
                  disabled={busy === "upload"}
                  onChange={(e) => void upload(e.currentTarget.files?.[0])}
                  className="w-full max-w-full min-w-0 text-14 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-pill file:border-0 file:bg-card2 file:px-4 file:text-15 file:font-semibold file:text-text"
                />
                <FieldNote id="profile-photo-note" error={Boolean(error)}>
                  {busy === "upload"
                    ? "Uploading…"
                    : error || "JPEG, PNG or WebP. I crop it square and remove its location data."}
                </FieldNote>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span id="profile-colour" className="text-14 font-semibold">
                Colour
              </span>
              <ColorSwatches
                labelId="profile-colour"
                value={look.color}
                onChange={(color) => setLook({ color })}
              />
            </div>

            {look.kind !== "photo" && (
              <p role="alert" className="text-14 font-semibold text-accent-text empty:hidden">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="card2" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy !== ""}>
                {busy === "save" ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
