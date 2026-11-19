import { captureFrame } from "./capture";
import type { NewPortfolioItem } from "@/app/dashboard/(app)/portfolio-actions";

/**
 * Everything the dashboard does to a portfolio file before saving it, in the
 * browser, which can already decode it:
 *
 * - reads its pixel size, so the site can lay it out before anything loads;
 * - for a picture, makes the grid's copy (at most 800 tall, 1600 wide) and the
 *   viewer's (at most 2560 on its long edge), only where the original is
 *   bigger or heavier than that — a GIF is left whole, since a copy would stop
 *   it moving;
 * - for a video, takes a still from just into it, and its length;
 *
 * then uploads the lot straight to the bucket (api/portfolio).
 */

export const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm";

const THUMB_HEIGHT = 800;
const THUMB_WIDTH = 1600;
const LARGE_EDGE = 2560;
/** A picture lighter than this is used as its own grid copy, if it is small enough already. */
const THUMB_BYTES = 600 * 1024;
/** And as its own viewer copy below this. */
const LARGE_BYTES = 4 * 1024 * 1024;

/** Why a file cannot be added, or null when it can. */
export function refusal(file: File): string | null {
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    return "HEIC only shows in Safari. Export it as JPEG.";
  }
  if (file.type === "video/quicktime" || /\.mov$/i.test(file.name)) {
    return "QuickTime won't play in Chrome. Export it as MP4.";
  }
  if (!ACCEPT.split(",").includes(file.type)) return "Not a picture or video this can show.";
  return null;
}

/**
 * Uploads one file and answers with its address: straight to the bucket
 * through a one-time address the server signs, or, on a dev server with no
 * bucket, to the server itself.
 */
async function upload(file: Blob, name: string): Promise<string> {
  const type = file.type.split(";")[0];
  const ask = await fetch("/dashboard/api/portfolio", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, type, size: file.size }),
  });
  const plan = (await ask.json().catch(() => ({}))) as {
    upload?: string | null;
    url?: string;
    contentType?: string;
    error?: string;
  };
  if (!ask.ok) throw new Error(plan.error ?? `Upload refused (${ask.status})`);

  if (plan.upload && plan.url) {
    const put = await fetch(plan.upload, {
      method: "PUT",
      headers: { "content-type": plan.contentType ?? type },
      body: file,
    }).catch(() => null);
    // A network error here is nearly always the bucket's CORS: it has to allow
    // PUT from this site for the browser to send the file.
    if (!put) throw new Error("Storage refused the upload — check the bucket allows PUT from this site (CORS)");
    if (!put.ok) throw new Error(`Storage refused the upload (${put.status})`);
    return plan.url;
  }

  const body = new FormData();
  body.set("file", file instanceof File ? file : new File([file], name, { type }));
  const res = await fetch("/dashboard/api/portfolio", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data.url;
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * A smaller copy, as WebP, or JPEG where the browser cannot write WebP (older
 * Safari hands back a PNG when asked). A JPEG has no transparency, so anything
 * see-through is laid on white first rather than turning black.
 */
async function copy(bitmap: ImageBitmap, scale: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const webp = await encode(canvas, "image/webp", 0.84);
  if (webp?.type === "image/webp") return webp;

  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return encode(canvas, "image/jpeg", 0.86);
}

/** The name a copy is uploaded under: the original's, marked. */
function named(file: File, mark: string, blob: Blob): string {
  const dot = file.name.lastIndexOf(".");
  const base = dot > 0 ? file.name.slice(0, dot) : file.name;
  return `${base}-${mark}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
}

/** Resolves on the event, or rejects after `ms`, so a file that never gets there cannot hang the queue. */
function once(target: EventTarget, event: string, ms = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`No ${event}`)), ms);
    target.addEventListener(
      event,
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

async function videoLength(src: string): Promise<number> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.src = src;
  try {
    await once(video, "loadedmetadata");
    return Number.isFinite(video.duration) ? video.duration : 0;
  } catch {
    return 0;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

export type Step = "reading" | "uploading";

/** Reads, copies and uploads one file, and answers with the item to save. */
export async function prepare(file: File, say: (step: Step) => void): Promise<NewPortfolioItem> {
  say("reading");

  if (file.type.startsWith("video/")) {
    const src = URL.createObjectURL(file);
    try {
      const frame = await captureFrame(src);
      if (!frame.width || !frame.height) {
        throw new Error("This browser can't read that video. Export it as an H.264 MP4.");
      }
      const duration = await videoLength(src);
      say("uploading");
      const [video, poster] = await Promise.all([
        upload(file, file.name),
        frame.poster ? upload(frame.poster, named(file, "still", frame.poster)) : undefined,
      ]);
      return {
        kind: "video",
        src: video,
        poster,
        width: frame.width,
        height: frame.height,
        duration: duration || undefined,
      };
    } finally {
      URL.revokeObjectURL(src);
    }
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) throw new Error("This browser can't read that picture.");
  try {
    const { width, height } = bitmap;
    const gif = file.type === "image/gif";

    const thumbScale = Math.min(1, THUMB_HEIGHT / height, THUMB_WIDTH / width);
    const largeScale = Math.min(1, LARGE_EDGE / Math.max(width, height));
    const thumb =
      !gif && (thumbScale < 1 || file.size > THUMB_BYTES) ? await copy(bitmap, thumbScale) : null;
    const large =
      !gif && (largeScale < 1 || file.size > LARGE_BYTES) ? await copy(bitmap, largeScale) : null;

    say("uploading");
    const [src, thumbUrl, largeUrl] = await Promise.all([
      upload(file, file.name),
      thumb ? upload(thumb, named(file, "grid", thumb)) : undefined,
      large ? upload(large, named(file, "view", large)) : undefined,
    ]);
    return { kind: "image", src, thumb: thumbUrl, large: largeUrl, width, height };
  } finally {
    bitmap.close();
  }
}

/** Runs at most `n` of the jobs handed to it at once, in the order they were handed over. */
export function gate(n: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async <T>(job: () => Promise<T>): Promise<T> => {
    // A finished job hands its place straight to the next in line, so nothing
    // new can slip in between.
    if (running < n) running++;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await job();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running--;
    }
  };
}
