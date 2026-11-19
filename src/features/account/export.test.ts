import { describe, expect, it } from "vitest";

import { buildExport, exportFileName } from "./export";

const base = {
  exportedAt: "2026-11-19T10:00:00.000Z",
  email: "c@example.com",
  profile: { first_name: "Maya" },
  reminderSettings: null,
  devices: [],
  people: [],
  wishlists: [],
  wishes: [],
  reserved: [],
};

describe("Download my data", () => {
  it("includes plans with their steps, connections' first names and the sealed note's date only", () => {
    const out = buildExport({
      ...base,
      plans: [
        {
          for: "Khalid",
          occursOn: "2026-12-03",
          note: "Fig cake",
          steps: [
            { label: "Gift", done: true },
            { label: "Call", done: false },
          ],
        },
      ],
      sealedNote: { opensOn: "2027-05-20", writtenAt: "2026-11-19T09:00:00.000Z" },
      connections: [{ firstName: "Amina", connectedAt: "2026-11-10T12:00:00.000Z", yourPerson: "Amina" }],
    });

    expect(out.plans).toEqual([
      {
        for: "Khalid",
        date: "2026-12-03",
        note: "Fig cake",
        steps: [
          { label: "Gift", done: true },
          { label: "Call", done: false },
        ],
      },
    ]);
    expect(out.connections).toEqual([
      { first_name: "Amina", connected_on: "2026-11-10T12:00:00.000Z", in_your_people_as: "Amina" },
    ]);
    expect(Object.keys(out.connections[0]!)).toEqual(["first_name", "connected_on", "in_your_people_as"]);
    expect(out.notes_to_future_you).toEqual([
      { opens_on: "2027-05-20", written_on: "2026-11-19T09:00:00.000Z", note: "Sealed until your birthday." },
    ]);
  });

  it("has every section even when empty", () => {
    const out = buildExport(base);
    expect(out.plans).toEqual([]);
    expect(out.connections).toEqual([]);
    expect(out.notes_to_future_you).toEqual([]);
    expect(exportFileName(base.exportedAt)).toBe("remember-me-data-2026-11-19.json");
  });
});
