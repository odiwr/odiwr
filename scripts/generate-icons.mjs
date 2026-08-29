// Generates every raster icon from the one source SVG.
//
// Run with `npm run icons`. Committed rather than done by hand so the whole set
// can be regenerated from a new drawing without anyone having to remember which
// sizes exist or what background they sat on.
//
// Every icon is rendered on a TRANSPARENT tile, by request, and the artwork
// fills it edge to edge.
//
// Worth knowing about the trade: the cat's outline and features are near-black
// (#231f20), so against dark browser chrome that linework is now invisible and
// only the orange face carries the shape. That reads fine — the orange IS the
// silhouette at small sizes — but it does mean the icon looks like a solid
// orange blob at 16px rather than a drawn one. A light background is where it
// keeps its detail.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "public/brand/catguy.svg");

/** Fully transparent. The artwork sits on whatever is behind it. */
const TILE = { r: 0, g: 0, b: 0, alpha: 0 };
/**
 * Fraction of the tile the artwork occupies. 1 = edge to edge.
 *
 * The source is 360x288, wider than it is tall, so fitting it into a square
 * still leaves margin above and below even at 1 — the width is what binds.
 */
const INSET = 1;

/**
 * Renders the artwork centred on a square tile.
 *
 * The SVG is rasterised at high density first and resized down, rather than
 * rendered straight to the target size — sharp rasterises at the density given,
 * so rendering a 16px icon directly produces 16px of detail and then nothing to
 * downsample from. Going via a large render keeps the small sizes clean.
 */
async function tile(size) {
  const inner = Math.round(size * INSET);
  const art = await sharp(await readFile(SOURCE), { density: 1200 })
    .resize({ width: inner, height: inner, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const { width, height } = await sharp(art).metadata();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: TILE,
    },
  })
    .composite([{ input: art, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    .png();
}

async function write(path, pipeline) {
  await mkdir(dirname(path), { recursive: true });
  await pipeline.toFile(path);
  console.log("  " + path.replace(root + "\\", "").replace(root + "/", ""));
}

console.log("icons:");

// Next's app-directory conventions: these are picked up automatically and the
// <link> tags are emitted for us, so there is no head markup to keep in sync.
await write(join(root, "src/app/apple-icon.png"), await tile(180));
await write(join(root, "src/app/icon.png"), await tile(512));

// The classic set, for anything that goes looking for these paths by name and
// for the web manifest.
for (const size of [16, 32, 48, 192, 512]) {
  await write(join(root, `public/icons/icon-${size}x${size}.png`), await tile(size));
}
await write(join(root, "public/icons/apple-touch-icon.png"), await tile(180));

// favicon.ico carries 16/32/48 in one file: Windows and older browsers pick the
// size they want out of it rather than scaling one badly.
const icoSizes = await Promise.all([16, 32, 48].map(async (s) => (await tile(s)).toBuffer()));
await mkdir(join(root, "src/app"), { recursive: true });
await writeFile(join(root, "src/app/favicon.ico"), await pngToIco(icoSizes));
console.log("  src/app/favicon.ico (16, 32, 48)");

// A vector icon for browsers that prefer one. Transparent like the rasters, and
// cropped to the artwork's own box so it scales without baked-in margin.
const svg = await readFile(SOURCE, "utf8");
const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 360 288";
const [, , vw, vh] = viewBox.split(/\s+/).map(Number);
const side = Math.max(vw, vh);
const inner = svg
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");
await writeFile(
  join(root, "src/app/icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}">
  <g transform="translate(${(side - vw) / 2} ${(side - vh) / 2})">${inner}</g>
</svg>
`
);
console.log("  src/app/icon.svg");
