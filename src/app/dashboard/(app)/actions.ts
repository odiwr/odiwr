"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  getFreshContent,
  saveContent,
  newId,
  slugify,
  autoClipSlug,
  isAutoClipSlug,
  uniqueClipSlug,
  type Clip,
  type Slide,
  type Post,
  type Section,
  type WishItem,
  type Work,
} from "@/lib/content";
import { imageBackground } from "@/lib/image-background";
import { linkPreview, type LinkPreview } from "@/lib/link-preview";
import { hostOf, normalizeBackground } from "@/lib/wish";
import { clipSlides } from "@/lib/cinema";
import { MEDIA_BASE, remove } from "@/lib/r2";
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
  let pulledPrice: number | undefined;
  if (!image) {
    if (existing?.image && existing.href === href) {
      image = existing.image;
      // A typed name is not what the page called itself; the form carries it.
      site = existing.siteCustom ? undefined : existing.site;
    } else {
      const preview = await linkPreview(href);
      image = preview.image;
      site = preview.site;
      pulledTitle = preview.title;
      pulledPrice = preview.price;
    }
  }

  // The colour the image sits on. The editor's, if it worked one out for this
  // image; the stored one if the image has not changed; otherwise work it out
  // now — which also back-fills items saved before this existed.
  // A colour chosen by hand in the editor wins, and is kept as chosen.
  // A hand-made gradient (shift-clicked points on the picture) counts as chosen too.
  const customBg = normalizeBackground(str(form, "imageBgCustom"));
  let imageBg =
    customBg ?? (image ? (normalizeBackground(str(form, "pulledBg")) ?? undefined) : undefined);
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

  // "$1,299.00", "1299" and "1299.5" all read as a price. The editor fills it
  // from the page as the link is typed; when the page was fetched here instead
  // (script off), a blank one takes what that found.
  const priceInput = Number(str(form, "price").replace(/[$,\s]/g, ""));
  const price =
    str(form, "price") && Number.isFinite(priceInput) && priceInput >= 0
      ? Math.round(priceInput * 100) / 100
      : pulledPrice;

  const siteOverride = opt(str(form, "siteOverride"));

  const item: WishItem = {
    id,
    href,
    category,
    imageScale: imageScale === 100 ? undefined : imageScale,
    title: str(form, "title") || opt(str(form, "pulledTitle")) || pulledTitle || hostOf(href),
    image,
    imageBg,
    imageBgCustom: customBg ? true : undefined,
    // A name typed in the editor wins. Otherwise unset when the page did not
    // name itself; the name then comes from the address wherever it is shown
    // (lib/wish.ts).
    site: siteOverride ?? site,
    siteCustom: siteOverride ? true : undefined,
    imageOverride: url(str(form, "imageOverride")),
    price,
    // Checkboxes send nothing at all when unticked.
    purchased: form.has("purchased") ? true : undefined,
    hidden: form.has("visible") ? undefined : true,
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

/**
 * Applies a dragged order to one category.
 *
 * Same approach as reorderWork: only the slots that category occupies in the
 * flat list are rewritten, so no other category moves.
 */
export async function reorderWishItems(category: string, ids: string[]) {
  await requireAdmin();
  const content = await getFreshContent();

  const slots = content.wishlist
    .map((item, i) => (item.category === category ? i : -1))
    .filter((i) => i >= 0);
  const byId = new Map(content.wishlist.map((item) => [item.id, item]));
  const ordered = ids.map((id) => byId.get(id)).filter((item): item is WishItem => Boolean(item));
  if (ordered.length !== slots.length || ordered.some((item) => item.category !== category)) return;

  const wishlist = [...content.wishlist];
  slots.forEach((slot, i) => {
    wishlist[slot] = ordered[i];
  });

  await saveContent({ ...content, wishlist });
  flush();
  revalidatePath("/dashboard/wishlist");
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

/* ------------------------------------------------------------------ */
/* Cinema                                                              */
/* ------------------------------------------------------------------ */

export async function saveClip(form: FormData) {
  await requireAdmin();
  const title = str(form, "title");
  if (!title) throw new Error("A title is required");

  const content = await getFreshContent();
  const id = str(form, "id") || newId();
  const index = content.clips.findIndex((c) => c.id === id);
  const existing = index >= 0 ? content.clips[index] : undefined;

  const video = url(str(form, "video"));
  const embed = url(str(form, "embed"));
  const poster = url(str(form, "poster"));
  if (!video && !embed && !poster) throw new Error("A clip needs a video, a link, or a poster");

  const show = opt(str(form, "show"));
  const date = str(form, "date") || existing?.date || new Date().toISOString().slice(0, 10);

  // Generated unless a slug of your own was typed. Left blank, or left as the
  // generated one it already had, it follows the name and date; that way
  // naming the show after an upload replaces the file-name slug.
  const typed = slugify(str(form, "slug"));
  const generated = !typed || (typed === existing?.slug && isAutoClipSlug(typed));

  const clip: Clip = {
    id,
    slug: generated
      ? autoClipSlug(content, show || title, date, id)
      : // Two posts cannot share an address, so a taken slug gets a number.
        uniqueClipSlug(content, typed, id),
    title,
    show,
    caption: opt(str(form, "caption")),
    video,
    poster,
    cover: url(str(form, "cover")),
    embed,
    // Measured when it was uploaded. Kept while the video is the same one.
    width: existing?.video === video ? existing?.width : undefined,
    height: existing?.video === video ? existing?.height : undefined,
    date,
    hidden: form.has("visible") ? undefined : true,
    // Added and removed from their own controls, not this form.
    slides: existing?.slides,
  };

  const clips = [...content.clips];
  if (existing) clips[index] = clip;
  else clips.push(clip);

  await saveContent({ ...content, clips });
  flush();
  redirect("/dashboard/cinema");
}

/** The bucket key behind one of our own public URLs, if it is one uploaded for the cinema. */
function cinemaKey(href: string | undefined): string | null {
  if (!href || !MEDIA_BASE || !href.startsWith(`${MEDIA_BASE}/cinema/`)) return null;
  return href.slice(MEDIA_BASE.length + 1);
}

/**
 * Deletes the post, and the files uploaded for it.
 *
 * Only files in the bucket's cinema/ folder go: those were made for this post
 * alone. Anything else it pointed at (a picked file, another site) is left be.
 */
export async function deleteClip(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const content = await getFreshContent();
  const clip = content.clips.find((c) => c.id === id);
  await saveContent({ ...content, clips: content.clips.filter((c) => c.id !== id) });

  if (clip) {
    const others = content.clips.filter((c) => c.id !== id);
    await removeSlideFiles(clipSlides(clip), others);
  }

  flush();
  redirect("/dashboard/cinema");
}

/** Every file a set of posts points at. */
function filesOf(clips: Clip[]): Set<string> {
  const hrefs = new Set<string>();
  for (const c of clips) {
    for (const s of clipSlides(c)) for (const href of [s.video, s.poster, s.cover]) if (href) hrefs.add(href);
  }
  return hrefs;
}

/**
 * Deletes the files uploaded for these slides that nothing else still uses.
 *
 * Only files in the bucket's cinema/ folder go: those were made for a post
 * alone. Anything else a slide pointed at (a picked file, another site) is left
 * be. A dev server without R2 kept its uploads in the project (api/cinema).
 */
async function removeSlideFiles(slides: Slide[], remaining: Clip[]) {
  const used = filesOf(remaining);
  const hrefs = slides.flatMap((s) => [s.video, s.poster, s.cover]).filter((h): h is string => !!h && !used.has(h));
  for (const href of hrefs) {
    const key = cinemaKey(href);
    if (key) await remove(key).catch(() => {});
    else if (process.env.NODE_ENV === "development" && href.startsWith("/_local/cinema/")) {
      const { unlink } = await import("node:fs/promises");
      const { join } = await import("node:path");
      await unlink(join(process.cwd(), "public", href)).catch(() => {});
    }
  }
}

/** Takes one slide (not the first, which is the post's own) out of a post. */
export async function removeSlide(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const at = Number(str(form, "slide"));
  const content = await getFreshContent();
  const index = content.clips.findIndex((c) => c.id === id);
  const post = content.clips[index];
  if (!post?.slides || !Number.isInteger(at) || at < 0 || at >= post.slides.length) return;

  const removed = post.slides[at];
  const slides = post.slides.filter((_, i) => i !== at);
  const clips = [...content.clips];
  clips[index] = { ...post, slides: slides.length ? slides : undefined };
  await saveContent({ ...content, clips });
  await removeSlideFiles([removed], clips);

  flush();
  revalidatePath(`/dashboard/cinema/${id}`);
}
