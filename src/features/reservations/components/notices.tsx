"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import { dismissNotice } from "../actions";
import type { Notice } from "../logic";

/** Quiet in-app notes ("Khalid removed a wish you'd reserved"), each with OK. */
export function Notices({ notices, className }: { notices: Notice[]; className?: string }) {
  const router = useRouter();
  const [hidden, setHidden] = React.useState<string[]>([]);
  const visible = notices.filter((n) => !hidden.includes(n.id));
  if (!visible.length) return null;

  const dismiss = async (id: string) => {
    setHidden((h) => [...h, id]);
    const result = await dismissNotice(id);
    if (!result.ok) {
      setHidden((h) => h.filter((x) => x !== id));
      toast.error(result.message);
      return;
    }
    router.refresh();
  };

  return (
    <ul aria-label="Notes" className={cn("flex flex-col gap-2", className)}>
      {visible.map((n) => (
        <li
          key={n.id}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[20px] bg-card2 py-1.5 pr-1.5 pl-4 text-14"
        >
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <span aria-hidden>🤫 </span>
            {n.text}
          </span>
          <Button
            variant="transparent"
            className="px-4"
            aria-label={`OK, hide the note: ${n.text}`}
            onClick={() => void dismiss(n.id)}
          >
            OK
          </Button>
        </li>
      ))}
    </ul>
  );
}
