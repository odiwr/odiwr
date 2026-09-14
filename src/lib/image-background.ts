// SERVER-ONLY. Reading shop images: the colour one sits on, and a small copy of
// its pixels for the dashboard's eyedropper.
//
// Both happen here because the browser cannot do either: shop images come from
// other origins without CORS headers, and a canvas will not give up their
// pixels.
//
// The background colour comes from the EDGES, not the most prominent colour: in
// a product shot the most prominent colour is usually the product. A red shoe on
// white would paint the card red. What surrounds the product is at the border,
// so that is what is sampled:
//
//   1. Shrink the image to a small square, so each sample is already an average
//      of its area and JPEG speckle washes out.
//   2. Take the ring of pixels around the edge, skipping see-through ones.
//   3. Bucket them by colour, and take the biggest bucket together with its
//      immediate neighbours (so 254,254,254 and 239,239,239 count as one white).
//   4. If that covers most of the ring, the background is flat: use the exact
//      average of those pixels, and the photo blends into the card seamlessly.
//      If not, the edges are a real photo: use the average of the whole ring,
//      which at least continues the image's overall tone.
//   5. A mostly transparent ring is a cut-out; there is no background to match,
//      so nothing is returned and the card keeps its usual colour.

import sharp from "sharp";

const SIZE = 48;
/** Pixels in from each edge that count as "edge". */
const RING = 3;
/** Share of the ring one colour needs before the background is called flat. */
const FLAT_SHARE = 0.45;
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 8_000_000;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

/** The image's bytes, or undefined if it cannot be had (blocked, too big, not there). */
async function loadImage(src: string): Promise<Buffer | undefined> {
  try {
    const res = await fetch(src, {
      headers: { "user-agent": USER_AGENT, accept: "image/avif,image/webp,image/*;q=0.8" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return undefined;
    const input = Buffer.from(await res.arrayBuffer());
    return input.length > MAX_BYTES ? undefined : input;
  } catch {
    return undefined;
  }
}

export async function imageBackground(src: string): Promise<string | undefined> {
  const input = await loadImage(src);
  if (!input) return undefined;
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
      .resize(SIZE, SIZE, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return edgeColor(data, info.width, info.height);
  } catch {
    return undefined;
  }
}

export type ImagePixels = { width: number; height: number; /** RGB, base64. */ pixels: string };

/**
 * A small copy of the image, as raw RGB, for picking colours from it in the
 * browser. The same proportions as the image, at most `max` pixels on its long
 * side — plenty to pick a colour from, and small enough to send (about 35 KB).
 * See-through areas come out white, the usual colour behind a cut-out.
 */
export async function imagePixels(src: string, max = 96): Promise<ImagePixels | undefined> {
  const input = await loadImage(src);
  if (!input) return undefined;
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000 })
      .resize(max, max, { fit: "inside" })
      .flatten({ background: "#ffffff" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, pixels: data.toString("base64") };
  } catch {
    return undefined;
  }
}

type Bucket = { n: number; r: number; g: number; b: number };

/** RGBA pixels in, "#rrggbb" out. Exported for testing against raw pixel data. */
export function edgeColor(data: Uint8Array, width: number, height: number): string | undefined {
  const buckets = new Map<number, Bucket>();
  const all: Bucket = { n: 0, r: 0, g: 0, b: 0 };
  let ring = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= RING && x < width - RING && y >= RING && y < height - RING;
      if (inside) continue;
      ring++;

      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];

      // 16 levels per channel.
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bucket.n++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);

      all.n++;
      all.r += r;
      all.g += g;
      all.b += b;
    }
  }

  if (all.n < ring / 2) return undefined;

  let topKey = -1;
  let topCount = 0;
  for (const [key, bucket] of buckets) {
    if (bucket.n > topCount) {
      topKey = key;
      topCount = bucket.n;
    }
  }

  const channels = (key: number) => [(key >> 8) & 15, (key >> 4) & 15, key & 15];
  const top = channels(topKey);
  const flat: Bucket = { n: 0, r: 0, g: 0, b: 0 };
  for (const [key, bucket] of buckets) {
    const c = channels(key);
    if (c.every((v, i) => Math.abs(v - top[i]) <= 1)) {
      flat.n += bucket.n;
      flat.r += bucket.r;
      flat.g += bucket.g;
      flat.b += bucket.b;
    }
  }

  return hex(flat.n / all.n >= FLAT_SHARE ? flat : all);
}

function hex({ n, r, g, b }: Bucket): string {
  const channel = (sum: number) => Math.round(sum / n).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
