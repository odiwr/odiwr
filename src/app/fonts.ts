import { Cabin, Courgette } from "next/font/google";
import localFont from "next/font/local";

/**
 * The three faces.
 *
 * All loaded through next/font, which downloads them at build time and serves
 * them from our own origin — no runtime request to Google, no third-party
 * cookie, and no flash while a stylesheet resolves.
 *
 * Each exposes a CSS variable rather than a class, so a component can reach for
 * one by name without the font having to be applied at the element it is
 * needed on.
 *
 * The variable names here are the RAW FACES (--font-courgette), deliberately
 * distinct from the ROLE names globals.css exposes to Tailwind (--font-cursive).
 * next/font sets its variables on <html>, which is the same element as :root, so
 * a role that borrowed its face's name would resolve to itself — a circular
 * declaration, which CSS discards, leaving the text in the fallback face.
 */

/** Body and UI. */
export const cabin = Cabin({
  subsets: ["latin"],
  variable: "--font-cabin",
  display: "swap",
});

/** Cursive accent. One weight is all this family ships. */
export const courgette = Courgette({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-courgette",
  display: "swap",
});

/**
 * Chinese display face.
 *
 * Loaded locally rather than from next/font/google, because the Google loader
 * only offers this family's `latin` subset — Google marks `chinese-simplified`
 * experimental and Next's font data omits it, so asking for it is a type error
 * and the file it produces contains no Chinese glyphs at all. The text would
 * then fall through to whatever CJK font the visitor has, which is exactly what
 * picking this face was meant to avoid.
 *
 * The committed file is a 4KB subset of just the characters used, built by
 * `npm run fonts:subset`. Add a character there and re-run it.
 *
 * `unicode-range` is declared because that is all the file holds: any character
 * outside it is served by the fallback stack instead, and the browser does not
 * download this face for pages that do not use those characters.
 */
export const zcoolXiaoWei = localFont({
  src: "./fonts/zcool-xiaowei-subset.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-zcool-xiaowei",
  display: "swap",
  // MUST match src/app/fonts/ranges.ts, which the subset script generates
  // and then checks this file against. next/font refuses anything but a
  // written-out literal here, so it cannot be imported.
  declarations: [{ prop: "unicode-range", value: "U+4e3a, U+56e0, U+70ed, U+7231" }],
  // The metric-matched fallback Next generates is for Latin text; it has
  // nothing sensible to say about CJK.
  adjustFontFallback: false,
});

/**
 * The @ sign, and nothing else.
 *
 * Cabin's @ is the one glyph in the family worth replacing, and it appears in
 * three places that matter — the role line, the handle, and the email address.
 * Swapping the whole body font over one character would be the wrong trade, so
 * this is a 1KB file holding Inter's @ alone.
 *
 * `unicode-range: U+40` is what makes it safe: the browser reaches for this
 * face for that one codepoint and never for anything else, so it can be put
 * ahead of Cabin in the stack without touching the rest of the text.
 */
export const atSign = localFont({
  src: "./fonts/inter-at-subset.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-at",
  display: "swap",
  // MUST match src/app/fonts/ranges.ts -- see the note above.
  declarations: [{ prop: "unicode-range", value: "U+40" }],
  adjustFontFallback: false,
});

/** Every font variable, for the <html> class. */
export const fontVariables = [
  cabin.variable,
  courgette.variable,
  zcoolXiaoWei.variable,
  atSign.variable,
].join(" ");
