import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { putBytes, r2Configured } from "@/lib/r2";
import { slugify } from "@/lib/content";

/**
 * File upload.
 *
 * A route handler rather than a server action: actions cap the request body at
 * a megabyte by default, and these are GIFs and video.
 */

const ALLOWED = /^(image\/(png|jpeg|gif|webp|avif|svg\+xml)|video\/(mp4|webm))$/;
const MAX_BYTES = 64 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (!(await getSession())) return new NextResponse("Unauthorized", { status: 401 });
  if (!r2Configured()) return new NextResponse("R2 is not configured", { status: 500 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new NextResponse("No file", { status: 400 });
  if (!ALLOWED.test(file.type)) return new NextResponse(`Unsupported type: ${file.type}`, { status: 415 });
  if (file.size > MAX_BYTES) return new NextResponse("Too large", { status: 413 });

  const folder = slugify(String(form.get("folder") ?? "uploads")) || "uploads";
  const dot = file.name.lastIndexOf(".");
  const ext = dot > 0 ? file.name.slice(dot).toLowerCase() : "";
  const base = slugify(dot > 0 ? file.name.slice(0, dot) : file.name) || "file";
  // Prefixed so re-uploading a file with the same name never silently replaces
  // something already referenced by a published entry.
  const key = `${folder}/${Date.now().toString(36)}-${base}${ext}`;

  const url = await putBytes(key, new Uint8Array(await file.arrayBuffer()), file.type);

  const back = new URL("/dashboard/media", request.url);
  back.searchParams.set("uploaded", url);
  return NextResponse.redirect(back, 303);
}
