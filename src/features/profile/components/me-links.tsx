import { ChevronRightIcon, LifeBuoyIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";

/**
 * Phones only: Settings and Help & feedback as rows at the end of My
 * profile (on desktop they're in the account menu on your name).
 */
export function MeLinks() {
  const rows = [
    { href: "/settings", label: "Settings", Icon: SettingsIcon },
    { href: "/help", label: "Help & feedback", Icon: LifeBuoyIcon },
  ];
  return (
    <nav aria-label="More" className="lg:hidden">
      <ul className="flex flex-col overflow-hidden rounded-card-lg bg-card shadow-card">
        {rows.map(({ href, label, Icon }) => (
          <li key={href} className="border-line not-last:border-b">
            <Link href={href} className="flex min-h-14 items-center gap-3.5 hover-tint px-4 py-3">
              <Icon aria-hidden className="size-5 text-accent-text" />
              <span className="flex-1 text-15 font-bold">{label}</span>
              <ChevronRightIcon aria-hidden className="size-5 text-sub" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
