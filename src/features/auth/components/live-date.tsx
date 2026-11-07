"use client";

import { useSyncExternalStore } from "react";

// Today's date in the visitor's own timezone. Rendered only in the browser
// (the server can't know their timezone), so the tile is empty until hydration.
const subscribe = () => () => {};
const getDay = () => new Date().toDateString();

export function LiveDate() {
  const today = useSyncExternalStore(subscribe, getDay, () => null);
  if (!today) return null;

  const date = new Date();
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "long" });

  return (
    <>
      <span className="text-13 font-bold tracking-[.06em] text-accent-text">{weekday}</span>
      <span className="text-[80px] leading-none font-light tracking-[-0.04em]">{day}</span>
      <span className="text-14 font-medium text-sub">{month}</span>
    </>
  );
}
