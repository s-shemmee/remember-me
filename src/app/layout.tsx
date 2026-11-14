import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Kalam, Plus_Jakarta_Sans } from "next/font/google";

import { SkipLink } from "@/components/ui/skip-link";
import { Toaster } from "@/components/ui/sonner";
import { themeScript } from "@/lib/theme";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: "Remember Me",
  description: "Remember the people you love, and your own day too.",
  applicationName: "Remember Me",
  appleWebApp: { capable: true, title: "Remember Me", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

/** The browser bar follows the page colour in light and dark (the manifest can't). */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e10" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script adds `.dark` and color-scheme before React hydrates.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${instrument.variable} ${kalam.variable} h-full antialiased`}
    >
      <head>
        {/* Sets the theme before first paint: no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* Every page has a <main id="main">. */}
        <SkipLink />
        {/* The service worker: app shell only (src/sw/sw.ts). Never cache pages on
            navigation (personal data), never reload a page with a half-filled form. */}
        <SerwistProvider
          swUrl="/serwist/sw.js"
          cacheOnNavigation={false}
          reloadOnOnline={false}
          disable={process.env.NODE_ENV === "development"}
        >
          {children}
        </SerwistProvider>
        <Toaster />
      </body>
    </html>
  );
}
