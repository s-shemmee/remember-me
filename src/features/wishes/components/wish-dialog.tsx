"use client";

import { ImagePlusIcon, XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ChoiceGroup, ChoiceItem } from "@/components/ui/choice-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldNote, fieldInputClass } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { discardUpload, saveWish } from "../actions";
import {
  CURRENCIES,
  PRIORITIES,
  WISH_IMAGES_BUCKET,
  WISH_NOTE_MAX,
  WISH_TITLE_MAX,
} from "../constants";
import { checkImageFile, prepareImage } from "../image";
import type { Wish, Wishlist } from "../load";
import { wishFieldErrors, wishFormSchema, type WishFormValues } from "../schema";

type Errors = Record<string, string>;

export const emptyWishForm = (wishlistId: string): WishFormValues => ({
  id: null,
  wishlistId,
  title: "",
  url: "",
  price: "",
  currency: "MAD",
  note: "",
  priority: "like",
  imagePath: null,
});

export const wishToForm = (w: Wish): WishFormValues => ({
  id: w.id,
  wishlistId: w.wishlistId,
  title: w.title,
  url: w.url ?? "",
  price: w.price === null ? "" : String(w.price),
  currency: (CURRENCIES as readonly string[]).includes(w.currency)
    ? (w.currency as WishFormValues["currency"])
    : "MAD",
  note: w.note ?? "",
  priority: w.priority,
  imagePath: w.imagePath,
});

const FIELD_IDS: Record<string, string> = {
  title: "wish-title",
  url: "wish-url",
  price: "wish-price",
  note: "wish-note",
  wishlistId: "wish-list",
  imagePath: "wish-image",
};

/**
 * Add or edit a wish: title (80), link, price with currency, priority,
 * note, which list, and a photo. Photos are shrunk and re-encoded in the
 * browser (no EXIF/GPS leaves the device), then uploaded to your own folder
 * in the private bucket. Save is never disabled; it says what's missing.
 */
export function WishDialog({
  open,
  onOpenChange,
  initial,
  initialImageUrl,
  lists,
  userId,
  onSaved,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: WishFormValues;
  initialImageUrl: string | null;
  lists: Pick<Wishlist, "id" | "title">[];
  userId: string;
  onSaved: (result: { id: string; title: string; added: boolean }) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const editing = Boolean(initial.id);
  const [values, setValues] = React.useState(initial);
  const [preview, setPreview] = React.useState<string | null>(initialImageUrl);
  const [errors, setErrors] = React.useState<Errors>({});
  const [message, setMessage] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  // Uploaded in this dialog but not saved yet: deleted if the dialog closes.
  const unsaved = React.useRef<string | null>(null);

  const update = (patch: Partial<WishFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const keys = Object.keys(patch).filter((k) => k in e);
      if (!keys.length) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });
    if (message) setMessage("");
  };

  const showErrors = (next: Errors, announce?: string) => {
    setErrors(next);
    setMessage(announce ?? Object.values(next)[0] ?? "Something needs a quick look.");
    const first = Object.keys(next)[0];
    const id = first ? FIELD_IDS[first] : undefined;
    if (id)
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#${id}`)?.focus());
  };

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const check = checkImageFile(file);
    if (!check.ok) {
      showErrors({ imagePath: check.message });
      return;
    }
    setUploading(true);
    setMessage("Adding your photo…");
    try {
      const image = await prepareImage(file);
      const path = `${userId}/${crypto.randomUUID()}.${image.ext}`;
      const { error } = await createSupabaseBrowserClient()
        .storage.from(WISH_IMAGES_BUCKET)
        .upload(path, image.blob, { contentType: image.type, upsert: false });
      if (error) throw error;
      if (unsaved.current) void discardUpload(unsaved.current);
      unsaved.current = path;
      update({ imagePath: path });
      setPreview(URL.createObjectURL(image.blob));
      setMessage("Photo added.");
    } catch {
      showErrors({ imagePath: "That photo didn't work. Try another one." });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    if (unsaved.current) {
      void discardUpload(unsaved.current);
      unsaved.current = null;
    }
    update({ imagePath: null });
    setPreview(null);
    setMessage("Photo removed.");
    requestAnimationFrame(() => fileRef.current?.focus());
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pending || uploading) return;
    const parsed = wishFormSchema.safeParse(values);
    if (!parsed.success) {
      const next = wishFieldErrors(parsed.error);
      showErrors(next, next.title ? "Add what you wish for to save." : undefined);
      return;
    }
    setErrors({});
    setMessage("Saving…");
    startTransition(async () => {
      const result = await saveWish(values);
      if (!result.ok) {
        showErrors(result.fieldErrors ?? {}, result.message);
        return;
      }
      unsaved.current = null;
      onSaved({ id: result.id, title: result.title, added: !editing });
    });
  };

  const close = (next: boolean) => {
    if (pending) return;
    if (!next && unsaved.current) {
      void discardUpload(unsaved.current);
      unsaved.current = null;
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl gap-6" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit wish" : "Add a wish"}</DialogTitle>
          <DialogDescription>
            Only the title is needed. A link, price or photo helps your people find it.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} noValidate onSubmit={onSubmit} className="grid gap-5">
          <Field
            id="wish-title"
            label="What do you wish for?"
            placeholder="e.g. Ottolenghi cookbook"
            autoComplete="off"
            maxLength={WISH_TITLE_MAX}
            value={values.title}
            onChange={(e) => update({ title: e.currentTarget.value })}
            error={errors.title}
          />
          <Field
            id="wish-url"
            type="url"
            inputMode="url"
            label="Link (optional)"
            placeholder="https://"
            autoComplete="off"
            value={values.url}
            onChange={(e) => update({ url: e.currentTarget.value })}
            error={errors.url}
            helper="I don't open links for you, so paste the shop's page as it is."
          />
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2">
            <Field
              id="wish-price"
              label="Price (optional)"
              placeholder="e.g. 450"
              inputMode="decimal"
              autoComplete="off"
              value={values.price}
              onChange={(e) => update({ price: e.currentTarget.value })}
              error={errors.price}
            />
            <div className="grid content-start gap-1.5">
              <label htmlFor="wish-currency" className="text-14 font-semibold">
                Currency
              </label>
              <SelectField
                id="wish-currency"
                value={values.currency}
                onChange={(e) =>
                  update({ currency: e.currentTarget.value as WishFormValues["currency"] })
                }
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          <div className="grid gap-2">
            <span id="wish-priority-label" className="text-14 font-semibold">
              How much do you want it?
            </span>
            <ChoiceGroup
              aria-labelledby="wish-priority-label"
              value={values.priority}
              onValueChange={(v) => update({ priority: v as WishFormValues["priority"] })}
            >
              {PRIORITIES.map((p) => (
                <ChoiceItem
                  key={p.key}
                  value={p.key}
                  className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-card2 px-4 text-15 font-semibold text-text data-[state=checked]:bg-text data-[state=checked]:text-bg"
                >
                  <span aria-hidden>{p.emoji}</span>
                  {p.label}
                </ChoiceItem>
              ))}
            </ChoiceGroup>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="wish-note" className="text-14 font-semibold">
              A note (optional)
            </label>
            <textarea
              id="wish-note"
              rows={2}
              maxLength={WISH_NOTE_MAX}
              placeholder="e.g. The green cover, size M"
              value={values.note}
              aria-invalid={errors.note ? true : undefined}
              aria-describedby={errors.note ? "wish-note-note" : undefined}
              onChange={(e) => update({ note: e.currentTarget.value })}
              className={cn(fieldInputClass, "h-auto min-h-[84px] py-3")}
            />
            {errors.note && (
              <FieldNote id="wish-note-note" error>
                {errors.note}
              </FieldNote>
            )}
          </div>

          {lists.length > 1 && (
            <div className="grid gap-1.5">
              <label htmlFor="wish-list" className="text-14 font-semibold">
                Which list?
              </label>
              <SelectField
                id="wish-list"
                value={values.wishlistId}
                onChange={(e) => update({ wishlistId: e.currentTarget.value })}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </SelectField>
            </div>
          )}

          <div className="grid gap-2">
            <span id="wish-image-label" className="text-14 font-semibold">
              Photo (optional)
            </span>
            {preview ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview or a signed URL */}
                <img
                  src={preview}
                  alt="Your photo for this wish"
                  className="size-24 rounded-[16px] object-cover"
                />
                <Button type="button" variant="card2" onClick={removePhoto}>
                  <XIcon aria-hidden /> Remove photo
                </Button>
              </div>
            ) : (
              <label
                htmlFor="wish-image"
                className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-pill bg-card2 px-5 text-15 font-semibold has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-accent"
              >
                <ImagePlusIcon aria-hidden className="size-5" />
                {uploading ? "Adding your photo…" : "Choose a photo"}
                <input
                  ref={fileRef}
                  id="wish-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-describedby="wish-image-note"
                  aria-invalid={errors.imagePath ? true : undefined}
                  onChange={onPickFile}
                  disabled={uploading}
                  className="sr-only"
                />
              </label>
            )}
            <FieldNote id="wish-image-note" error={Boolean(errors.imagePath)}>
              {errors.imagePath ??
                "JPEG, PNG or WebP. I shrink it and remove its location before it's saved."}
            </FieldNote>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-5">
            <p
              aria-live="polite"
              className="min-w-[min(100%,12rem)] flex-1 text-13 font-semibold text-accent-text"
            >
              {message}
            </p>
            <Button type="submit" aria-disabled={pending || uploading || undefined}>
              {pending ? "Saving…" : editing ? "Save" : "Add wish"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
