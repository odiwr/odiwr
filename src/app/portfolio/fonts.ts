import { Cormorant_Garamond, Jost } from "next/font/google";

/**
 * portfolio.odiwr.com's two faces, kept out of app/fonts.ts so no other page
 * downloads or preloads them: the subdomain is the only place they appear.
 *
 * A light serif for the title and a geometric sans, spaced out in capitals, for
 * everything else — a photographer's gallery rather than the main site's voice.
 * Same rule as app/fonts.ts: the variables are the raw faces, and portfolio.css
 * maps them onto roles.
 */

/** The title, on the cover and in the viewer. */
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-cormorant",
  display: "swap",
});

/** Labels, tabs, captions. */
export const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jost",
  display: "swap",
});
