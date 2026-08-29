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

export type Content = {
  work: Work[];
  /** The one on the site now. */
  post: Post | null;
  /** Everything retired, newest first. */
  archive: Post[];
};

export const EMPTY_CONTENT: Content = { work: [], post: null, archive: [] };

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

  // Documents written before the blog became one-live-post carried a `posts`
  // array. Newest becomes the live one, the rest become the archive.
  if (!doc.post && Array.isArray(doc.posts) && doc.posts.length) {
    const sorted = [...doc.posts].sort((a, b) => b.date.localeCompare(a.date));
    return { work: Array.isArray(doc.work) ? doc.work : [], post: sorted[0], archive: sorted.slice(1) };
  }

  return {
    work: Array.isArray(doc.work) ? doc.work : [],
    post: doc.post ?? null,
    archive: Array.isArray(doc.archive) ? doc.archive : [],
  };
}

export async function getContent(): Promise<Content> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (!r2Configured()) return EMPTY_CONTENT;

  const body = await getText(KEY);
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

export async function saveContent(next: Content): Promise<void> {
  await putText(KEY, JSON.stringify(next, null, 2), "application/json");
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
