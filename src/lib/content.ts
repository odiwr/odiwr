import { getText, putText, r2Configured, storageErrorName } from "./r2";

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

/**
 * One slide of a post: an uploaded clip, what the grid plays for it, and its
 * shape. A post's own video, poster, cover and size are its first slide; the
 * rest are in `slides`.
 */
export type Slide = {
  video?: string;
  poster?: string;
  cover?: string;
  width?: number;
  height?: number;
};

/**
 * A post on cinema.odiwr.com: one or more clips, with its own page at /slug there.
 *
 * Either an uploaded video in the bucket, or an embed of where the clip is
 * officially published (YouTube, TikTok, Instagram, Vimeo — see lib/cinema.ts).
 * An upload wins when both are set; the embed is then only credited as the
 * source.
 */
export type Clip = {
  id: string;
  /**
   * Unique among clips. The post's address: cinema.odiwr.com/slug. Generated
   * from the name and date (autoClipSlug) unless one was typed.
   */
  slug: string;
  title: string;
  /** The movie or show it is from, by name only ("Beef", never an episode). */
  show?: string;
  /** The words under the clip. Blank lines separate paragraphs. */
  caption?: string;
  /** Public URL of an uploaded mp4 or webm. */
  video?: string;
  /**
   * The grid tile. A still captured from the video on upload, or anything set
   * by hand — a GIF, or a looping MP4/WebM, which the grid plays muted.
   */
  poster?: string;
  /**
   * The grid's moving cover: a muted loop of at most four seconds, recorded
   * from the clip in the browser on upload (ClipUploader). Wins over the poster
   * on the grid; the poster stays the still for link previews and the player.
   */
  cover?: string;
  /** A link to the clip where it is officially posted. */
  embed?: string;
  /** Pixel size of the video, so its tile and player hold the right shape before it loads. */
  width?: number;
  height?: number;
  /** ISO date, YYYY-MM-DD. The grid is newest first. */
  date: string;
  /** True when it is kept off the site. Absent is shown. */
  hidden?: boolean;
  /** Every slide after the first, in order. The viewer's dots step through them all. */
  slides?: Slide[];
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
  clips: Clip[];
};

export const EMPTY_CONTENT: Content = {
  work: [],
  post: null,
  archive: [],
  wishlist: [],
  wishCategories: [],
  clips: [],
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
  const clips = Array.isArray(doc.clips) ? doc.clips : [];

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
      clips,
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
    clips,
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

/**
 * The document, through the short cache.
 *
 * If storage cannot be read, a copy this server already has is served rather
 * than nothing. With no copy the error is thrown: a page that cannot get its
 * content fails, rather than rendering as if there were none. That matters most
 * for pages built ahead of time — a failed rebuild keeps the last good page up,
 * where an "empty" one would replace it.
 */
export async function getContent(): Promise<Content> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    return await readContent();
  } catch (error) {
    if (cache) {
      console.error("Content read failed; serving the last copy read.", error);
      return cache.data;
    }
    throw error;
  }
}

/**
 * Null when the document can be read, else the name of the failure. The
 * dashboard checks this first, so a broken key says so instead of every page
 * looking empty.
 */
export async function contentError(): Promise<string | null> {
  try {
    await readContent();
    return null;
  } catch (error) {
    return storageErrorName(error);
  }
}

/**
 * The document as it is in the bucket right now, never the cache. Throws when
 * it cannot be read, so a save can never start from a failed read and write
 * nothing over everything.
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

/** Clips newest first, the order the grid shows them. Ties keep the order they were added, latest first. */
export function sortedClips(content: Content): Clip[] {
  return content.clips
    .map((clip, i) => ({ clip, i }))
    .sort((a, b) => b.clip.date.localeCompare(a.clip.date) || b.i - a.i)
    .map(({ clip }) => clip);
}

/** The clips on the site: newest first, hidden ones left out. */
export function publicClips(content: Content): Clip[] {
  return sortedClips(content).filter((c) => !c.hidden);
}

/**
 * The short code a name contributes to a slug: the initials of a name of several
 * words ("The Dark Knight" -> "tdk"), or a single word whole ("Beef" -> "beef"),
 * up to twelve letters.
 */
function nameCode(name: string): string {
  const words = slugify(name).split("-").filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]).join("").slice(0, 6);
  return (words[0] ?? "clip").slice(0, 12);
}

/** What every generated slug looks like: code-yymmdd-nn. */
const AUTO_SLUG = /^[a-z0-9]+-\d{6}-\d{2,}$/;

export function isAutoClipSlug(slug: string): boolean {
  return AUTO_SLUG.test(slug);
}

/**
 * A slug made from what the clip is: the name's code, the post's date, and a
 * running number for that name on that day. "Pulp Fiction" on 2026-09-22 is
 * pf-260922-01; a second one that day, pf-260922-02.
 *
 * A clip whose slug already has the right code and date keeps it, so saving a
 * post again never renumbers it.
 */
export function autoClipSlug(
  content: Content,
  name: string,
  date: string,
  id?: string
): string {
  const [y = "", m = "", d = ""] = date.split("-");
  const base = `${nameCode(name)}-${y.slice(2)}${m}${d}`;
  const current = id ? content.clips.find((c) => c.id === id)?.slug : undefined;
  if (current && current.startsWith(`${base}-`) && isAutoClipSlug(current)) return current;

  const taken = new Set(content.clips.filter((c) => c.id !== id).map((c) => c.slug));
  let n = 1;
  while (taken.has(`${base}-${String(n).padStart(2, "0")}`)) n++;
  return `${base}-${String(n).padStart(2, "0")}`;
}

/** `base`, or `base-2`, `base-3`… — whichever no other clip already has. */
export function uniqueClipSlug(content: Content, base: string, id?: string): string {
  const root = base || "clip";
  const taken = new Set(content.clips.filter((c) => c.id !== id).map((c) => c.slug));
  let slug = root;
  for (let n = 2; taken.has(slug); n++) slug = `${root}-${n}`;
  return slug;
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
