import type { Metadata } from "next";
import { Instrument_Serif, Kalam, Plus_Jakarta_Sans } from "next/font/google";
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
        <a
          href="#main"
          className="sr-only z-50 rounded-pill bg-card px-5 font-semibold shadow-card focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:inline-flex focus:min-h-11 focus:items-center"
        >
          Skip to content
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
