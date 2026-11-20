import type { Metadata } from "next";
import { SITE } from "./site";
import type { Portfolio, PortfolioItem } from "./content";

/**
 * portfolio.odiwr.com: what the page is handed, and how its grid is cut.
 *
 * No server imports, so the dashboard's client components can use it too.
 */

/** An item as the page needs it: which file goes where already decided. */
export type ViewItem = {
  id: string;
  kind: "image" | "video";
  /** The grid's still: a small copy of the picture, or the video's still. Empty for a video with no still. */
  thumb: string;
  /** Video only: what its tile plays, muted and looping. */
  loop?: string;
  /** What the viewer shows: the picture at screen size, or the video itself. */
  full: string;
  width: number;
  height: number;
  alt?: string;
};

export function viewItem(item: PortfolioItem): ViewItem {
  const image = item.kind === "image";
  return {
    id: item.id,
    kind: item.kind,
    thumb: image ? (item.thumb ?? item.src) : (item.poster ?? ""),
    loop: image ? undefined : (item.loop ?? item.src),
    full: image ? (item.large ?? item.src) : item.src,
    width: item.width,
    height: item.height,
    alt: item.alt,
  };
}

/** What the site shows: everything not hidden. */
export function publicItems(portfolio: Portfolio): ViewItem[] {
  return portfolio.items.filter((i) => !i.hidden).map(viewItem);
}

/** A fresh order, every time it is asked. Fisher–Yates, so every order is as likely. */
export function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The page's description, canonical address and link preview. */
export function portfolioMetadata(items: ViewItem[]): Metadata {
  const description = "Photographs and video by @odiwr.";
  // The newest picture, as an absolute address: previews ignore relative ones.
  const first = items.find((i) => i.kind === "image") ?? items[0];
  const still = first?.kind === "image" ? first.full : first?.thumb;
  const image = still ? new URL(still, SITE.url).toString() : undefined;

  return {
    title: "Portfolio",
    description,
    alternates: { canonical: SITE.portfolioUrl },
    openGraph: {
      title: SITE.name,
      description,
      url: SITE.portfolioUrl,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    ...(image ? { twitter: { card: "summary_large_image", images: [image] } } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* The grid                                                            */
/* ------------------------------------------------------------------ */

/**
 * Justified rows: every item at its own shape, uncropped, each row filling the
 * width exactly. A new upload of any shape just slots in; nothing has to be cut
 * to fit, and a shuffled order fits as well as any other.
 *
 * Where the rows break depends on how wide the grid is, and that is only known
 * in the browser. Rather than measure it there (the grid would jump once the
 * script ran), the rows are cut ahead of time for a range of widths — the
 * BANDS — and the grid picks its band with a container query. Each item carries
 * its width for every band as a custom property (--w0, --w1, …), as a share of
 * the row, so within a band the rows simply scale with the page. No script
 * measures anything; the server's HTML is already the final layout.
 *
 * Which row an item lands in is decided by those widths alone: a row's items
 * add up to the whole width, so the next item has nowhere to go but the next
 * line. Each row gives up EPSILON of a pixel so rounding can never push its
 * last item down.
 *
 * Each item also carries its row number in every band (--r0, --r1, …), which
 * is what staggers the entrance: rows drop in top to bottom, the way the home
 * page's blocks do, whatever the width.
 */

export type Band = {
  /** The grid's width from which this band applies, in CSS pixels. */
  min: number;
  /** The width the rows are cut for: about the middle of the band. */
  at: number;
  /** The height a row aims for at that width. */
  row: number;
  /** Space between items, across and down. */
  gap: number;
};

export const BANDS: Band[] = [
  { min: 0, at: 380, row: 130, gap: 4 },
  { min: 440, at: 500, row: 160, gap: 4 },
  { min: 580, at: 640, row: 190, gap: 6 },
  { min: 720, at: 800, row: 220, gap: 6 },
  { min: 880, at: 960, row: 250, gap: 8 },
  { min: 1060, at: 1160, row: 280, gap: 8 },
  { min: 1280, at: 1400, row: 310, gap: 10 },
  { min: 1540, at: 1680, row: 330, gap: 10 },
  { min: 1840, at: 2040, row: 350, gap: 12 },
  { min: 2280, at: 2560, row: 380, gap: 12 },
];

/** A row can be this much shorter than its target before items stop being added to it. */
const SHORTEST = 0.5;
/** The last row is filled out to the width only if that makes it at most this much taller. */
const STRETCH_LAST = 1.25;
const MOST_PER_ROW = 14;
const EPSILON = 0.5;
/** Rows after this one enter with it: the ones below are off screen by then anyway. */
const LAST_STAGGER = 7;

/**
 * Where the rows break, for one width: the best set of breaks over the whole
 * list rather than the first that fits, so one awkward item does not leave a
 * row half empty and the next one squashed.
 *
 * Every possible row is scored by how far its height is from the target
 * (squared, relative), and the breaks with the lowest total win. The last row
 * scores nothing while it has room to spare: it is left at the target height,
 * short of the right edge, as a gallery's last row always is.
 */
function rows(aspects: number[], width: number, target: number, gap: number) {
  const n = aspects.length;
  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(0);
  best[0] = 0;

  for (let end = 1; end <= n; end++) {
    let sum = 0;
    for (let start = end - 1; start >= 0 && end - start <= MOST_PER_ROW; start--) {
      sum += aspects[start];
      const count = end - start;
      const height = (width - (count - 1) * gap) / sum;
      const cost = end === n && height >= target ? 0 : ((height - target) / target) ** 2;
      if (best[start] + cost < best[end]) {
        best[end] = best[start] + cost;
        from[end] = start;
      }
      // Every item added from here only makes the row shorter still.
      if (count > 1 && height < target * SHORTEST) break;
    }
  }

  const out: { start: number; end: number }[] = [];
  for (let end = n; end > 0; end = from[end]) out.unshift({ start: from[end], end });
  return out;
}

/**
 * Each item's custom properties: its width in every band, as CSS, and its row
 * there. A row that is filled to the width shares it out by aspect (less the
 * gaps), so the row is one height; a last row with room to spare keeps the
 * target height instead.
 */
export function justify(items: { width: number; height: number }[]): Record<string, string>[] {
  const aspects = items.map((i) => i.width / i.height);
  const out = items.map(() => ({}) as Record<string, string>);

  BANDS.forEach((band, b) => {
    rows(aspects, band.at, band.row, band.gap).forEach(({ start, end }, r) => {
      const count = end - start;
      let sum = 0;
      for (let i = start; i < end; i++) sum += aspects[i];
      const height = (band.at - (count - 1) * band.gap) / sum;
      const open = end === items.length && height > band.row * STRETCH_LAST;

      for (let i = start; i < end; i++) {
        out[i][`--w${b}`] = open
          ? `${((aspects[i] * band.row * 100) / band.at).toFixed(4)}%`
          : `calc((100% - ${((count - 1) * band.gap + EPSILON).toFixed(1)}px) * ${(aspects[i] / sum).toFixed(6)})`;
        out[i][`--r${b}`] = String(Math.min(r, LAST_STAGGER));
      }
    });
  });

  return out;
}

/**
 * The stylesheet that switches bands: the first is the default, the rest
 * apply from their width up. It reads the grid's own width (the `pxs` container),
 * not the window's. A row enters 60ms after the one above it, the same step as
 * the home page's blocks (.enter in globals.css).
 */
export const BAND_CSS = BANDS.map((band, b) => {
  const rule = `.pxs-grid{gap:${band.gap}px}.pxs-cell{width:var(--w${b});animation-delay:calc(40ms + var(--r${b}) * 60ms)}`;
  return b === 0 ? rule : `@container pxs (min-width:${band.min}px){${rule}}`;
}).join("\n");
