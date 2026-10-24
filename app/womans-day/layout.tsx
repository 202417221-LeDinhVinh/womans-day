import type { Metadata } from "next";
import { Cormorant_Garamond, Dancing_Script, Gochi_Hand, Space_Mono } from "next/font/google";
import { preload } from "react-dom";

import { WOMANS_DAY_LABEL } from "@/lib/womansDay/flowers";
import { criticalImages } from "@/lib/womansDay/assets";

/**
 * Route-level fonts only: none of these faces belong on any other page.
 *
 * `Cormorant_Garamond` and `Dancing_Script` are variable families, so their weights are
 * deliberately not enumerated (see the deploy note in app/layout.tsx about per-weight
 * gstatic fetches). `Gochi_Hand` is the margin-annotation face and only needs ASCII —
 * names are set in the book serif and the script, both of which carry Vietnamese.
 */

const book = Cormorant_Garamond({
  variable: "--font-book",
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  display: "swap",
});

const hand = Dancing_Script({
  variable: "--font-hand",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const note = Gochi_Hand({
  variable: "--font-note",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const type = Space_Mono({
  variable: "--font-type",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "700"],
  display: "swap",
});

const TITLE = "Women's Day · Ronan SAT Workbook";
const DESCRIPTION =
  "A small Women's Day celebration from Ronan SAT: a bloom that follows your scroll, a flower chosen from your name, a parcel, and a bouquet you can send.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: WOMANS_DAY_LABEL,
    type: "website",
    images: [
      {
        url: "/womans-day/og.jpg",
        width: 1200,
        height: 630,
        alt: "Ronan SAT Women's Day Workbook",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: WOMANS_DAY_LABEL,
    images: ["/womans-day/og.jpg"],
  },
};

export default function WomansDayLayout({ children }: { children: React.ReactNode }) {
  // Emit `<link rel="preload" as="image">` for the above-the-fold art so the first paint
  // does not race the client warm-up. Limited to the critical set (~10 files) so it never
  // competes with the route fonts.
  for (const src of criticalImages(null)) preload(src, { as: "image" });

  return (
    <div className={`${book.variable} ${hand.variable} ${note.variable} ${type.variable}`}>
      {children}
    </div>
  );
}
