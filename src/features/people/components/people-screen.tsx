"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import { NoorBubble } from "@/components/ui/noor-bubble";
import { toast } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import { restorePerson } from "../actions";
import { type FilterKey, FILTERS } from "../constants";
import type { PersonFormValues } from "../schema";
import { filterPeople, type PersonView } from "../view";
import { PersonCard } from "./person-card";
import { emptyPersonForm, PersonDialog, type PersonDialogResult } from "./person-dialog";
import { PersonPanel } from "./person-panel";

/** Below this width the profile replaces the grid instead of sitting next to it. */
const WIDE = "(min-width: 1280px)";

const countLabel = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/**
 * The People screen (AppPeople.dc.html): search, filters, the grid of cards
 * and the open person's profile. The open person lives in the URL
 * (?person=id), so refresh and the back button work. Search and filters
 * run in the browser on the list the server sent.
 */
export function PeopleScreen({ people }: { people: PersonView[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("person");

  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [dialog, setDialog] = React.useState<{ key: number; initial: PersonFormValues } | null>(
    null,
  );
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const focusPanel = React.useRef(false);
  const focusCard = React.useRef<string | null>(null);
  // The dialog has no Radix trigger, so we return focus ourselves.
  const opener = React.useRef<HTMLElement | null>(null);
  const returnFocus = React.useRef<() => HTMLElement | null | undefined>(() => null);

  const shown = filterPeople(people, filter, query);
  const selected = selectedId ? people.find((p) => p.id === selectedId) : undefined;
  // On wide screens someone is always open: the chosen person, else the first shown.
  const panelPerson = selected ?? shown[0] ?? people[0];

  const select = (id: string | null) => {
    const url = id ? `?person=${id}` : window.location.pathname;
    window.history.pushState(null, "", url);
  };

  // After choosing someone on a narrow screen, move focus to their profile.
  React.useEffect(() => {
    if (focusPanel.current && selected) {
      focusPanel.current = false;
      headingRef.current?.focus();
    }
    // Back to the list: focus the card of the person you were looking at.
    if (focusCard.current && !selected) {
      document.querySelector<HTMLElement>(`[data-person-id="${focusCard.current}"]`)?.focus();
      focusCard.current = null;
    }
  }, [selected, people]);

  const onCardClick = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    focusPanel.current = !window.matchMedia(WIDE).matches;
    select(id);
  };

  const backToList = () => {
    focusCard.current = selected?.id ?? null;
    select(null);
  };

  const open = (initial: PersonFormValues) => {
    opener.current = document.activeElement as HTMLElement | null;
    setDialog({ key: Date.now(), initial });
  };
  const openAdd = () => open(emptyPersonForm());
  const openEdit = (person: PersonView) => open(person.form);
  /** Close, then focus `focus()` (or the page title) once Radix has let go. */
  const closeDialog = (focus: () => HTMLElement | null | undefined) => {
    returnFocus.current = focus;
    setDialog(null);
  };

  // Change the URL first, then refresh: a pushState while a refresh is in
  // flight makes Next fall back to a full page load.
  const onDone = (result: PersonDialogResult) => {
    if (result.kind === "saved") {
      // Their profile opens; focus goes to its heading once it's there.
      focusPanel.current = true;
      closeDialog(() => (selected?.id === result.id ? headingRef.current : null));
      select(result.id);
      router.refresh();
      toast.success(result.added ? `${result.name} added` : `${result.name} saved`);
      return;
    }
    // Removed: archived, so Undo can bring them back (at least 6 seconds).
    closeDialog(() => null);
    select(null);
    router.refresh();
    toast(`${result.name} removed`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const undone = await restorePerson(result.id);
          if (undone.ok) {
            select(result.id);
            router.refresh();
            toast.success(`${result.name} is back`);
          } else {
            toast.error(undone.message);
          }
        },
      },
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
          <h1
            ref={titleRef}
            tabIndex={-1}
            className="text-34 leading-tight font-extrabold tracking-[-0.03em] outline-none"
          >
            People
          </h1>
          <p className="text-15 text-sub">{countLabel(people.length)}</p>
        </div>
        {people.length > 0 && (
          <div className="relative min-w-0 flex-[1_1_220px] sm:max-w-[280px]">
            <label htmlFor="people-search" className="sr-only">
              Search people
            </label>
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-sub"
            />
            <input
              id="people-search"
              type="search"
              placeholder="Search people…"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              className="min-h-11 w-full rounded-pill border-[1.5px] border-line bg-card pr-4 pl-11 text-15 text-text placeholder:text-sub focus:border-accent focus:outline-none"
            />
          </div>
        )}
        <ThemeToggle />
        <Button onClick={openAdd}>
          <PlusIcon aria-hidden /> Add someone
        </Button>
      </div>

      {people.length === 0 ? (
        <div className="flex max-w-xl flex-col gap-5 rounded-card-lg bg-card p-6 shadow-card sm:p-8">
          <NoorBubble className="[&_p]:bg-card2 [&_p]:shadow-none">
            Add the first person you&apos;d hate to forget 💛
          </NoorBubble>
          <Button onClick={openAdd} className="w-fit">
            <PlusIcon aria-hidden /> Add someone
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          <section
            aria-label="Your people"
            className={selected ? "@container hidden xl:block" : "@container"}
          >
            <div className="flex flex-col gap-4">
              <div role="group" aria-label="Filter people" className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <FilterChip
                    key={f.key}
                    selected={filter === f.key}
                    onClick={() => setFilter(f.key)}
                    className={filter === f.key ? undefined : "bg-card"}
                  >
                    {f.label}
                  </FilterChip>
                ))}
              </div>
              <p aria-live="polite" className="sr-only">
                {query || filter !== "all" ? `${countLabel(shown.length)} shown` : ""}
              </p>
              {shown.length ? (
                <ul className="grid grid-cols-1 gap-3.5 @[30rem]:grid-cols-2 @[44rem]:grid-cols-3">
                  {shown.map((p) => (
                    <li key={p.id} className="min-w-0">
                      <PersonCard
                        person={p}
                        current={
                          p.id === selected?.id
                            ? "page"
                            : !selected && p.id === panelPerson?.id
                              ? "implicit"
                              : false
                        }
                        onSelect={onCardClick(p.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-[22px] bg-card2 p-6 text-center text-15 text-sub">
                  No one here yet. Try another filter, or add someone.
                </p>
              )}
            </div>
          </section>

          {panelPerson && (
            <PersonPanel
              key={panelPerson.id}
              person={panelPerson}
              headingRef={headingRef}
              onBack={backToList}
              onEdit={() => openEdit(panelPerson)}
              className={selected ? undefined : "hidden xl:flex"}
            />
          )}
        </div>
      )}

      {dialog && (
        <PersonDialog
          key={dialog.key}
          open
          onOpenChange={(isOpen) => !isOpen && closeDialog(() => opener.current)}
          initial={dialog.initial}
          onDone={onDone}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => (returnFocus.current() ?? titleRef.current)?.focus());
          }}
        />
      )}
    </>
  );
}
