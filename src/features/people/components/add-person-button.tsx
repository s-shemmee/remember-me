"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { emptyPersonForm, PersonDialog } from "./person-dialog";

/**
 * "Add someone" outside the People screen (Home, Calendar): opens the same
 * dialog, then refreshes the page so the new person shows up, and offers a
 * link to their profile. `compact` (Home's phone and tablet header): a round
 * 44px "+" with a tooltip below 1024px, the labelled button from there up.
 */
export function AddPersonButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = React.useState<number | null>(null);
  // Focus goes back to whichever button opened the dialog.
  const opener = React.useRef<HTMLElement | null>(null);
  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    opener.current = e.currentTarget;
    setKey(Date.now());
  };

  return (
    <>
      {compact && (
        <Tooltip label="Add someone">
          <Button
            size="icon"
            aria-label="Add someone"
            onClick={open}
            className={cn("lg:hidden", className)}
          >
            <PlusIcon aria-hidden className="size-6" />
          </Button>
        </Tooltip>
      )}
      <Button onClick={open} className={cn(compact && "hidden lg:inline-flex", className)}>
        <PlusIcon aria-hidden /> Add someone
      </Button>
      {key !== null && (
        <PersonDialog
          key={key}
          open
          onOpenChange={(open) => !open && setKey(null)}
          initial={emptyPersonForm()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => opener.current?.focus());
          }}
          onDone={(result) => {
            setKey(null);
            router.refresh();
            if (result.kind === "saved") {
              toast.success(`${result.name} added`, {
                action: {
                  label: "Open",
                  onClick: () => router.push(`/people?person=${result.id}`),
                },
              });
            }
          }}
        />
      )}
    </>
  );
}
