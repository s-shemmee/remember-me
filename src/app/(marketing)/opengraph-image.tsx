import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { HEART_PATH, HEART_VIEWBOX, LOGO_RED } from "@/lib/logo-mark";

/**
 * The branded share image (Open Graph and Twitter), made at build time:
 * the logo, the headline with its serif accent, and Noor. Light theme
 * tokens; no emoji (they'd need an extra font).
 */
export const alt = "Remember Me: never forget the people you love, and your own day too.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONTS = path.join(process.cwd(), "src/features/landing/og");

export default async function OpengraphImage() {
  const [jakarta, instrument] = await Promise.all([
    readFile(path.join(FONTS, "plus-jakarta-sans-800.woff")),
    readFile(path.join(FONTS, "instrument-serif-400-italic.woff")),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(150deg, #ffe0ea 0%, #eae3ff 100%)",
        padding: 72,
        fontFamily: "Jakarta",
        color: "#1c1b1f",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: LOGO_RED,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="32" height="32" viewBox={HEART_VIEWBOX}>
              <path
                fill="#ffffff"
                d={HEART_PATH}
              />
            </svg>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: 40 }}>
            Remember
            <span
              style={{ fontFamily: "Instrument", color: "#c2333f", fontSize: 48, marginLeft: 10 }}
            >
              me
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 64,
            fontSize: 76,
            lineHeight: 1.08,
            letterSpacing: "-0.035em",
          }}
        >
          <span>Never forget the</span>
          <span style={{ display: "flex", alignItems: "baseline" }}>
            people you
            <span
              style={{ fontFamily: "Instrument", color: "#c2333f", fontSize: 88, marginLeft: 20 }}
            >
              love
            </span>
          </span>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: "#5f5c66" }}>
          Their days, their wishlists, and your own day too.
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <svg width="210" height="280" viewBox="0 0 60 80">
          <path
            d="M30 3 C37 12 39 18 35 24 C33 27 27 27 25 24 C21 18 23 12 30 3Z"
            fill="#FFB547"
            stroke="#E08A1E"
            strokeWidth="1.2"
          />
          <path
            d="M30 11 C33 15 33.5 19 31.5 22.5 C30.5 24 29.5 24 28.5 22.5 C26.5 19 27 15 30 11Z"
            fill="#FFE08A"
          />
          <rect x="29" y="25" width="2" height="6" rx="1" fill="#5E4500" />
          <rect x="13" y="30" width="34" height="46" rx="13" fill="#FFB8CC" />
          <path d="M13 44 L47 36 L47 42 L13 50Z M13 60 L47 52 L47 58 L13 66Z" fill="#FF97B4" />
          <rect
            x="13"
            y="30"
            width="34"
            height="46"
            rx="13"
            fill="none"
            stroke="#C94F76"
            strokeWidth="2"
          />
          <path
            d="M22 47 Q24 43.5 26 47 M34 47 Q36 43.5 38 47"
            fill="none"
            stroke="#2B2024"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path d="M24 53 Q30 61 36 53Z" fill="#2B2024" />
        </svg>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Jakarta", data: jakarta, weight: 800, style: "normal" },
        { name: "Instrument", data: instrument, weight: 400, style: "italic" },
      ],
    },
  );
}
