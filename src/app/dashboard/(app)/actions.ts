"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  getContent,
  saveContent,
  newId,
  slugify,
  type Post,
  type Section,
  type Work,
} from "@/lib/content";
import { remove } from "@/lib/r2";
import { isStack } from "@/lib/stack-index";

/**
 * Every mutation the dashboard can make.
 *
 * Each one re-checks the session: a server action is a public endpoint, and the
 * layout's redirect only protects page loads.
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
const bool = (form: FormData, key: string): boolean => form.get(key) === "on";
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
  const content = await getContent();

  const id = str(form, "id") || newId();
  const title = str(form, "title");
  if (!title) throw new Error("A title is required");

  const slugInput = str(form, "slug");
  const entry: Work = {
    id,
    section: (str(form, "section") || "projects") as Section,
    title,
    description: opt(str(form, "description")),
    slug: slugInput ? slugify(slugInput) : undefined,
    href: url(str(form, "href")),
    stack: stackFrom(form),
    pinned: bool(form, "pinned"),
    poster: url(str(form, "poster")),
    media: url(str(form, "media")),
    ogImage: opt(str(form, "ogImage")),
  };

  const index = content.work.findIndex((w) => w.id === id);
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
  const content = await getContent();
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
  const content = await getContent();

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

export async function togglePin(id: string) {
  await requireAdmin();
  const content = await getContent();
  const work = content.work.map((w) => (w.id === id ? { ...w, pinned: !w.pinned } : w));
  await saveContent({ ...content, work });
  flush();
  revalidatePath("/dashboard/work");
}

export async function savePost(form: FormData) {
  await requireAdmin();
  const content = await getContent();

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
  const content = await getContent();
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
  const content = await getContent();
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
