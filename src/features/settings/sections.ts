import {
  BellRingIcon,
  type LucideIcon,
  PaletteIcon,
  ShieldIcon,
  SmartphoneIcon,
  UserRoundCogIcon,
} from "lucide-react";

/**
 * The five Settings sections, in order: a page each at /settings/<slug>.
 * Desktop shows them as a pill tab bar; phones as a grouped list at
 * /settings, each opening its own page with a back button.
 */
export const SETTINGS_SECTIONS = [
  {
    slug: "reminders",
    title: "Reminders",
    subtitle: "When I remind you, and how",
    Icon: BellRingIcon,
  },
  {
    slug: "notifications",
    title: "Notifications",
    subtitle: "Push on this device and your others",
    Icon: SmartphoneIcon,
  },
  {
    slug: "privacy",
    title: "Privacy",
    subtitle: "Who sees your birthday, and your data",
    Icon: ShieldIcon,
  },
  {
    slug: "appearance",
    title: "Appearance",
    subtitle: "Light, dark or system",
    Icon: PaletteIcon,
  },
  {
    slug: "account",
    title: "Account",
    subtitle: "Email, password, log out",
    Icon: UserRoundCogIcon,
  },
] as const satisfies readonly {
  slug: string;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
}[];

export type SettingsSlug = (typeof SETTINGS_SECTIONS)[number]["slug"];

/** The section for a path like /settings/privacy, or null for /settings itself. */
export function sectionFor(pathname: string) {
  const slug = /^\/settings\/([a-z]+)\/?$/.exec(pathname)?.[1];
  return SETTINGS_SECTIONS.find((s) => s.slug === slug) ?? null;
}
