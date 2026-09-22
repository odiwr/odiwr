import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { publicUrl, r2Configured, signUpload } from "@/lib/r2";
import { slugify } from "@/lib/content";

/**
 * Where a cinema post's files go: a clip, the still cut from it, its cover loop.
 * The composer (PostComposer) uploads every file a post needs, then saves the
 * post itself in one action (saveCinemaPost), so it never exists half made.
 *
 * Asked with JSON — the file's name, type and size — it answers with a one-time
 * address to PUT the file to, straight into the bucket, and the address the
 * file will then have. The file never passes through this server, so no host's
 * request limit applies (Vercel's is 4.5 MB; clips are bigger).
 *
 * A dev server without R2 keys has no bucket to sign for. It answers `upload:
 * null`, and the file is POSTed here instead, into the project (public/_local/,
 * gitignored), so the whole flow can be tried without touching the real bucket.
 */

/**
 * Not QuickTime: Chrome will not reliably play a .mov served as one, so a post
 * made from it would be blank for most visitors. Export as MP4 first.
 */
const TYPES = /^(video\/(mp4|webm)|image\/(jpeg|png|webp))$/;
const MAX_BYTES = 200 * 1024 * 1024;

const EXT: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storesLocally = () => process.env.NODE_ENV === "development" && !r2Configured();

/** Where a file of this name and type goes; prefixed, so a second one never replaces the first. */
function keyFor(name: string, type: string): string {
  const dot = name.lastIndexOf(".");
  const base = slugify(dot > 0 ? name.slice(0, dot) : name) || "clip";
  return `cinema/${Date.now().toString(36)}-${base}${EXT[type]}`;
}

/** The type without codecs: the recorder names its own "video/webm;codecs=vp9". */
function check(type: string, size: number): { type: string } | NextResponse {
  const bare = type.split(";")[0];
  if (!TYPES.test(bare)) return NextResponse.json({ error: "Not an MP4 or WebM" }, { status: 415 });
  if (size > MAX_BYTES) return NextResponse.json({ error: "Over 200 MB" }, { status: 413 });
  return { type: bare };
}

export async function POST(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Asking where to put a file.
  if (request.headers.get("content-type")?.startsWith("application/json")) {
    const { name, type, size } = (await request.json().catch(() => ({}))) as {
      name?: string;
      type?: string;
      size?: number;
    };
    const ok = check(String(type ?? ""), Number(size ?? 0));
    if (ok instanceof NextResponse) return ok;
    if (storesLocally()) return NextResponse.json({ upload: null });
    if (!r2Configured()) return NextResponse.json({ error: "R2 is not configured" }, { status: 500 });

    const key = keyFor(String(name ?? "clip"), ok.type);
    return NextResponse.json({
      upload: await signUpload(key, ok.type),
      contentType: ok.type,
      url: publicUrl(key),
    });
  }

  // The file itself: local development only.
  if (!storesLocally()) {
    return NextResponse.json({ error: "Upload straight to storage instead" }, { status: 400 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const ok = check(file.type, file.size);
  if (ok instanceof NextResponse) return ok;

  const key = keyFor(file.name, ok.type);
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
  const path = join(process.cwd(), "public", "_local", key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, new Uint8Array(await file.arrayBuffer()));
  return NextResponse.json({ url: `/_local/${key}` });
}
