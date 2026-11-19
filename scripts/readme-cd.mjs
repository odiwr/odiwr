// Builds .github/cd.svg, the spinning CD at the top of the README.
//
//   npm run readme:cd                      a plain silver disc, no artwork
//   npm run readme:cd -- <cover>           the disc printed with a cover
//
// <cover> is a link (https://…) or a file path. It is downloaded and written
// INTO the SVG, because GitHub shows README images as plain pictures, and a
// picture cannot load anything from anywhere else — a link left in the SVG
// would show nothing.
//
// The song under the disc is set just below.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TITLE = "Broken Hearts";
const ARTISTS = "Skepta, Central Cee, Jorja Smith";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, ".github/cd.svg");

const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif`;
const MONO = `ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace`;
const W = 240;
const CX = 120;
const CY = 116;
const R = 108;

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The cover as a data: URI, or null for none. */
async function cover(source) {
  if (!source) return null;
  let bytes;
  let type;
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Couldn't download the cover (${res.status})`);
    bytes = Buffer.from(await res.arrayBuffer());
    type = res.headers.get("content-type")?.split(";")[0];
  } else {
    bytes = await readFile(source);
  }
  if (!type || !type.startsWith("image/")) {
    type = /\.png$/i.test(source) ? "image/png" : /\.webp$/i.test(source) ? "image/webp" : "image/jpeg";
  }
  return `data:${type};base64,${bytes.toString("base64")}`;
}

const art = await cover(process.argv[2]);

const grooves = Array.from({ length: 22 }, (_, i) => {
  const r = 52 + i * 2.5;
  return `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="#000" stroke-opacity="${i % 3 ? 0.035 : 0.06}" stroke-width=".6"/>`;
}).join("");

// With a cover, the cover is the face. Without one, a silver disc with the
// song printed round its label, so the turning still shows.
const face = art
  ? `<image href="${art}" x="${CX - R}" y="${CY - R}" width="${R * 2}" height="${R * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#disc)"/>
    ${grooves}`
  : `<circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#silver)"/>
    ${grooves}
    <circle cx="${CX}" cy="${CY}" r="47" fill="#1f2328"/>
    <circle cx="${CX}" cy="${CY}" r="47" fill="none" stroke="#fff" stroke-opacity=".12"/>
    <text class="ring" font-size="7" fill="#f0f6fc" fill-opacity=".9"><textPath href="#ring" textLength="${(2 * Math.PI * 37).toFixed(1)}" lengthAdjust="spacing">${escape(
      [TITLE, ...ARTISTS.split(", ")].join(" · ").toUpperCase()
    )} · </textPath></text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="292" viewBox="0 0 ${W} 292" role="img" aria-labelledby="t">
<title id="t">${escape(TITLE)}, by ${escape(ARTISTS)}</title>
<style>
text{font-family:${SANS}}.ring{font-family:${MONO}}
.spin{transform-origin:${CX}px ${CY}px;animation:spin 3.2s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.title{fill:#1f2328}.artists{fill:#59636e}
@media (prefers-color-scheme:dark){.title{fill:#f0f6fc}.artists{fill:#9198a1}}
@media (prefers-reduced-motion:reduce){.spin{animation:none}}
</style>
<defs>
  <radialGradient id="silver" cx="50%" cy="50%" r="50%">
    <stop offset=".45" stop-color="#d7dde4"/><stop offset=".7" stop-color="#eef1f5"/><stop offset=".92" stop-color="#c3cbd4"/><stop offset="1" stop-color="#aab4bf"/>
  </radialGradient>
  <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7dd3fc" stop-opacity="0"/>
    <stop offset=".35" stop-color="#a78bfa" stop-opacity="${art ? 0.18 : 0.35}"/>
    <stop offset=".5" stop-color="#f9a8d4" stop-opacity="${art ? 0.2 : 0.4}"/>
    <stop offset=".65" stop-color="#fde68a" stop-opacity="${art ? 0.18 : 0.35}"/>
    <stop offset="1" stop-color="#86efac" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="glare" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="disc"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
  <mask id="hole"><circle cx="${CX}" cy="${CY}" r="${R}" fill="#fff"/><circle cx="${CX}" cy="${CY}" r="11" fill="#000"/></mask>
  <path id="ring" d="M ${CX} ${CY} m -37 0 a 37 37 0 1 1 74 0 a 37 37 0 1 1 -74 0"/>
</defs>
<g mask="url(#hole)">
  <g class="spin">
    ${face}
    <circle cx="${CX}" cy="${CY}" r="20" fill="#e6ebf1" fill-opacity=".55"/>
  </g>
  <!-- The light on it stays put while it turns, as on a real disc. -->
  <path d="M ${CX} ${CY} L ${CX - 70} ${CY - 82} A ${R} ${R} 0 0 1 ${CX - 10} ${CY - R} Z" fill="url(#rainbow)"/>
  <path d="M ${CX} ${CY} L ${CX + 70} ${CY + 82} A ${R} ${R} 0 0 1 ${CX + 10} ${CY + R} Z" fill="url(#rainbow)"/>
  <path d="M ${CX} ${CY} L ${CX - 104} ${CY + 28} A ${R} ${R} 0 0 0 ${CX - 92} ${CY + 56} Z" fill="url(#glare)" opacity=".5"/>
  <circle cx="${CX}" cy="${CY}" r="${R - 0.5}" fill="none" stroke="#8c959f" stroke-opacity=".6"/>
  <circle cx="${CX}" cy="${CY}" r="11.5" fill="none" stroke="#8c959f" stroke-opacity=".6"/>
</g>
<text class="title" x="${CX}" y="256" font-size="16" font-weight="600" text-anchor="middle">${escape(TITLE)}</text>
<text class="artists" x="${CX}" y="279" font-size="13" text-anchor="middle">${escape(ARTISTS)}</text>
</svg>
`;

await writeFile(OUT, svg);
console.log(`Wrote ${OUT}${art ? " with the cover" : " (no cover)"}`);
