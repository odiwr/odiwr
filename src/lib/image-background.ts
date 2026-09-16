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
//
// When the ring is NOT mostly one colour, each side is read on its own. Sides
// that are each one colour, and clearly differ (a studio sweep, a two-tone
// backdrop), become up to four gradient points, one mid-way along each side, and
// the card is drawn as a gradient between them (backgroundStyle in lib/wish.ts)
// rather than one flat average that matches none of them.

import sharp from "sharp";
import { formatBackground } from "./wish";

const SIZE = 48;
/** Pixels in from each edge that count as "edge". */
const RING = 3;
/** Share of the ring one colour needs before the background is called flat. */
const FLAT_SHARE = 0.45;
/**
 * How far apart (largest channel difference, 0-255) two sides must be before
 * the card becomes a gradient. Below this the eye reads them as one colour.
 */
const GRADIENT_SPLIT = 24;
/**
 * Share of the whole ring one colour needs to rule a gradient out. Higher than
 * FLAT_SHARE: a product running off one edge still leaves most of the ring
 * backdrop, but a backdrop split into two tones leaves neither near this.
 */
const RING_SOLID_SHARE = 0.75;
/** Share of one side one colour needs for that side to count as a colour. */
const SIDE_SHARE = 0.6;
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
    return edgeBackground(data, info.width, info.height);
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

/**
 * RGBA pixels in; "#rrggbb", or a gradient of the sides' colours (see
 * normalizeBackground in lib/wish.ts) when they differ, out.
 */
export function edgeBackground(
  data: Uint8Array,
  width: number,
  height: number
): string | undefined {
  const whole = edgeColor(data, width, height);
  if (!whole) return undefined;
  // Mostly one colour all the way round is a flat backdrop — even with the
  // product running off one edge, which is not a colour to carry across.
  if (edgeColor(data, width, height, undefined, RING_SOLID_SHARE)) return whole;

  // Only a side that is itself one colour counts. One that shades along its
  // length (the sides of a top-to-bottom sweep) is left empty, and the gradient
  // runs between the sides that did.
  const sides = [
    (_x: number, y: number) => y < RING,
    (x: number) => x >= width - RING,
    (_x: number, y: number) => y >= height - RING,
    (x: number) => x < RING,
  ].map((onSide) => edgeColor(data, width, height, onSide, SIDE_SHARE));

  // Each side's colour sits at the middle of that side.
  const at = [
    { x: 50, y: 0 },
    { x: 100, y: 50 },
    { x: 50, y: 100 },
    { x: 0, y: 50 },
  ];
  const points = sides.flatMap((color, i) => (color ? [{ color, ...at[i] }] : []));
  if (points.length < 2) return whole;
  const rgb = (hexColor: string) => [1, 3, 5].map((i) => parseInt(hexColor.slice(i, i + 2), 16));
  const values = points.map((p) => rgb(p.color));
  const split = values.some((a) =>
    values.some((b) => a.some((channel, i) => Math.abs(channel - b[i]) > GRADIENT_SPLIT))
  );
  return split ? formatBackground(points) : whole;
}

/**
 * RGBA pixels in, "#rrggbb" out: the colour of the ring around the edge, or of
 * just the part of it `onSide` picks. Exported for testing against raw pixel data.
 */
export function edgeColor(
  data: Uint8Array,
  width: number,
  height: number,
  onSide?: (x: number, y: number) => boolean,
  /** Give up, rather than averaging, unless one colour covers this share of it. */
  minShare?: number
): string | undefined {
  const buckets = new Map<number, Bucket>();
  const all: Bucket = { n: 0, r: 0, g: 0, b: 0 };
  let ring = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= RING && x < width - RING && y >= RING && y < height - RING;
      if (inside || (onSide && !onSide(x, y))) continue;
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

  const share = flat.n / all.n;
  if (minShare !== undefined) return share >= minShare ? hex(flat) : undefined;
  return hex(share >= FLAT_SHARE ? flat : all);
}

function hex({ n, r, g, b }: Bucket): string {
  const channel = (sum: number) => Math.round(sum / n).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
