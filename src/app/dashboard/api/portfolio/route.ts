import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { publicUrl, r2Configured, signUpload } from "@/lib/r2";
import { slugify } from "@/lib/content";

/**
 * Where portfolio files go: an original, the smaller copies made of it in the
 * browser, a video's still. The dashboard (PortfolioBoard) uploads each file,
 * then saves the item in one action, so it never exists half made.
 *
 * The same handshake as api/cinema: asked with JSON — the file's name, type and
 * size — it answers with a one-time address to PUT the file to, straight into
 * the bucket, and the address the file will then have. The file never passes
 * through this server, so no host's request limit applies.
 *
 * A dev server without R2 keys answers `upload: null`, and the file is POSTed
 * here instead, into the project (public/_local/, gitignored).
 */

/**
 * Not HEIC, which only Safari can show, and not QuickTime, which Chrome will not
 * reliably play: export those as JPEG and MP4 first.
 */
const IMAGE = /^image\/(jpeg|png|webp|gif|avif)$/;
const VIDEO = /^video\/(mp4|webm)$/;
const MAX_IMAGE = 100 * 1024 * 1024;
const MAX_VIDEO = 2 * 1024 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

const storesLocally = () => process.env.NODE_ENV === "development" && !r2Configured();

/**
 * Where a file of this name and type goes. Prefixed with the time and a little
 * randomness, so a second file of the same name — or a copy made in the same
 * millisecond as another — never replaces the first.
 */
function keyFor(name: string, type: string): string {
  const dot = name.lastIndexOf(".");
  const base = slugify(dot > 0 ? name.slice(0, dot) : name).slice(0, 60) || "file";
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `portfolio/${stamp}-${base}${EXT[type]}`;
}

function check(type: string, size: number): { type: string } | NextResponse {
  const bare = type.split(";")[0];
  if (IMAGE.test(bare)) {
    if (size > MAX_IMAGE) return NextResponse.json({ error: "Over 100 MB" }, { status: 413 });
    return { type: bare };
  }
  if (VIDEO.test(bare)) {
    if (size > MAX_VIDEO) return NextResponse.json({ error: "Over 2 GB" }, { status: 413 });
    return { type: bare };
  }
  return NextResponse.json(
    { error: "Not a JPEG, PNG, WebP, GIF, AVIF, MP4 or WebM" },
    { status: 415 }
  );
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

    const key = keyFor(String(name ?? "file"), ok.type);
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
