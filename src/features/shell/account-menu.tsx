"use client";

import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logOut } from "@/features/auth/actions";
import { clearOnboardingDraft } from "@/features/onboarding/store";
import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

export type Account = {
  firstName: string;
  color: Pastel;
  /** A character avatar's emoji, if they picked one. */
  character: string | null;
  peopleCount: number;
};

const peopleLabel = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/**
 * The account chip and its menu (AppPeople.dc.html): My profile, Settings,
 * Help & feedback, Log out. `variant="chip"` is the sidebar chip;
 * `variant="avatar"` is the round button in the mobile top bar.
 */
export function AccountMenu({
  account,
  variant,
}: {
  account: Account;
  variant: "chip" | "avatar";
}) {
  const [pending, startTransition] = useTransition();
  const name = account.firstName || "you";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "chip" ? (
          <button
            type="button"
            className="flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-[16px] bg-card px-3 py-2.5 text-left transition-colors duration-200 ease-soft hover:bg-card2"
          >
            <Avatar
              name={name}
              pastel={account.color}
              character={account.character}
              size="sm"
              decorative
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-14 font-bold">{name}</span>
              <span className="truncate text-12 text-sub">{peopleLabel(account.peopleCount)}</span>
            </span>
            <span className="sr-only">, account menu</span>
            <EllipsisIcon aria-hidden className="size-4 text-sub" />
          </button>
        ) : (
          <button
            type="button"
            className="grid size-11 cursor-pointer place-items-center rounded-pill"
          >
            <Avatar
              name={name}
              pastel={account.color}
              character={account.character}
              size="sm"
              decorative
            />
            <span className="sr-only">Account menu for {name}</span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={variant === "chip" ? "top" : "bottom"}
        align={variant === "chip" ? "start" : "end"}
        className={cn(variant === "chip" && "w-(--radix-dropdown-menu-trigger-width)")}
      >
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <span aria-hidden>👤</span> My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <span aria-hidden>⚙️</span> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help">
            <span aria-hidden>💬</span> Help &amp; feedback
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="accent"
          disabled={pending}
          onSelect={() => {
            clearOnboardingDraft();
            startTransition(() => logOut());
          }}
        >
          <span aria-hidden>↪</span> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
