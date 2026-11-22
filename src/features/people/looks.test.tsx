import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PersonCard } from "./components/person-card";
import { looksByPerson } from "./looks";
import type { PersonView } from "./view";

describe("looksByPerson", () => {
  it("only people linked to a connection that has a photo or character", () => {
    const looks = looksByPerson([
      { linkedPersonId: "p1", photoUrl: "https://x/photo.jpg", character: null },
      { linkedPersonId: "p2", photoUrl: null, character: "🦊" },
      { linkedPersonId: null, photoUrl: "https://x/other.jpg", character: null },
      { linkedPersonId: "p3", photoUrl: null, character: null },
    ]);
    expect(looks.get("p1")).toEqual({ photoUrl: "https://x/photo.jpg", character: null });
    expect(looks.get("p2")).toEqual({ photoUrl: null, character: "🦊" });
    expect(looks.has("p3")).toBe(false);
    expect(looks.size).toBe(2);
  });
});

const khalid = (look: PersonView["look"]): PersonView => ({
  id: "p1",
  name: "Khalid",
  relationLabel: "Best friend",
  connected: true,
  inMemory: false,
  color: "rose",
  group: "friends",
  littleThings: [],
  days: [],
  next: null,
  look,
  form: {} as PersonView["form"],
});

describe("a connected person's own look", () => {
  it("their photo on my card; my name for them stays", () => {
    const { container } = render(
      <PersonCard
        person={khalid({ photoUrl: "https://x/photo.jpg", character: null })}
        current={false}
        onSelect={() => {}}
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://x/photo.jpg");
    expect(screen.getByText("Khalid")).toBeInTheDocument();
  });

  it("without a look: my initials and colour", () => {
    const { container } = render(
      <PersonCard person={khalid(null)} current={false} onSelect={() => {}} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("KH");
  });
});
