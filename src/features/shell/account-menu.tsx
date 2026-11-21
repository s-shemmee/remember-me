"use client";

import { EllipsisIcon, LifeBuoyIcon, SettingsIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogOut } from "@/features/auth/components/use-log-out";
import { cn } from "@/lib/utils";
import type { Pastel } from "@/styles/tokens";

export type Account = {
  firstName: string;
  color: Pastel;
  /** A character avatar's emoji, if they picked one. */
  character: string | null;
  /** A signed URL for their profile photo, if they use one. */
  photoUrl?: string | null;
  peopleCount: number;
};

const peopleLabel = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/**
 * The account chip and its menu (AppPeople.dc.html): My profile, Settings,
 * Help & feedback, then Log out as plain text. The only way to Settings (the
 * sidebar has no link). No theme control here: that's in each page header. `variant="chip"` is the sidebar chip;
 * `variant="avatar"` is the round button in the mobile top bar.
 */
export function AccountMenu({
  account,
  variant,
}: {
  account: Account;
  variant: "chip" | "avatar";
}) {
  const { pending, logOutNow } = useLogOut();
  const name = account.firstName || "you";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "chip" ? (
          <button
            type="button"
            className="flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-[16px] bg-card hover-tint px-3 py-2.5 text-left transition-colors duration-200 ease-soft"
          >
            <Avatar
              name={name}
              pastel={account.color}
              src={account.photoUrl ?? null}
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
            className="grid size-11 cursor-pointer place-items-center rounded-pill hover-tint"
          >
            <Avatar
              name={name}
              pastel={account.color}
              src={account.photoUrl ?? null}
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
            <UserRoundIcon aria-hidden className="size-5" /> My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon aria-hidden className="size-5" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help">
            <LifeBuoyIcon aria-hidden className="size-5" /> Help &amp; feedback
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onSelect={logOutNow}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
