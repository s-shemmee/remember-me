"use client";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Dropdown menu matching the account menu in the approved screens:
 * card panel, radius 20, padding 8, popover shadow; 44px items, radius 14,
 * sub text, card2 when highlighted. `variant="accent"` is for "Log out".
 * Trimmed to the parts we use; add more from shadcn when a screen needs them.
 */
/**
 * Non-modal by default (WAI-ARIA menu button pattern). Radix's modal mode
 * aria-hides the rest of the page while it stays focusable, which axe flags
 * (aria-hidden-focus). Esc, outside click and Tab still close the menu.
 */
function DropdownMenu({
  modal = false,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" modal={modal} {...props} />;
}

function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 flex max-h-(--radix-dropdown-menu-content-available-height) min-w-56 flex-col gap-0.5 overflow-y-auto",
          "rounded-popover bg-card p-2 text-text shadow-popover",
          "origin-(--radix-dropdown-menu-content-transform-origin) data-open:animate-up data-closed:animate-fade-out",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup(props: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  variant?: "default" | "accent";
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-item px-3.5 text-15 font-semibold text-sub select-none",
        "transition-colors duration-200 ease-soft",
        "outline-none data-highlighted:bg-card2 data-highlighted:text-text",
        "focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent",
        "data-[variant=accent]:text-accent-text data-[variant=accent]:data-highlighted:text-accent-text",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn("px-3.5 pt-2 pb-1 text-13 font-bold text-sub", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("mx-2 my-1 h-px bg-line", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
