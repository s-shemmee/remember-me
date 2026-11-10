"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

import { emptyPersonForm, PersonDialog } from "./person-dialog";

/**
 * "Add someone" outside the People screen (Home, Calendar): opens the same
 * dialog, then refreshes the page so the new person shows up, and offers a
 * link to their profile.
 */
export function AddPersonButton({ className }: { className?: string }) {
  const router = useRouter();
  const [key, setKey] = React.useState<number | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button ref={buttonRef} onClick={() => setKey(Date.now())} className={className}>
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
            requestAnimationFrame(() => buttonRef.current?.focus());
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
