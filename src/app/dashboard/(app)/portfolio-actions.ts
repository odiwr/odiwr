"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  getFreshContent,
  saveContent,
  newId,
  type Content,
  type Portfolio,
  type PortfolioItem,
} from "@/lib/content";
import { MEDIA_BASE, remove } from "@/lib/r2";

/**
 * The portfolio's mutations. Same rules as actions.ts: each re-checks the
 * session, starts from the document as it is in the bucket now, and revalidates
 * the whole site after writing.
 *
 * Files only ever come from api/portfolio, so an address that is not one of its
 * own is refused rather than stored: nothing typed or forged can put a link to
 * somewhere else on the page.
 */

function flush() {
  revalidatePath("/", "layout");
  revalidatePath("/dashboard/portfolio");
}

const LOCAL = "/_local/portfolio/";

/** One of api/portfolio's own addresses, or undefined. */
function ours(href: unknown): string | undefined {
  if (typeof href !== "string" || !href) return undefined;
  if (MEDIA_BASE && href.startsWith(`${MEDIA_BASE}/portfolio/`)) return href;
  if (process.env.NODE_ENV === "development" && href.startsWith(LOCAL)) return href;
  return undefined;
}

/** The bucket key behind one of our addresses, for deleting it. */
function keyOf(href: string): string | null {
  return MEDIA_BASE && href.startsWith(`${MEDIA_BASE}/portfolio/`) ? href.slice(MEDIA_BASE.length + 1) : null;
}

async function update(change: (p: Portfolio) => Portfolio): Promise<Content> {
  await requireAdmin();
  const content = await getFreshContent();
  const next = { ...content, portfolio: change(content.portfolio) };
  await saveContent(next);
  flush();
  return next;
}

export type NewPortfolioItem = {
  kind: "image" | "video";
  src: string;
  thumb?: string;
  large?: string;
  poster?: string;
  width: number;
  height: number;
  duration?: number;
  set?: string;
};

/**
 * Adds one uploaded item and answers with its id.
 *
 * New work goes in at the front of the grid. A batch keeps the order it was
 * chosen in: each item after the first is placed `after` the one before it.
 */
export async function addPortfolioItem(input: NewPortfolioItem, after?: string): Promise<string> {
  const src = ours(input.src);
  const width = Math.round(Number(input.width));
  const height = Math.round(Number(input.height));
  if (!src) throw new Error("The file was not uploaded here");
  if (!(width > 0 && height > 0)) throw new Error("The file's size could not be read");

  const id = newId();
  const duration = Number(input.duration);
  await update((p) => {
    const set = input.set && p.sets.includes(input.set) ? input.set : undefined;
    const item: PortfolioItem = {
      id,
      kind: input.kind === "video" ? "video" : "image",
      src,
      thumb: ours(input.thumb),
      large: ours(input.large),
      poster: ours(input.poster),
      width,
      height,
      duration: duration > 0 ? Math.round(duration * 10) / 10 : undefined,
      set,
      date: new Date().toISOString().slice(0, 10),
    };
    const items = [...p.items];
    const at = after ? items.findIndex((i) => i.id === after) + 1 : 0;
    items.splice(Math.max(0, at), 0, item);
    return { ...p, items };
  });
  return id;
}

/** The caption and the set, from the board. A set that is not in the list clears it. */
export async function updatePortfolioItem(id: string, patch: { caption?: string; set?: string | null }) {
  await update((p) => ({
    ...p,
    items: p.items.map((i) => {
      if (i.id !== id) return i;
      const next = { ...i };
      if (patch.caption !== undefined) next.caption = patch.caption.trim() || undefined;
      if (patch.set !== undefined) next.set = patch.set && p.sets.includes(patch.set) ? patch.set : undefined;
      return next;
    }),
  }));
}

/** Hidden items stay here, greyed, and leave the site. */
export async function setPortfolioHidden(id: string, hidden: boolean) {
  await update((p) => ({
    ...p,
    items: p.items.map((i) => (i.id === id ? { ...i, hidden: hidden || undefined } : i)),
  }));
}

/** Applies a dragged order. A payload that is not every item is ignored. */
export async function reorderPortfolio(ids: string[]) {
  await update((p) => {
    const byId = new Map(p.items.map((i) => [i.id, i]));
    const ordered = ids.map((id) => byId.get(id)).filter((i): i is PortfolioItem => Boolean(i));
    return ordered.length === p.items.length ? { ...p, items: ordered } : p;
  });
}

/** The item on the cover; null goes back to the first picture in the grid. */
export async function setPortfolioCover(id: string | null) {
  await update((p) => ({
    ...p,
    cover: id && p.items.some((i) => i.id === id) ? id : undefined,
    // A new cover is a new picture: start it from the middle.
    focus: id === p.cover ? p.focus : undefined,
  }));
}

/**
 * The title, the line under it, the sets and the cover's focus.
 *
 * A set taken off the list takes its items with it to no set; they stay in the
 * grid under All. A set renamed in place (same position, new name) keeps its
 * items.
 */
export async function savePortfolioSettings(input: {
  title: string;
  subtitle?: string;
  sets: string[];
  renames?: Record<string, string>;
  focus?: { x: number; y: number };
}) {
  const title = String(input.title ?? "").trim() || "Portfolio";
  const subtitle = String(input.subtitle ?? "").trim() || undefined;
  const sets = [
    ...new Set((Array.isArray(input.sets) ? input.sets : []).map((s) => String(s).trim()).filter(Boolean)),
  ];
  const renames = input.renames ?? {};
  const clamp = (n: unknown) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));
  const focus = input.focus ? { x: clamp(input.focus.x), y: clamp(input.focus.y) } : undefined;

  await update((p) => ({
    ...p,
    title,
    subtitle,
    sets,
    focus: focus ?? p.focus,
    items: p.items.map((i) => {
      if (!i.set) return i;
      const set = renames[i.set] ?? i.set;
      return { ...i, set: sets.includes(set) ? set : undefined };
    }),
  }));
}

/** Deletes an item, and every file uploaded for it that nothing else uses. */
export async function deletePortfolioItem(id: string) {
  await requireAdmin();
  const before = (await getFreshContent()).portfolio.items.find((i) => i.id === id);
  const content = await update((p) => ({
    ...p,
    items: p.items.filter((i) => i.id !== id),
    cover: p.cover === id ? undefined : p.cover,
  }));
  if (!before) return;

  const used = new Set(
    content.portfolio.items.flatMap((i) => [i.src, i.thumb, i.large, i.poster]).filter(Boolean)
  );
  const files = [before.src, before.thumb, before.large, before.poster].filter(
    (h): h is string => !!h && !used.has(h)
  );
  for (const href of new Set(files)) {
    const key = keyOf(href);
    if (key) await remove(key).catch(() => {});
    else if (process.env.NODE_ENV === "development" && href.startsWith(LOCAL)) {
      const { unlink } = await import("node:fs/promises");
      const { join } = await import("node:path");
      await unlink(join(process.cwd(), "public", href)).catch(() => {});
    }
  }
}
