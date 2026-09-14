"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  getFreshContent,
  saveContent,
  newId,
  slugify,
  type Post,
  type Section,
  type WishItem,
  type Work,
} from "@/lib/content";
import { imageBackground } from "@/lib/image-background";
import { linkPreview, type LinkPreview } from "@/lib/link-preview";
import { hostOf, normalizeHex } from "@/lib/wish";
import { remove } from "@/lib/r2";
import { isStack } from "@/lib/stack-index";

/**
 * Every mutation the dashboard can make.
 *
 * Each one re-checks the session: a server action is a public endpoint, and the
 * layout's redirect only protects page loads.
 *
 * Each one also starts from getFreshContent(), never the cached copy. A save
 * writes the whole document, so starting from a stale one undoes other saves.
 *
 * After a write the whole site is revalidated. It is a small site and content
 * shows up in several places at once — a pinned project is on the landing page,
 * the projects subdomain, the sitemap and the feed — so invalidating precisely
 * would be more code and more ways to miss one.
 */

function flush() {
  revalidatePath("/", "layout");
}

const str = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();
/** Empty strings are dropped so absent fields stay absent in the document. */
const opt = (value: string): string | undefined => (value ? value : undefined);

/**
 * Accepts "odiwr.com" as readily as "https://odiwr.com".
 *
 * A bare host is what anyone actually types. Left alone the browser would treat
 * it as a relative path and the link would point back at this site.
 */
function url(value: string): string | undefined {
  if (!value) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("/")) return value;
  return `https://${value}`;
}

function stackFrom(form: FormData): string[] | undefined {
  const raw = str(form, "stack");
  if (!raw) return undefined;
  const keys = raw.split(",").map((k) => k.trim()).filter(isStack);
  return keys.length ? keys : undefined;
}

export async function saveWork(form: FormData) {
  await requireAdmin();
  const content = await getFreshContent();

  const id = str(form, "id") || newId();
  const title = str(form, "title");
  if (!title) throw new Error("A title is required");

  const index = content.work.findIndex((w) => w.id === id);

  const section = (str(form, "section") || "projects") as Section;
  const slugInput = str(form, "slug");
  const entry: Work = {
    id,
    section,
    title,
    blurb: opt(str(form, "blurb")),
    description: opt(str(form, "description")),
    // Current work always gets a page here, so a blank slug falls back to the
    // title's. Without one its link would go off-site instead.
    slug: slugInput ? slugify(slugInput) : section === "current" ? slugify(title) : undefined,
    href: url(str(form, "href")),
    stack: stackFrom(form),
    // Pins are set from the list, not this form, which has no field for them.
    // Reading one from the form here unpinned every entry that was saved.
    pinned: index >= 0 ? Boolean(content.work[index].pinned) : false,
    poster: url(str(form, "poster")),
    posterAlt: opt(str(form, "posterAlt")),
    media: url(str(form, "media")),
    ogImage: opt(str(form, "ogImage")),
  };

  const work = [...content.work];
  if (index >= 0) work[index] = entry;
  else work.push(entry);

  await saveContent({ ...content, work });
  flush();
  redirect("/dashboard/work");
}

export async function deleteWork(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const content = await getFreshContent();
  await saveContent({ ...content, work: content.work.filter((w) => w.id !== id) });
  flush();
  redirect("/dashboard/work");
}

/**
 * Applies a dragged order to one section.
 *
 * Takes the ids in their new order and rewrites only the slots that section
 * occupies in the flat list, so reordering one section cannot disturb another.
 */
export async function reorderWork(section: Section, ids: string[]) {
  await requireAdmin();
  const content = await getFreshContent();

  const slots = content.work.map((w, i) => (w.section === section ? i : -1)).filter((i) => i >= 0);
  const byId = new Map(content.work.map((w) => [w.id, w]));
  const ordered = ids.map((id) => byId.get(id)).filter((w): w is Work => Boolean(w));
  // Ignore a payload that does not describe exactly this section's contents.
  if (ordered.length !== slots.length) return;

  const work = [...content.work];
  slots.forEach((slot, i) => {
    work[slot] = ordered[i];
  });

  await saveContent({ ...content, work });
  flush();
  revalidatePath("/dashboard/work");
}

/**
 * Writes every pin change made since the last save, in one go.
 *
 * Takes id -> pinned rather than a list of toggles, so the result is the same
 * however many times it is sent, and an entry deleted in the meantime is simply
 * skipped.
 */
export async function savePins(changes: Record<string, boolean>) {
  await requireAdmin();
  const content = await getFreshContent();
  const work = content.work.map((w) =>
    Object.hasOwn(changes, w.id) ? { ...w, pinned: Boolean(changes[w.id]) } : w
  );
  await saveContent({ ...content, work });
  flush();
  revalidatePath("/dashboard/work");
}

export async function savePost(form: FormData) {
  await requireAdmin();
  const content = await getFreshContent();

  const paragraphs = str(form, "body")
    // A blank line starts a new paragraph, which is how anyone writing prose in
    // a textarea already separates them.
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const post: Post = {
    id: content.post?.id ?? newId(),
    date: str(form, "date") || new Date().toISOString().slice(0, 10),
    paragraphs,
  };

  await saveContent({ ...content, post: paragraphs.length ? post : null });
  flush();
  revalidatePath("/dashboard/blog");
}

/** Retires the live post and clears the slot for the next one. */
export async function archivePost() {
  await requireAdmin();
  const content = await getFreshContent();
  if (!content.post) return;

  await saveContent({
    ...content,
    post: null,
    // Newest at the top.
    archive: [content.post, ...content.archive],
  });
  flush();
  revalidatePath("/dashboard/blog");
}

export async function deleteArchived(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const content = await getFreshContent();
  await saveContent({ ...content, archive: content.archive.filter((p) => p.id !== id) });
  flush();
  revalidatePath("/dashboard/blog");
}

export async function deleteMedia(form: FormData) {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await remove(key);
  flush();
  revalidatePath("/dashboard/media");
}

/* ------------------------------------------------------------------ */
/* Wishlist                                                            */
/* ------------------------------------------------------------------ */

/**
 * The editor calls this as a link is typed, to show the picture beside it —
 * on the colour it will sit on.
 */
export async function previewLink(href: string): Promise<LinkPreview & { imageBg?: string }> {
  await requireAdmin();
  const target = url(href.trim());
  if (!target || !/^https?:/i.test(target)) return {};
  const preview = await linkPreview(target);
  return {
    ...preview,
    imageBg: preview.image ? await imageBackground(preview.image) : undefined,
  };
}

export async function saveWishItem(form: FormData) {
  await requireAdmin();

  const href = url(str(form, "href"));
  if (!href) throw new Error("A link is required");

  // "New category…" fills this in; otherwise the dropdown's choice stands.
  const category = str(form, "newCategory") || str(form, "category") || "Other";

  const content = await getFreshContent();
  const id = str(form, "id") || newId();
  const index = content.wishlist.findIndex((i) => i.id === id);
  const existing = index >= 0 ? content.wishlist[index] : undefined;

  // The editor sends what it already pulled for this exact link. Only go and
  // fetch the page when it did not — script off, or saved before it finished.
  let image = opt(str(form, "image"));
  let site = opt(str(form, "pulledSite"));
  let pulledTitle: string | undefined;
  if (!image) {
    if (existing?.image && existing.href === href) {
      image = existing.image;
      site = existing.site;
    } else {
      const preview = await linkPreview(href);
      image = preview.image;
      site = preview.site;
      pulledTitle = preview.title;
    }
  }

  // The colour the image sits on. The editor's, if it worked one out for this
  // image; the stored one if the image has not changed; otherwise work it out
  // now — which also back-fills items saved before this existed.
  // A colour chosen by hand in the editor wins, and is kept as chosen.
  const customBg = normalizeHex(str(form, "imageBgCustom"));
  let imageBg = customBg ?? (image ? opt(str(form, "pulledBg")) : undefined);
  if (!customBg && image && !imageBg && existing?.image === image && !existing.imageBgCustom) {
    imageBg = existing.imageBg;
  }
  if (!customBg && image && !imageBg) imageBg = await imageBackground(image);

  // The size slider: whole steps of ten between 50 and 150. Normal is stored as
  // nothing, so untouched items stay as they were.
  const scaleInput = Number(str(form, "imageScale"));
  const imageScale = Number.isFinite(scaleInput)
    ? Math.min(150, Math.max(50, Math.round(scaleInput / 10) * 10))
    : 100;

  const item: WishItem = {
    id,
    href,
    category,
    imageScale: imageScale === 100 ? undefined : imageScale,
    title: str(form, "title") || opt(str(form, "pulledTitle")) || pulledTitle || hostOf(href),
    image,
    imageBg,
    imageBgCustom: customBg ? true : undefined,
    // Unset when the page did not name itself; the name then comes from the
    // address wherever it is shown (lib/wish.ts).
    site,
    imageOverride: url(str(form, "imageOverride")),
    note: opt(str(form, "note")),
  };

  const wishlist = [...content.wishlist];
  if (existing) wishlist[index] = item;
  else wishlist.push(item);

  const wishCategories = content.wishCategories.includes(category)
    ? content.wishCategories
    : [...content.wishCategories, category];

  await saveContent({ ...content, wishlist, wishCategories });
  flush();
  redirect("/dashboard/wishlist");
}

export async function deleteWishItem(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const content = await getFreshContent();
  await saveContent({ ...content, wishlist: content.wishlist.filter((i) => i.id !== id) });
  flush();
  redirect("/dashboard/wishlist");
}

/** Only an empty category can go, so nothing is ever left without one. */
export async function deleteWishCategory(form: FormData) {
  await requireAdmin();
  const category = str(form, "category");
  const content = await getFreshContent();
  if (content.wishlist.some((i) => i.category === category)) return;
  await saveContent({
    ...content,
    wishCategories: content.wishCategories.filter((c) => c !== category),
  });
  flush();
  revalidatePath("/dashboard/wishlist");
}
