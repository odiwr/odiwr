// Builds the spinning CD at the top of the README: .github/cd.svg, beside the
// text on a computer, and .github/cd-phone.svg, full width above it on a phone.
// The README picks between them by screen width.
//
//   npm run readme:cd                                the disc printed matte black
//   npm run readme:cd -- <cover>                     the disc printed with a cover
//   npm run readme:cd -- <cover> --dust <picture>    and your own dust on it
//
// <cover> and <picture> are links (https://…) or file paths. They are
// downloaded and written INTO the SVG, because GitHub shows README images as
// plain pictures, and a picture cannot load anything from anywhere else — a
// link left in the SVG would show nothing.
//
// The dust is a photo, not drawn. Without --dust it is scripts/cd-dust.png: a
// 120 mm patch, at real scale, of the dust scan "Surface Imperfections 015"
// from ambientCG (ambientcg.com/a/SurfaceImperfections015, CC0), with only the
// specks that catch the light kept. With --dust, give a photo of dust and
// scratches on a disc: light marks on black, with the disc's outer edge and
// its centre hole showing as rings. The script finds both rings, all the way
// round, and stretches the photo so they sit exactly on this disc's edge and
// hole. That step needs sharp, so run `npm install` once first.
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
// disc were tilting a little. The dust and scratches turn with the disc and
// show most as they pass through the light.
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
const OUT_PHONE = join(root, ".github/cd-phone.svg");
const DUST = join(root, "scripts/cd-dust.png");

const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif`;
const W = 240;
/** Height of the picture. The artists' line sits 12 px from its bottom. */
const H = 300;
/**
 * Width the README shows the disc at on a computer, in px. Small enough that
 * the text and all three buttons fit beside it on GitHub's narrowest
 * two-column profile. If this or H changes, .github/gap.svg (the spacer that
 * lines the buttons up with the artists' line) needs a new height.
 */
const SHOW = 200;
/** On a phone: the width the picture is drawn across, and its stated size. */
const PHONE_VIEW = 360;
const PHONE_SIZE = 1080;
/** Space under the artists on a phone, before the README's text. */
const PHONE_ROOM = 18;
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

/** The bytes of a link or a file. */
async function load(source, what) {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Couldn't download the ${what} (${res.status})`);
    return { bytes: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type")?.split(";")[0] };
  }
  return { bytes: await readFile(source) };
}

const dataUri = (bytes, type) => `data:${type};base64,${bytes.toString("base64")}`;

async function cover(source) {
  if (!source) return null;
  let { bytes, type } = await load(source, "cover");
  if (!type || !type.startsWith("image/")) {
    type = /\.png$/i.test(source) ? "image/png" : /\.webp$/i.test(source) ? "image/webp" : "image/jpeg";
  }
  return dataUri(bytes, type);
}

/** Where the dust photo's two rings go on this disc: just inside the edge, just outside the hole. */
const EDGE_AT = R - 1;
const HOLE_AT = HOLE + 1.2;
/** Pixels per px of the disc in the finished dust picture. */
const DUST_SCALE = 2;

/**
 * The dust, as a picture whose brightness is how much dust there is: black
 * for none. Used as a mask, so the dust shows as light catching on it.
 */
async function dust(source) {
  if (!source) return dataUri(await readFile(DUST), "image/png");
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    throw new Error("Lining up a dust picture needs sharp. Run `npm install` once, then this again.");
  }
  const { bytes } = await load(source, "dust picture");

  // The photo in grey, and a softened copy to find the rings in.
  const grey = await sharp(bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = grey.info;
  const soft = await sharp(bytes).greyscale().blur(Math.max(0.8, Math.min(w, h) / 450)).raw().toBuffer();
  const sampler = (data) => (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) return 0;
    const fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return (data[i] * (1 - fx) + data[i + 1] * fx) * (1 - fy) + (data[i + w] * (1 - fx) + data[i + w + 1] * fx) * fy;
  };
  const sharpAt = sampler(grey.data);
  const softAt = sampler(soft);

  // 1. Each ring as a circle: the one that is brightest against just inside
  //    and just outside it. Searched coarse, then fine.
  const size = Math.min(w, h);
  const unit = size / 360; // searches step in the same share of the picture at any size
  const round = (cx, cy, r, n = 180) => {
    let s = 0;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * Math.PI;
      s += softAt(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    return s / n;
  };
  const ringScore = (cx, cy, r) => round(cx, cy, r) - (round(cx, cy, r - 3 * unit) + round(cx, cy, r + 3 * unit)) / 2;
  const search = (cx0, cy0, span, step, r0, r1, rStep) => {
    let best = { score: -Infinity };
    for (let cy = cy0 - span; cy <= cy0 + span; cy += step)
      for (let cx = cx0 - span; cx <= cx0 + span; cx += step)
        for (let r = r0; r <= r1; r += rStep) {
          // Keep the ring, and the circles either side of it, inside the picture.
          const reach = r + 3 * unit + 1;
          if (cx - reach < 0 || cy - reach < 0 || cx + reach > w - 1 || cy + reach > h - 1) continue;
          const score = ringScore(cx, cy, r);
          if (score > best.score) best = { score, cx, cy, r };
        }
    return best;
  };
  let edge = search(w / 2, h / 2, size * 0.08, 2 * unit, size * 0.3, size * 0.5, unit);
  edge = search(edge.cx, edge.cy, 2 * unit, unit / 4, edge.r - 2 * unit, edge.r + 2 * unit, unit / 4);
  let hole = search(edge.cx, edge.cy, size * 0.04, unit, size * 0.03, edge.r * 0.35, unit / 2);
  hole = search(hole.cx, hole.cy, 1.5 * unit, unit / 4, hole.r - 1.5 * unit, hole.r + 1.5 * unit, unit / 4);

  // 2. A photo is rarely square on, so each ring's radius is found again at
  //    every angle round the edge's centre, then smoothed so a speck next to
  //    a ring can't pull it.
  const A = 720;
  const cx = edge.cx, cy = edge.cy;
  const trace = (guess) => {
    const radii = [];
    for (let k = 0; k < A; k++) {
      const a = (k / A) * 2 * Math.PI;
      const g = guess(a);
      const reach = Math.max(4 * unit, g * 0.04);
      let best = g, bright = -Infinity;
      for (let r = g - reach; r <= g + reach; r += unit / 4) {
        const v = softAt(cx + r * Math.cos(a), cy + r * Math.sin(a));
        if (v > bright) [bright, best] = [v, r];
      }
      radii.push(best);
    }
    const around = (list, half, pick) => list.map((_, k) => pick(Array.from({ length: half * 2 + 1 }, (_, j) => list[(k - half + j + A) % A])));
    const median = (xs) => xs.sort((p, q) => p - q)[xs.length >> 1];
    const mean = (xs) => xs.reduce((p, q) => p + q, 0) / xs.length;
    return around(around(radii, 9, median), 15, mean);
  };
  const edgeR = trace(() => edge.r);
  // The hole's ring, measured from the edge's centre, which it may sit off.
  const dx = hole.cx - cx, dy = hole.cy - cy;
  const holeR = trace((a) => {
    const along = dx * Math.cos(a) + dy * Math.sin(a);
    return along + Math.sqrt(Math.max(0, hole.r ** 2 - (dx * dx + dy * dy) + along * along));
  });
  const radiusAt = (list, a) => {
    const t = (((a / (2 * Math.PI)) * A) % A + A) % A;
    const k = Math.floor(t);
    return list[k] + (list[(k + 1) % A] - list[k]) * (t - k);
  };

  // 3. Redraw it onto this disc: for every pixel, the same angle, and a
  //    radius that puts the hole's ring at HOLE_AT and the edge's at EDGE_AT.
  const N = Math.round(R * 2 * DUST_SCALE);
  const out = new Float64Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const px = (x + 0.5) / DUST_SCALE - R, py = (y + 0.5) / DUST_SCALE - R;
      const d = Math.hypot(px, py);
      if (d > R || d < HOLE) continue;
      const a = Math.atan2(py, px);
      const inner = radiusAt(holeR, a), outer = radiusAt(edgeR, a);
      const rho = inner + ((d - HOLE_AT) * (outer - inner)) / (EDGE_AT - HOLE_AT);
      out[y * N + x] = sharpAt(cx + rho * Math.cos(a), cy + rho * Math.sin(a));
    }

  // 4. Only what stands out from the black is dust: the bare disc goes to
  //    nothing, the brightest marks to full.
  const lit = Float64Array.from(out.filter((v) => v > 0)).sort();
  const q = (p) => lit[Math.floor(p * (lit.length - 1))];
  const low = q(0.55), high = Math.max(q(0.997), low + 1);
  const mask = Buffer.alloc(N * N);
  for (let i = 0; i < out.length; i++) mask[i] = Math.round(255 * Math.min(1, Math.max(0, (out[i] - low) / (high - low))) ** 0.75);
  const png = await sharp(mask, { raw: { width: N, height: N, channels: 1 } })
    .toColourspace("b-w")
    .png({ compressionLevel: 9 })
    .toBuffer();
  console.log(
    `Dust lined up: edge ring r ${f(edge.r)} at (${f(cx)}, ${f(cy)}), hole ring r ${f(hole.r)} at (${f(hole.cx)}, ${f(hole.cy)})`
  );
  return dataUri(png, "image/png");
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

const args = process.argv.slice(2);
const dustAt = args.indexOf("--dust");
const dustSource = dustAt >= 0 ? args.splice(dustAt, 2)[1] : null;
if (dustAt >= 0 && !dustSource) throw new Error("--dust needs a picture: a link or a file.");
const art = await cover(args[0]);
const dustPicture = await dust(dustSource);

// The dust, as light on the disc. Drawn with the faint shadow each speck
// casts, which is what shows it on light print; then light everywhere; then
// again, brighter, where the light falls.
const dustLight = (opacity, fill = "#fff") =>
  `<rect x="${C - R}" y="${C - R}" width="${R * 2}" height="${R * 2}" fill="${fill}" fill-opacity="${opacity}" mask="url(#dust)"/>`;

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

const body = `<style>
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
  <mask id="dust" maskUnits="userSpaceOnUse" x="${C - R}" y="${C - R}" width="${R * 2}" height="${R * 2}">
    <image href="${dustPicture}" x="${C - R}" y="${C - R}" width="${R * 2}" height="${R * 2}"/>
  </mask>
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
    <!-- Dust and scratches, faintly everywhere. -->
    <g transform="translate(.35 .35)">${dustLight(0.28, "#000")}</g>
    ${dustLight(0.6)}
  </g>

  <!-- The same dust, bright where the light catches it. Turns in step with the disc. -->
  <g mask="url(#glint)"><g class="spin">${dustLight(0.95)}</g></g>

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
<text class="artists" x="${C}" y="${H - 12}" font-size="13" text-anchor="middle">${escape(ARTISTS)}</text>`;

const open = (width, viewWidth, viewHeight) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${f(
    (width * viewHeight) / viewWidth
  )}" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-labelledby="t">
<title id="t">${escape(TITLE)}, by ${escape(ARTISTS)}</title>`;

// Computers: the disc beside the text, SHOW px wide.
const computer = `${open(SHOW, W, H)}
${body}
</svg>
`;

// Phones: the same disc centred in a wider picture, with room under the
// artists before the text starts. Its size is set far larger than any phone,
// so GitHub shrinks it to the full width of the README and the text drops
// below it instead of being squeezed beside it.
const phone = `${open(PHONE_SIZE, PHONE_VIEW, H + PHONE_ROOM)}
<svg x="${(PHONE_VIEW - W) / 2}" y="0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${body}
</svg>
</svg>
`;

await writeFile(OUT, computer);
await writeFile(OUT_PHONE, phone);
console.log(`Wrote ${OUT} and ${OUT_PHONE}${art ? " with the cover" : " (no cover)"}`);
