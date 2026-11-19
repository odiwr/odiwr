// Builds .github/cd.svg, the spinning CD at the top of the README.
//
//   npm run readme:cd                      the disc printed matte black
//   npm run readme:cd -- <cover>           the disc printed with a cover
//
// <cover> is a link (https://…) or a file path. It is downloaded and written
// INTO the SVG, because GitHub shows README images as plain pictures, and a
// picture cannot load anything from anywhere else — a link left in the SVG
// would show nothing.
//
// Built the way a real disc is, from the centre out, at real proportions
// (120 mm across, 15 mm hole):
//
//   hole          r 0 – 7.5 mm       cut out; the page shows through
//   clear hub     r 7.5 – 16.7 mm    see-through plastic, with the raised stacking ring
//   mirror band   r 16.7 – 20 mm     bare metal layer, where the rainbow shows
//   print         r 20 – 59 mm       the cover, with the fine print round its edge
//   clear rim     r 59 – 60 mm       unprinted polycarbonate edge
//
// The light does not turn with the disc. On a real CD the rainbow and the
// shine stay where the light is while the disc spins under them; only a
// change of angle moves them, which the light here does slowly, as if the
// disc were tilting a little. Scratches and dust turn with the disc and show
// most as they pass through the light.
//
// The song is set just below.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TITLE = "Broken Hearts";
const ARTISTS = "Skepta, Central Cee, Jorja Smith";
/** Round the edge of the print, in tiny type, as on a real disc. */
const FINE_PRINT =
  "Broken Hearts · Skepta feat. Central Cee & Jorja Smith · from The Fork and Knife · " +
  "℗ 2026 Big Smoke Records under exclusive licence to Epic Records · All rights reserved. " +
  "Unauthorised copying, public performance and broadcasting of this recording prohibited. · ";
/** Moulded into the metal band near the centre. */
const HUB_TEXT = "ODIWR · 因为热爱 · 2026 · ";

/** Seconds a turn takes. */
const TURN = 12;
/** Seconds the light takes to drift there and back. */
const DRIFT = 14;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, ".github/cd.svg");

const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif`;
const W = 240;
const H = 300;
const C = 118; // centre, x and y
const MM = 1.8; // px per mm: 60 mm radius → 108 px
const r = (mm) => +(mm * MM).toFixed(2);
const R = r(60);
const HOLE = r(7.5);
const HUB = r(16.7);
const BAND = r(20);
const PRINT = r(59);

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f = (n) => +n.toFixed(2);

/** A full circle as a path, starting at the top, for text to run along. */
const ringPath = (id, radius) =>
  `<path id="${id}" d="M ${C} ${f(C - radius)} a ${radius} ${radius} 0 1 1 0 ${f(radius * 2)} a ${radius} ${radius} 0 1 1 0 ${f(-radius * 2)}"/>`;

/** An annulus as a mask: white between the radii. */
const annulus = (id, inner, outer) =>
  `<mask id="${id}"><circle cx="${C}" cy="${C}" r="${outer}" fill="#fff"/><circle cx="${C}" cy="${C}" r="${inner}" fill="#000"/></mask>`;

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

/** Deterministic randomness, so rebuilding gives the same dust. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wear() {
  const rand = seeded(11);
  const at = (radius, angle) => [f(C + radius * Math.cos(angle)), f(C + radius * Math.sin(angle))];
  const dust = [];
  for (let i = 0; i < 160; i++) {
    const [x, y] = at(HOLE + 3 + rand() * (R - HOLE - 4), rand() * Math.PI * 2);
    const dark = rand() < 0.25;
    dust.push(
      `<circle cx="${x}" cy="${y}" r="${f(0.15 + rand() ** 2 * 0.5)}" fill="${dark ? "#000" : "#fff"}" fill-opacity="${f(
        dark ? 0.2 + rand() * 0.2 : 0.25 + rand() * 0.45
      )}"/>`
    );
  }
  // A few fibres: short curls.
  for (let i = 0; i < 4; i++) {
    const [x, y] = at(BAND + rand() * (PRINT - BAND - 6), rand() * Math.PI * 2);
    const dx = 3 + rand() * 6;
    dust.push(
      `<path d="M ${x} ${y} q ${f(dx / 2)} ${f(-2 + rand() * 4)} ${f(dx)} ${f(-1 + rand() * 2)} t ${f(dx * 0.6)} ${f(-1 + rand() * 2)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".22"/>`
    );
  }
  // Scratches: mostly round the disc, the way handling and drawers make them.
  const scratches = [];
  for (let i = 0; i < 34; i++) {
    const radius = HUB + 2 + rand() * (R - HUB - 4);
    const start = rand() * Math.PI * 2;
    const sweep = (6 + rand() * 32) * (Math.PI / 180);
    const [x1, y1] = at(radius, start);
    const [x2, y2] = at(radius + (rand() - 0.5) * 2, start + sweep);
    scratches.push(
      `<path d="M ${x1} ${y1} A ${f(radius)} ${f(radius)} 0 0 1 ${x2} ${y2}" fill="none" stroke="#fff" stroke-width="${f(
        0.15 + rand() * 0.2
      )}"/>`
    );
  }
  // And a couple straight across.
  for (let i = 0; i < 3; i++) {
    const [x, y] = at(BAND + rand() * 60, rand() * Math.PI * 2);
    const a = rand() * Math.PI;
    const len = 8 + rand() * 18;
    scratches.push(
      `<path d="M ${x} ${y} l ${f(Math.cos(a) * len)} ${f(Math.sin(a) * len)}" fill="none" stroke="#fff" stroke-width=".18"/>`
    );
  }
  return { dust: dust.join(""), scratches: scratches.join("") };
}

/**
 * The rainbow on the mirror band: diffraction, which sits where the light is.
 * Two opposite streaks, as a single light makes, each a smooth run of hues in
 * thin slices, softened so no slice shows.
 */
function rainbow() {
  const out = [];
  const p = (a, rad) => `${f(C + rad * Math.cos(a))} ${f(C + rad * Math.sin(a))}`;
  for (const centre of [-35, 145]) {
    const span = 56;
    const steps = 28;
    for (let i = 0; i < steps; i++) {
      const a0 = ((centre - span / 2 + (i * span) / steps) * Math.PI) / 180;
      const a1 = ((centre - span / 2 + ((i + 1.15) * span) / steps) * Math.PI) / 180;
      const t = i / (steps - 1);
      const hue = Math.round(t * 300);
      // Fades in and out at the ends of the streak.
      const alpha = f(Math.sin(t * Math.PI) ** 1.5);
      out.push(
        `<path d="M ${C} ${C} L ${p(a0, BAND + 2)} A ${BAND + 2} ${BAND + 2} 0 0 1 ${p(a1, BAND + 2)} Z" fill="hsl(${hue} 90% 62%)" fill-opacity="${alpha}"/>`
      );
    }
  }
  return out.join("");
}

const art = await cover(process.argv[2]);
const { dust, scratches } = wear();

// The print: the cover, or matte black.
const print = art
  ? `<use href="#art"/>`
  : `<circle cx="${C}" cy="${C}" r="${PRINT}" fill="#141414"/>`;

// The fine print. Over a cover, each letter takes the opposite of whatever is
// under it — light on dark, dark on light — with a little of the cover's own
// colour in it, so it reads everywhere and still belongs to the print.
const finePrint = `<text font-size="3.3" letter-spacing=".05"><textPath href="#edge" textLength="${f(
  2 * Math.PI * (PRINT - 4.2) - 2
)}" lengthAdjust="spacing">${escape(FINE_PRINT)}</textPath></text>`;
const fineLayer = art
  ? `<mask id="ink">${finePrint.replace("<text ", '<text fill="#fff" ')}</mask>`
  : "";
const fineText = art
  ? `<g mask="url(#ink)"><use href="#art" filter="url(#contrast)"/></g>`
  : finePrint.replace("<text ", '<text fill="#f0f6fc" fill-opacity=".72" ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">${escape(TITLE)}, by ${escape(ARTISTS)}</title>
<style>
text{font-family:${SANS}}
.spin{transform-origin:${C}px ${C}px;animation:spin ${TURN}s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.tilt{transform-origin:${C}px ${C}px;animation:tilt ${DRIFT}s ease-in-out infinite}
@keyframes tilt{0%,100%{transform:rotate(-16deg);opacity:.78}50%{transform:rotate(14deg);opacity:1}}
.title{fill:#1f2328}.artists{fill:#59636e}
@media (prefers-color-scheme:dark){.title{fill:#f0f6fc}.artists{fill:#9198a1}}
@media (prefers-reduced-motion:reduce){.spin,.tilt{animation:none}}
</style>
<defs>
  ${art ? `<image id="art" href="${art}" x="${C - PRINT}" y="${C - PRINT}" width="${PRINT * 2}" height="${PRINT * 2}" preserveAspectRatio="xMidYMid slice"/>` : ""}
  ${ringPath("edge", PRINT - 4.2)}
  ${ringPath("hubring", BAND - 2.2)}
  <mask id="disc"><circle cx="${C}" cy="${C}" r="${R}" fill="#fff"/><circle cx="${C}" cy="${C}" r="${HOLE}" fill="#000"/></mask>
  ${annulus("printArea", BAND, PRINT)}
  ${annulus("bandArea", HUB, BAND)}
  ${annulus("hubArea", HOLE, HUB)}
  ${annulus("rimArea", PRINT, R)}
  ${fineLayer}
  <filter id="contrast" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values=".2126 .7152 .0722 0 0  .2126 .7152 .0722 0 0  .2126 .7152 .0722 0 0  0 0 0 1 0" result="grey"/>
    <feComponentTransfer in="grey" result="opposite">
      <feFuncR type="discrete" tableValues=".97 .97 .08 .08"/>
      <feFuncG type="discrete" tableValues=".97 .97 .08 .08"/>
      <feFuncB type="discrete" tableValues=".97 .97 .08 .08"/>
    </feComponentTransfer>
    <feComposite in="opposite" in2="SourceGraphic" operator="arithmetic" k2=".82" k3=".18"/>
  </filter>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="soft"><feGaussianBlur stdDeviation=".7"/></filter>
  <radialGradient id="metal" cx="${C}" cy="${C}" r="${BAND}" gradientUnits="userSpaceOnUse">
    <stop offset="${f(HUB / BAND)}" stop-color="#b7bec6"/><stop offset="${f((HUB + 2) / BAND)}" stop-color="#e9ecef"/>
    <stop offset=".93" stop-color="#cdd3d9"/><stop offset="1" stop-color="#9aa3ad"/>
  </radialGradient>
  <radialGradient id="printShade" cx="${C}" cy="${C}" r="${PRINT}" gradientUnits="userSpaceOnUse">
    <stop offset="${f(BAND / PRINT)}" stop-color="#000" stop-opacity=".35"/><stop offset="${f((BAND + 4) / PRINT)}" stop-color="#000" stop-opacity="0"/>
    <stop offset=".93" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/>
  </radialGradient>
  <radialGradient id="clear" cx="${C}" cy="${C}" r="${HUB}" gradientUnits="userSpaceOnUse">
    <stop offset="${f(HOLE / HUB)}" stop-color="#fff" stop-opacity=".55"/><stop offset=".7" stop-color="#e6eaee" stop-opacity=".35"/><stop offset="1" stop-color="#c9d0d6" stop-opacity=".55"/>
  </radialGradient>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
    <stop offset=".18" stop-color="#fff" stop-opacity="0"/><stop offset=".34" stop-color="#fff" stop-opacity=".2"/>
    <stop offset=".4" stop-color="#fff" stop-opacity=".05"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".74" stop-color="#fff" stop-opacity=".1"/><stop offset=".82" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="edgeLight" x1="0" y1="0" x2="1" y2="1">
    <stop offset=".1" stop-color="#fff" stop-opacity=".95"/><stop offset=".32" stop-color="#fff" stop-opacity=".15"/>
    <stop offset=".68" stop-color="#fff" stop-opacity=".1"/><stop offset=".9" stop-color="#fff" stop-opacity=".8"/>
  </linearGradient>
  <!-- Where the light falls, for the scratches to glint in. -->
  <radialGradient id="glintSpot" cx=".32" cy=".3" r=".42">
    <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <mask id="glint"><rect x="0" y="0" width="${W}" height="${W}" fill="url(#glintSpot)"/></mask>
</defs>

<!-- The shadow it casts. -->
<ellipse cx="${C + 2}" cy="${C + 5}" rx="${R - 2}" ry="${R - 2}" fill="#000" fill-opacity=".1" filter="url(#shadow)"/>

<g mask="url(#disc)">
  <g class="spin">
    <!-- Clear rim: the polycarbonate past the print. -->
    <circle cx="${C}" cy="${C}" r="${R}" fill="#c9d0d6" fill-opacity=".85"/>
    <!-- Print. -->
    <g mask="url(#printArea)">
      ${print}
      <circle cx="${C}" cy="${C}" r="${PRINT}" fill="url(#printShade)"/>
      ${fineText}
    </g>
    <!-- Mirror band, with its moulded text. -->
    <g mask="url(#bandArea)">
      <circle cx="${C}" cy="${C}" r="${BAND}" fill="url(#metal)"/>
      <text font-size="2.6" letter-spacing=".4" fill="#6e7781" fill-opacity=".55"><textPath href="#hubring" textLength="${f(
        2 * Math.PI * (BAND - 2.2) - 1
      )}" lengthAdjust="spacing">${escape(HUB_TEXT.repeat(2))}</textPath></text>
    </g>
    <!-- Clear hub, the page faintly through it, and the stacking ring. -->
    <g mask="url(#hubArea)">
      <circle cx="${C}" cy="${C}" r="${HUB}" fill="url(#clear)"/>
      <circle cx="${C}" cy="${C}" r="${f(HUB - 1.6)}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".9"/>
      <circle cx="${C}" cy="${C}" r="${f(HUB - 0.7)}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width=".6"/>
      <circle cx="${C}" cy="${C}" r="${f(HOLE + 1.4)}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width=".5"/>
    </g>
    <!-- Edges between the layers. -->
    <circle cx="${C}" cy="${C}" r="${PRINT}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width=".4"/>
    <circle cx="${C}" cy="${C}" r="${BAND}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".4"/>
    <circle cx="${C}" cy="${C}" r="${HUB}" fill="none" stroke="#000" stroke-opacity=".22" stroke-width=".4"/>
    <!-- Wear, faintly everywhere. -->
    <g opacity=".22">${scratches}</g>
    ${dust}
  </g>

  <!-- The same scratches, bright where the light catches them. Turns in step with the disc. -->
  <g mask="url(#glint)"><g class="spin" opacity=".75">${scratches}</g></g>

  <!-- The light. Stays put while the disc turns; drifts as the angle changes. -->
  <g class="tilt">
    <rect x="${C - R}" y="${C - R}" width="${R * 2}" height="${R * 2}" fill="url(#sheen)"/>
    <g mask="url(#bandArea)"><g opacity=".5" filter="url(#soft)">${rainbow()}</g></g>
    <g mask="url(#rimArea)"><circle cx="${C}" cy="${C}" r="${R}" fill="url(#edgeLight)"/></g>
    <circle cx="${C}" cy="${C}" r="${f(HUB - 1.6)}" fill="none" stroke="url(#edgeLight)" stroke-width=".9"/>
  </g>

  <!-- The outer edge itself. -->
  <circle cx="${C}" cy="${C}" r="${f(R - 0.3)}" fill="none" stroke="#6e7781" stroke-opacity=".55" stroke-width=".6"/>
  <circle cx="${C}" cy="${C}" r="${f(HOLE + 0.3)}" fill="none" stroke="#6e7781" stroke-opacity=".5" stroke-width=".6"/>
</g>

<text class="title" x="${C}" y="${H - 34}" font-size="16" font-weight="600" text-anchor="middle">${escape(TITLE)}</text>
<text class="artists" x="${C}" y="${H - 12}" font-size="13" text-anchor="middle">${escape(ARTISTS)}</text>
</svg>
`;

await writeFile(OUT, svg);
console.log(`Wrote ${OUT}${art ? " with the cover" : " (no cover)"}`);
