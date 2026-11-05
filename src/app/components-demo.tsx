"use client";

import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, FilterChip } from "@/components/ui/chip";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Noor } from "@/components/ui/noor";
import { NoorBubble } from "@/components/ui/noor-bubble";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import {
  segmentedOptionClass,
  segmentedTrackClass,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { setThemeChoice, themeChoices, type ThemeChoice } from "@/lib/theme";
import { useThemeChoice } from "@/lib/use-theme";

// Temporary component check for M0, next to the token panels. Replaced in M6.

const themeLabels: Record<ThemeChoice, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const filters = ["All", "Family", "Friends", "This month"];

export function ComponentsDemo() {
  const theme = useThemeChoice();
  const [filter, setFilter] = useState("All");
  const [password, setPassword] = useState("");
  const tooShort = password.length > 0 && password.length < 8;

  return (
    <section aria-labelledby="components-heading" className="mt-12 grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id="components-heading" className="text-34 font-extrabold tracking-heading">
            Components
          </h2>
          <p className="mt-1 text-15 text-sub">
            The building blocks in <code>src/components/ui</code>. Switch the theme to check both.
          </p>
        </div>
        {/* A choice, not tabs (there are no panels): a group of pressed-state buttons. */}
        <div role="group" aria-label="Theme" className={segmentedTrackClass}>
          {themeChoices.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={theme === choice}
              onClick={() => setThemeChoice(choice)}
              className={segmentedOptionClass}
            >
              {themeLabels[choice]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="grid content-start gap-4">
          <h3 className="text-19 font-extrabold tracking-heading">Buttons</h3>
          <div className="flex flex-wrap gap-3">
            <Button size="lg">Start remembering</Button>
            <Button variant="card2">See how it works</Button>
            <Button variant="transparent">Skip for now</Button>
            <Button variant="card2" size="icon" aria-label="Settings">
              <SettingsIcon aria-hidden />
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>

        <Card className="grid content-start gap-4">
          <h3 className="text-19 font-extrabold tracking-heading">Chips and avatars</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name="Khalid" pastel="peach" />
            <Avatar name="Grandma Fatima" pastel="lilac" />
            <Avatar name="Yasmine" pastel="mint" />
            <Avatar name="Omar" pastel="sky" size="sm" />
            <Chip pastel="peach">in 2 days</Chip>
            <Chip pastel="rose" size="sm">
              tomorrow
            </Chip>
          </div>
          <div role="group" aria-label="Filter people" className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <FilterChip key={f} selected={filter === f} onClick={() => setFilter(f)}>
                {f}
              </FilterChip>
            ))}
          </div>
        </Card>

        <Card className="grid content-start gap-4">
          <h3 className="text-19 font-extrabold tracking-heading">Fields</h3>
          <Field
            label="Email"
            type="email"
            placeholder="you@example.com"
            helper="We'll never share it."
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helper="8 characters or more"
            error={tooShort ? "Use 8 characters or more" : undefined}
          />
        </Card>

        <Card className="grid content-start gap-4">
          <h3 className="text-19 font-extrabold tracking-heading">Switches</h3>
          <SwitchRow id="email" label="By email" defaultChecked />
          <SwitchRow id="push" label="Notifications on this device" />
          <SwitchRow id="requests" label="Connection requests" defaultChecked />
        </Card>

        <Card className="grid content-start gap-4">
          <h3 className="text-19 font-extrabold tracking-heading">Tabs</h3>
          <Tabs defaultValue="mine">
            <TabsList aria-label="Wishlists">
              <TabsTrigger value="mine">My wishlists</TabsTrigger>
              <TabsTrigger value="friends">Friends&apos; wishlists</TabsTrigger>
            </TabsList>
            <TabsContent value="mine" className="text-15 text-sub">
              Your wishes live here.
            </TabsContent>
            <TabsContent value="friends" className="text-15 text-sub">
              Wishes your people shared with you.
            </TabsContent>
          </Tabs>
        </Card>

        <Card className="grid content-start gap-4">
          <h3 className="text-19 font-extrabold tracking-heading">Dialog, menu and toast</h3>
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="card2">Remove Omar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove Omar?</DialogTitle>
                  <DialogDescription>His days and wishlist notes go too.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="card2">Keep Omar</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      onClick={() =>
                        toast("Omar removed", {
                          action: { label: "Undo", onClick: () => toast("Omar is back") },
                        })
                      }
                    >
                      Remove
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="card2" className="pl-2">
                  <Avatar name="Sara" pastel="butter" size="sm" decorative />
                  Sara
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <UserIcon aria-hidden /> My profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <SettingsIcon aria-hidden /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="accent">
                  <LogOutIcon aria-hidden /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="card2" onClick={() => toast.success("Saved")}>
              Show a toast
            </Button>
          </div>
        </Card>
      </div>

      <Card className="flex flex-wrap items-end gap-8">
        <NoorBubble live animated>
          Khalid turns 30 in 2 days 🎂 The football on his wishlist is still free. Want me to
          reserve it for you?
        </NoorBubble>
        <div className="flex items-end gap-4">
          <Noor size={40} />
          <Noor size={58} />
          <Noor size={96} label="Noor, the candle assistant" />
        </div>
      </Card>
    </section>
  );
}

function SwitchRow({
  id,
  label,
  defaultChecked,
}: {
  id: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <label htmlFor={id} className="text-15 font-semibold">
        {label}
      </label>
      <Switch id={id} defaultChecked={defaultChecked} />
    </div>
  );
}
