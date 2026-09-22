import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { putBytes, r2Configured } from "@/lib/r2";
import {
  getFreshContent,
  newId,
  saveContent,
  autoClipSlug,
  slugify,
  type Clip,
  type Slide,
} from "@/lib/content";

/**
 * One clip uploaded from the cinema tab: the video, the still and the four-second
 * cover loop the browser made from it, and the post made for them.
 *
 * A route handler for the same reason as ../upload: an action caps the body at a
 * megabyte. The tab sends a batch one file at a time, waiting for each, so two
 * saves never start from the same copy of the document.
 *
 * Given `post` (an id), the upload becomes that post's next slide instead of a
 * post of its own.
 *
 * Answers in JSON rather than redirecting, since it is called from script.
 */

/**
 * Not QuickTime: Chrome will not reliably play a .mov served as one, so a post
 * made from it would be blank for most visitors. Export as MP4 first.
 */
const VIDEO = /^video\/(mp4|webm)$/;
const IMAGE = /^image\/(jpeg|png|webp)$/;
const MAX_BYTES = 64 * 1024 * 1024;

/**
 * A dev server with no R2 keys keeps uploads in the project instead, next to
 * the content document's own local copy (lib/content.ts), so the whole flow can
 * be tried without touching the real bucket. public/_local/ is gitignored.
 */
const storesLocally = () => process.env.NODE_ENV === "development" && !r2Configured();

async function put(key: string, file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!storesLocally()) return putBytes(key, bytes, file.type);
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
  const path = join(process.cwd(), "public", "_local", key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return `/_local/${key}`;
}

function keyFor(file: File, stamp: string, suffix = ""): string {
  const dot = file.name.lastIndexOf(".");
  const base = slugify(dot > 0 ? file.name.slice(0, dot) : file.name) || "clip";
  const ext = file.type === "image/jpeg" ? ".jpg" : dot > 0 ? file.name.slice(dot).toLowerCase() : "";
  // Prefixed like every other upload, so a second file with the same name never
  // replaces one already posted.
  return `cinema/${stamp}-${base}${suffix}${ext}`;
}

/** A positive whole number from the form, or nothing. */
function size(value: FormDataEntryValue | null): number | undefined {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function POST(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!r2Configured() && !storesLocally()) return NextResponse.json({ error: "R2 is not configured" }, { status: 500 });

  const form = await request.formData();
  const file = form.get("file");
  const poster = form.get("poster");
  const cover = form.get("cover");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!VIDEO.test(file.type)) {
    return NextResponse.json({ error: "Not an MP4 or WebM" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Over 64 MB" }, { status: 413 });

  const stamp = Date.now().toString(36);
  const video = await put(keyFor(file, stamp), file);
  const still =
    poster instanceof File && IMAGE.test(poster.type) && poster.size <= MAX_BYTES
      ? await put(keyFor(poster, stamp, "-poster"), poster)
      : undefined;
  // The recorder names its type with codecs ("video/webm;codecs=vp9").
  const loop =
    cover instanceof File && VIDEO.test(cover.type.split(";")[0]) && cover.size <= MAX_BYTES
      ? await put(keyFor(cover, stamp, "-loop"), cover)
      : undefined;

  // The file's name is the only title there is yet; the editor is where it gets a real one.
  const dot = file.name.lastIndexOf(".");
  const title = String(form.get("title") ?? "").trim() || (dot > 0 ? file.name.slice(0, dot) : file.name);

  const content = await getFreshContent();

  const postId = String(form.get("post") ?? "");
  if (postId) {
    const index = content.clips.findIndex((c) => c.id === postId);
    if (index < 0) return NextResponse.json({ error: "That post is gone" }, { status: 404 });
    const slide: Slide = {
      video,
      poster: still,
      cover: loop,
      width: size(form.get("width")),
      height: size(form.get("height")),
    };
    const post = content.clips[index];
    const clips = [...content.clips];
    clips[index] = { ...post, slides: [...(post.slides ?? []), slide] };
    await saveContent({ ...content, clips });
    revalidatePath("/", "layout");
    return NextResponse.json({ id: post.id, slug: post.slug, slides: clips[index].slides!.length + 1 });
  }

  const date = new Date().toISOString().slice(0, 10);
  const clip: Clip = {
    id: newId(),
    // From the file's name for now. Saving it with a movie or show named
    // regenerates it from that.
    slug: autoClipSlug(content, title, date),
    title,
    video,
    poster: still,
    cover: loop,
    width: size(form.get("width")),
    height: size(form.get("height")),
    date,
    hidden: form.get("publish") === "1" ? undefined : true,
  };

  await saveContent({ ...content, clips: [...content.clips, clip] });
  revalidatePath("/", "layout");

  return NextResponse.json({ id: clip.id, slug: clip.slug });
}
