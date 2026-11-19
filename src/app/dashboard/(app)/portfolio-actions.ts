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
 * after writing.
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
  loop?: string;
  width: number;
  height: number;
  duration?: number;
};

/**
 * Adds one uploaded item and answers with its id.
 *
 * New work goes in at the front of the dashboard's list (the site shuffles it
 * anyway). A batch keeps the order it was chosen in: each item after the first
 * is placed `after` the one before it.
 */
export async function addPortfolioItem(input: NewPortfolioItem, after?: string): Promise<string> {
  const src = ours(input.src);
  const width = Math.round(Number(input.width));
  const height = Math.round(Number(input.height));
  if (!src) throw new Error("The file was not uploaded here");
  if (!(width > 0 && height > 0)) throw new Error("The file's size could not be read");

  const id = newId();
  const duration = Number(input.duration);
  const video = input.kind === "video";
  const item: PortfolioItem = {
    id,
    kind: video ? "video" : "image",
    src,
    thumb: video ? undefined : ours(input.thumb),
    large: video ? undefined : ours(input.large),
    poster: video ? ours(input.poster) : undefined,
    loop: video ? ours(input.loop) : undefined,
    width,
    height,
    duration: video && duration > 0 ? Math.round(duration * 10) / 10 : undefined,
    date: new Date().toISOString().slice(0, 10),
  };

  await update((p) => {
    const items = [...p.items];
    const at = after ? items.findIndex((i) => i.id === after) + 1 : 0;
    items.splice(Math.max(0, at), 0, item);
    return { ...p, items };
  });
  return id;
}

/** The alt text: read out by screen readers, never shown. */
export async function setPortfolioAlt(id: string, alt: string) {
  await update((p) => ({
    ...p,
    items: p.items.map((i) => (i.id === id ? { ...i, alt: String(alt ?? "").trim() || undefined } : i)),
  }));
}

/** Hidden items stay here, greyed, and leave the site. */
export async function setPortfolioHidden(id: string, hidden: boolean) {
  await update((p) => ({
    ...p,
    items: p.items.map((i) => (i.id === id ? { ...i, hidden: hidden || undefined } : i)),
  }));
}

/** Deletes an item, and every file uploaded for it that nothing else uses. */
export async function deletePortfolioItem(id: string) {
  await requireAdmin();
  const before = (await getFreshContent()).portfolio.items.find((i) => i.id === id);
  const content = await update((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
  if (!before) return;

  const filesOf = (i: PortfolioItem) => [i.src, i.thumb, i.large, i.poster, i.loop];
  const used = new Set(content.portfolio.items.flatMap(filesOf).filter(Boolean));
  const files = filesOf(before).filter((h): h is string => !!h && !used.has(h));
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
