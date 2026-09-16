import { getText, putText, r2Configured } from "./r2";

/**
 * The site's content, stored as one JSON document in R2.
 *
 * One document rather than a row per entry: the whole thing is a few kilobytes,
 * it is edited by one person, and a single object means every read is one GET
 * and every save is atomic — no partial writes to reconcile, no migrations.
 *
 * Nothing here is imported by a client component; the dashboard reaches it
 * through server actions.
 */

export type Section = "current" | "projects" | "creative";
export const SECTIONS: Section[] = ["current", "projects", "creative"];

export type Work = {
  id: string;
  section: Section;
  title: string;
  /**
   * The short line, ten words or so. Shown wherever the entry is listed: the
   * landing page columns and the subdomain listings, and used as the entry's
   * meta description.
   */
  blurb?: string;
  /**
   * The long text, for entries that have a page of their own — so in practice
   * CURRENT only. Blank lines separate paragraphs.
   */
  description?: string;
  /**
   * Renders a page at /slug on this site. Only CURRENT work usually gets one —
   * projects point at their repository, creative at wherever it is published.
   */
  slug?: string;
  href?: string;
  /** Simple Icons slugs, most prominent first; that is the order shown. */
  stack?: string[];
  /** Show it in the landing page column. */
  pinned?: boolean;
  /** Creative only: the animated poster for the mosaic. */
  poster?: string;
  /**
   * Creative only: the poster's alt text. Also shown over the poster on hover,
   * with the outward arrow when the entry links somewhere.
   */
  posterAlt?: string;
  /** The clip on the write-up page. May carry audio, so never autoplayed. */
  media?: string;
  /** Custom link-preview image, 1200x630. */
  ogImage?: string;
};

/**
 * A blog entry.
 *
 * There is only ever one live at a time: `post`. Archiving pushes it onto
 * `archive` and clears the slot, so writing the next one is never blocked by
 * deciding what to do with the last.
 */
export type Post = {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  paragraphs: string[];
};

/** Something on wishlist.odiwr.com. */
export type WishItem = {
  id: string;
  title: string;
  href: string;
  category: string;
  /** Pulled from the linked page's own preview tags. */
  image?: string;
  /** A direct image link, shown instead of the pulled one. */
  imageOverride?: string;
  /** The shop's own name for itself ("Best Buy"), when the page declares one. */
  site?: string;
  /** True when `site` was typed in the dashboard rather than pulled. */
  siteCustom?: boolean;
  /**
   * What the pulled image sits on, worked out from its edges
   * (lib/image-background.ts) or set by hand: one colour ("#ffffff"), or a
   * gradient of up to seven points (normalizeBackground in lib/wish.ts).
   * Paints the tile behind it (backgroundStyle in lib/wish.ts). Not used with an
   * override, which is whatever image was chosen by hand.
   */
  imageBg?: string;
  /**
   * True when imageBg was chosen by hand (typed, picked, or eyedropped) rather
   * than worked out. A chosen colour is kept when the link is re-pulled and
   * applies even behind an override image.
   */
  imageBgCustom?: boolean;
  /** How big the picture sits in its tile, in percent: 50 to 150. Absent is 100. */
  imageScale?: number;
  /** In dollars. Shown on the tile, and what the site's price sort uses. */
  price?: number;
  /** True when it has been bought. The site hides these unless asked to show them. */
  purchased?: boolean;
  /** True when it is kept off the site. Absent is shown, so every older item stays up. */
  hidden?: boolean;
};

export type Content = {
  work: Work[];
  /** The one on the site now. */
  post: Post | null;
  /** Everything retired, newest first. */
  archive: Post[];
  wishlist: WishItem[];
  /**
   * Categories in the order they are listed. Kept apart from the items so a
   * category made in the dropdown exists before anything is filed under it.
   */
  wishCategories: string[];
};

export const EMPTY_CONTENT: Content = {
  work: [],
  post: null,
  archive: [],
  wishlist: [],
  wishCategories: [],
};

const KEY = "site/content.json";
/**
 * Short TTL rather than none.
 *
 * Pages are rendered per request; without this, one page load could fetch the
 * document several times. Saves clear it outright, so the dashboard never shows
 * a stale copy of what was just written.
 */
const TTL_MS = 15_000;

let cache: { at: number; data: Content } | null = null;

export function invalidateContent(): void {
  cache = null;
}

function normalise(raw: unknown): Content {
  const doc = (raw ?? {}) as Partial<Content> & { posts?: Post[] };

  const wishlist = Array.isArray(doc.wishlist) ? doc.wishlist : [];
  const wishCategories = Array.isArray(doc.wishCategories) ? doc.wishCategories : [];

  // Documents written before the blog became one-live-post carried a `posts`
  // array. Newest becomes the live one, the rest become the archive.
  if (!doc.post && Array.isArray(doc.posts) && doc.posts.length) {
    const sorted = [...doc.posts].sort((a, b) => b.date.localeCompare(a.date));
    return {
      work: Array.isArray(doc.work) ? doc.work : [],
      post: sorted[0],
      archive: sorted.slice(1),
      wishlist,
      wishCategories,
    };
  }

  return {
    // Before there were two, `description` WAS the short line, so an entry
    // carrying one and no blurb means the old shape: move it across rather than
    // leaving the listing blank and the page showing a one-liner.
    work: (Array.isArray(doc.work) ? doc.work : []).map((w) => {
      const entry =
        w.blurb === undefined && w.description !== undefined
          ? { ...w, blurb: w.description, description: undefined }
          : w;
      // Current work always opens its own page here. An entry saved before
      // that was enforced, with no slug, gets its title's.
      return entry.section === "current" && !entry.slug && entry.title
        ? { ...entry, slug: slugify(entry.title) }
        : entry;
    }),
    post: doc.post ?? null,
    archive: Array.isArray(doc.archive) ? doc.archive : [],
    wishlist,
    wishCategories,
  };
}

/**
 * Where content lives on a dev server that has no R2 keys.
 *
 * Without this the dashboard can be signed into locally but every save fails,
 * so nothing in it can be tried. A file in the project, gitignored, is enough
 * for one person testing. Production never uses it: there, missing keys are an
 * error on save, as they should be.
 */
const LOCAL_FILE = ".local/content.json";

function storesLocally(): boolean {
  return process.env.NODE_ENV === "development" && !r2Configured();
}

async function readLocal(): Promise<string | null> {
  const { readFile } = await import("node:fs/promises");
  return readFile(LOCAL_FILE, "utf8").catch(() => null);
}

async function writeLocal(body: string): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(LOCAL_FILE), { recursive: true });
  await writeFile(LOCAL_FILE, body);
}

async function readContent(): Promise<Content> {
  if (!r2Configured() && !storesLocally()) return EMPTY_CONTENT;

  const body = storesLocally() ? await readLocal() : await getText(KEY);
  // No document yet is the normal state of a new bucket, not an error.
  let data = EMPTY_CONTENT;
  if (body) {
    try {
      data = normalise(JSON.parse(body));
    } catch {
      // Corrupt document: serve nothing rather than crashing the site. The
      // dashboard will overwrite it on the next save.
      data = EMPTY_CONTENT;
    }
  }

  cache = { at: Date.now(), data };
  return data;
}

export async function getContent(): Promise<Content> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  return readContent();
}

/**
 * The document as it is in the bucket right now, never the cache.
 *
 * Every save rewrites the WHOLE document, so it has to start from the latest
 * copy. The cache is per server instance: on a host running several, a save
 * built from one instance's fifteen-second-old copy quietly undoes whatever
 * another instance wrote in that window — which is how adding a project used to
 * put pins back the way they were.
 */
export async function getFreshContent(): Promise<Content> {
  return readContent();
}

export async function saveContent(next: Content): Promise<void> {
  const body = JSON.stringify(next, null, 2);
  if (storesLocally()) {
    await writeLocal(body);
  } else if (!r2Configured()) {
    // The storage SDK's own message for this ("No value provided for input HTTP
    // label: Bucket") says nothing about what to fix.
    throw new Error(
      "Storage is not configured. Set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY."
    );
  } else {
    await putText(KEY, body, "application/json");
  }
  cache = { at: Date.now(), data: next };
}

/* ------------------------------------------------------------------ */
/* Derived views                                                       */
/* ------------------------------------------------------------------ */

export function sectionWork(content: Content, section: Section): Work[] {
  return content.work.filter((w) => w.section === section);
}

/** Everything that renders a page here, for routing and the sitemap. */
export function slugWork(content: Content): Work[] {
  return content.work.filter((w) => w.slug);
}

export function findWork(content: Content, slug: string): Work | undefined {
  return content.work.find((w) => w.slug === slug);
}

/** The live post first, then the archive. What the feed lists. */
export function allPosts(content: Content): Post[] {
  return [...(content.post ? [content.post] : []), ...content.archive];
}

/**
 * The wishlist grouped by category, in the saved category order.
 *
 * A category an item names but the list does not (hand-edited document, say)
 * still gets a group, at the end, rather than its items vanishing.
 */
export function wishGroups(content: Content): { category: string; items: WishItem[] }[] {
  const order = [...content.wishCategories];
  for (const item of content.wishlist) if (!order.includes(item.category)) order.push(item.category);
  return order.map((category) => ({
    category,
    items: content.wishlist.filter((i) => i.category === category),
  }));
}

/** Where an entry points, whether it lives here or somewhere else. */
export function workHref(item: Pick<Work, "slug" | "href">): string {
  return item.slug ? `/${item.slug}` : (item.href ?? "#");
}

/** Off-site entries open in a new tab; write-ups hosted here do not. */
export function isExternal(item: Pick<Work, "slug" | "href">): boolean {
  return !item.slug && !!item.href;
}

/** m.dd.yyyy, the form the landing page uses. */
export function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}.${d}.${y}`;
}

/** Short, URL-safe, and stable enough for a single-author site. */
export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
