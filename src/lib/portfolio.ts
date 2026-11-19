import type { Metadata } from "next";
import { SITE } from "./site";
import type { Portfolio, PortfolioItem } from "./content";

/**
 * portfolio.odiwr.com: what the page is handed, and how its grid is cut.
 *
 * No server imports, so the dashboard's client components can use it too.
 */

/** Where the sets live: the subdomain in production, its rewrite target in development. */
export const PORTFOLIO_BASE =
  process.env.NODE_ENV === "production" ? SITE.portfolioUrl : "/portfolio";

/** A set's address segment. The same rule as slugify in lib/content.ts, which is server-only. */
export function setSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** An item as the page needs it: which file goes where already decided. */
export type ViewItem = {
  id: string;
  kind: "image" | "video";
  /** What the grid shows: a small copy of the picture, or the video's still. Empty for a video with no still. */
  thumb: string;
  /** What the viewer shows: the picture at screen size, or the video itself. */
  full: string;
  width: number;
  height: number;
  duration?: number;
  caption?: string;
  /** Its set's slug. */
  set?: string;
};

export type ViewSet = { name: string; slug: string };

export type ViewPortfolio = {
  title: string;
  subtitle?: string;
  cover?: ViewItem;
  focus: { x: number; y: number };
  /** Only sets something visible is filed under, in their saved order. */
  sets: ViewSet[];
  items: ViewItem[];
};

export function viewItem(item: PortfolioItem): ViewItem {
  const image = item.kind === "image";
  return {
    id: item.id,
    kind: item.kind,
    thumb: image ? (item.thumb ?? item.src) : (item.poster ?? ""),
    full: image ? (item.large ?? item.src) : item.src,
    width: item.width,
    height: item.height,
    duration: item.duration,
    caption: item.caption,
    set: item.set ? setSlug(item.set) : undefined,
  };
}

export function viewPortfolio(portfolio: Portfolio): ViewPortfolio {
  const visible = portfolio.items.filter((i) => !i.hidden);
  const items = visible.map(viewItem);
  const used = new Set(items.map((i) => i.set).filter(Boolean));

  // The chosen cover may be hidden from the grid: a picture can open the page
  // without being repeated in it.
  const chosen = portfolio.items.find((i) => i.id === portfolio.cover);
  const cover = chosen ?? visible.find((i) => i.kind === "image") ?? visible[0];

  return {
    title: portfolio.title,
    subtitle: portfolio.subtitle,
    cover: cover ? viewItem(cover) : undefined,
    focus: portfolio.focus ?? { x: 50, y: 50 },
    sets: portfolio.sets
      .map((name) => ({ name, slug: setSlug(name) }))
      .filter((s) => s.slug && used.has(s.slug)),
    items,
  };
}

/** m:ss, for a video's tile. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The page's description, canonical address and link preview, for the gallery or one set. */
export function portfolioMetadata(view: ViewPortfolio, set?: ViewSet): Metadata {
  const url = set ? `${SITE.portfolioUrl}/${set.slug}` : SITE.portfolioUrl;
  const description = `${set ? `${set.name} — ` : ""}${view.title}${
    view.subtitle ? `. ${view.subtitle}` : ""
  }. Photographs and video by @odiwr.`;
  // The cover's still, as an absolute address: previews ignore relative ones.
  const still = view.cover?.kind === "image" ? view.cover.full : view.cover?.thumb;
  const image = still ? new URL(still, SITE.url).toString() : undefined;

  return {
    description,
    alternates: { canonical: url },
    openGraph: {
      title: SITE.name,
      description,
      url,
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
 * width exactly — the way a Pixieset gallery lays out. A new upload of any
 * shape just slots in; nothing has to be cut to fit.
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
 * Each item's width in every band, as CSS: [item][band]. A row that is filled
 * to the width shares it out by aspect (less the gaps), so the row is one
 * height; a last row with room to spare keeps the target height instead.
 */
export function justify(items: { width: number; height: number }[]): string[][] {
  const aspects = items.map((i) => i.width / i.height);
  const out = items.map(() => new Array<string>(BANDS.length));

  BANDS.forEach((band, b) => {
    for (const { start, end } of rows(aspects, band.at, band.row, band.gap)) {
      const count = end - start;
      let sum = 0;
      for (let i = start; i < end; i++) sum += aspects[i];
      const height = (band.at - (count - 1) * band.gap) / sum;
      const open = end === items.length && height > band.row * STRETCH_LAST;

      for (let i = start; i < end; i++) {
        out[i][b] = open
          ? `${((aspects[i] * band.row * 100) / band.at).toFixed(4)}%`
          : `calc((100% - ${((count - 1) * band.gap + EPSILON).toFixed(1)}px) * ${(aspects[i] / sum).toFixed(6)})`;
      }
    }
  });

  return out;
}

/**
 * The stylesheet that switches bands: the first is the default, the rest
 * apply from their width up. It reads the grid's own width (the `pxs` container),
 * not the window's.
 */
export const BAND_CSS = BANDS.map((band, b) => {
  const rule = `.pxs-grid{gap:${band.gap}px}.pxs-cell{width:var(--w${b})}`;
  return b === 0 ? rule : `@container pxs (min-width:${band.min}px){${rule}}`;
}).join("\n");
