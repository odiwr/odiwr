import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { putBytes, r2Configured } from "@/lib/r2";
import { slugify } from "@/lib/content";

/**
 * One file for a cinema post: a clip, the still cut from it, or its cover loop.
 * Answers with the file's public address; the composer (PostComposer) uploads
 * every file a post needs this way, then saves the post itself in one action
 * (savePost) — so a post never exists half made.
 *
 * A route handler rather than an action: an action caps the body at a
 * megabyte, and these are video.
 */

/**
 * Not QuickTime: Chrome will not reliably play a .mov served as one, so a post
 * made from it would be blank for most visitors. Export as MP4 first.
 */
const TYPES = /^(video\/(mp4|webm)|image\/(jpeg|png|webp))$/;
const MAX_BYTES = 64 * 1024 * 1024;

/**
 * A dev server with no R2 keys keeps uploads in the project instead, next to
 * the content document's own local copy (lib/content.ts), so the whole flow can
 * be tried without touching the real bucket. public/_local/ is gitignored.
 */
const storesLocally = () => process.env.NODE_ENV === "development" && !r2Configured();

async function put(key: string, file: File, type: string): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!storesLocally()) return putBytes(key, bytes, type);
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
  const path = join(process.cwd(), "public", "_local", key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return `/_local/${key}`;
}

const EXT: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function POST(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!r2Configured() && !storesLocally()) {
    return NextResponse.json({ error: "R2 is not configured" }, { status: 500 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  // The recorder names its type with codecs ("video/webm;codecs=vp9").
  const type = file.type.split(";")[0];
  if (!TYPES.test(type)) return NextResponse.json({ error: "Not an MP4 or WebM" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Over 64 MB" }, { status: 413 });

  const dot = file.name.lastIndexOf(".");
  const base = slugify(dot > 0 ? file.name.slice(0, dot) : file.name) || "clip";
  // Prefixed like every other upload, so a second file with the same name never
  // replaces one already posted.
  const key = `cinema/${Date.now().toString(36)}-${base}${EXT[type]}`;

  return NextResponse.json({ url: await put(key, file, type) });
}
