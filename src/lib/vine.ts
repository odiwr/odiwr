/**
 * The vine on the 404 page. Different every time: everything below is drawn
 * from one random seed.
 *
 * What grows:
 *   - The MAIN VINE, left to right across "404": a slow wave with a smaller
 *     wobble on top, lifting at the end to hold the bloom. Sometimes it throws a
 *     loop-de-loop.
 *   - Up to three SIDE VINES off the main one, wandering out into the empty
 *     space above or below the number. They may loop too.
 *   - FLOWER BRANCHES off any vine, each ending in one flower or bud, sometimes
 *     with one twig of its own ending in another.
 *   - LEAVES along everything, into whatever space is left.
 *
 * The rules:
 *   - No sharp corners, ever. Every line is grown by steering a heading that
 *     only changes gradually, and a branch leaves its vine at a shallow angle
 *     and curves away. A vine turns hard only by looping.
 *   - Vines weave through the number: at each crossing with a digit's stroke
 *     they go in front or behind, alternating, switching in the open space
 *     between crossings. Branches keep the side of the vine they grow from.
 *   - Flowers are never behind the number, and small ones are never on it.
 *   - Every flower has exactly one stem. No other line may pass through a
 *     flower: a flower is only placed where no line runs, and a line that would
 *     run through a flower is cut short or not grown.
 *   - Nothing overlaps a flower: a leaf is not placed if any part of it, from
 *     where it joins to its tip, would touch one.
 *   - Everything stays clear of the text below the number.
 *
 * A flower's space is checked and claimed BEFORE its own stem is added, since
 * afterwards that stem would count as a line running through it.
 *
 * Timing: vines grow at even speed; a side vine or branch starts when its
 * parent reaches the point it grows from; a flower opens when its stem has
 * finished; a leaf appears as its line passes.
 *
 * The digits are in a 640 x 260 box, centred in it. Growth may reach outside the
 * box into the page's empty space; the SVG draws its overflow.
 */

type Pt = { x: number; y: number };
type Sample = Pt & { heading: number };
export type Layer = "front" | "back";

/** "404" as three single strokes. */
export const DIGITS = [
  "M150 222 V40 L40 170 H200",
  "M320 40 A70 90 0 1 1 320 220 A70 90 0 1 1 320 40",
  "M550 222 V40 L440 170 H600",
];

export const VINE_COLORS = {
  stem: { front: "#6a9c5b", back: "#4d7543" },
  leaves: { front: ["#7fb36e", "#5d8a51"], back: ["#5c8550", "#48693f"] },
  /** The site's orange, then a pink and a lavender to go with it. */
  petals: ["#fbaf41", "#f29bb8", "#b9a4f0"],
  center: "#fff1c9",
};

export type Line = { d: string; delay: number; duration: number; width: number; layer: Layer; stem: boolean };
export type Leaf = { x: number; y: number; rotate: number; scale: number; delay: number; fill: string; layer: Layer };
/** Flowers and buds. Always drawn in front of the number. */
export type Tip = { x: number; y: number; rotate: number; size: number; delay: number; kind: "flower" | "bud"; color: string };
export type Vine = { lines: Line[]; leaves: Leaf[]; tips: Tip[]; bloom: { x: number; y: number; delay: number } };

/** Seconds before anything starts, so the page has settled first. */
const START = 0.4;
/** Seconds the main vine takes, left to right. Everything else keeps its pace. */
const MAIN_DURATION = 4.6;
/** Where anything may be. The bottom stops short of the text below. */
const BOUNDS = { left: -10, right: 650, top: -55, bottom: 282 };
/** Half the digits' stroke width. */
const STROKE = 8;
/** Sample spacing for grown lines, in px. */
const STEP = 2;

const round = (n: number) => Math.round(n * 10) / 10;
const seconds = (n: number) => Math.round(n * 100) / 100;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (u: number) => u * u * (3 - 2 * u);
const flowerRadius = (kind: Tip["kind"], size: number) => (kind === "flower" ? 9.5 : 6) * size;

/** A small, fast, seedable random number generator (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Points along the digits' strokes. */
const DIGIT_POINTS: Pt[] = (() => {
  const points: Pt[] = [];
  const line = (a: Pt, b: Pt) => {
    const count = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
    for (let i = 0; i <= count; i++) {
      points.push({ x: a.x + ((b.x - a.x) * i) / count, y: a.y + ((b.y - a.y) * i) / count });
    }
  };
  const four = (stemX: number, left: number, right: number) => {
    line({ x: stemX, y: 222 }, { x: stemX, y: 40 });
    line({ x: stemX, y: 40 }, { x: left, y: 170 });
    line({ x: left, y: 170 }, { x: right, y: 170 });
  };
  four(150, 40, 200);
  four(550, 440, 600);
  for (let a = 0; a < Math.PI * 2; a += 0.01) {
    points.push({ x: 320 + 70 * Math.cos(a), y: 130 + 90 * Math.sin(a) });
  }
  return points;
})();

/** Distance from a point to the nearest digit stroke's centre line, up to `limit`. */
function digitDistance(p: Pt, limit: number): number {
  let best = limit;
  for (const s of DIGIT_POINTS) {
    if (Math.abs(s.x - p.x) >= best || Math.abs(s.y - p.y) >= best) continue;
    best = Math.min(best, Math.hypot(s.x - p.x, s.y - p.y));
  }
  return best;
}

export function growVine(seed: number): Vine {
  const rand = random(seed);
  const between = (a: number, b: number) => a + (b - a) * rand();
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];

  const lines: Line[] = [];
  const leaves: Leaf[] = [];
  const tips: Tip[] = [];

  /** Every flower's space, the bloom included. */
  const flowerSpace: { x: number; y: number; r: number }[] = [];
  /** Every leaf's space. */
  const leafSpace: { x: number; y: number; r: number }[] = [];
  /** Every point of every line grown so far. */
  const linePoints: Pt[] = [];

  const inBounds = (p: Pt, r: number) =>
    p.x - r >= BOUNDS.left && p.x + r <= BOUNDS.right && p.y - r >= BOUNDS.top && p.y + r <= BOUNDS.bottom;

  /** Not within `margin` of any flower. */
  const clearOfFlowers = (p: Pt, margin: number) =>
    flowerSpace.every((f) => Math.hypot(f.x - p.x, f.y - p.y) >= f.r + margin);

  /** Whether a flower of radius r can go at p: nothing under it, no line through it. */
  const flowerFits = (p: Pt, r: number) =>
    inBounds(p, r) &&
    clearOfFlowers(p, r + 2) &&
    leafSpace.every((l) => Math.hypot(l.x - p.x, l.y - p.y) >= l.r + r + 1) &&
    linePoints.every((q) => Math.abs(q.x - p.x) > r + 2 || Math.hypot(q.x - p.x, q.y - p.y) >= r + 2) &&
    digitDistance(p, r + STROKE) >= r + STROKE;

  /**
   * Claims a flower's space and records it, if it fits. Call before adding the
   * flower's own stem. Its delay is filled in once the stem's timing is known.
   */
  const claimFlower = (end: Sample, kind: Tip["kind"], size: number): Tip | null => {
    const r = flowerRadius(kind, size);
    if (!flowerFits(end, r)) return null;
    flowerSpace.push({ x: end.x, y: end.y, r });
    const tip: Tip = {
      x: round(end.x),
      y: round(end.y),
      rotate: Math.round((end.heading * 180) / Math.PI + 90),
      size: Math.round(size * 100) / 100,
      delay: 0,
      kind,
      color: pick(VINE_COLORS.petals),
    };
    tips.push(tip);
    return tip;
  };

  /* ---------------------------------------------------------------- */
  /* Lines                                                             */
  /* ---------------------------------------------------------------- */

  /** Front or behind for each sample, alternating at each crossing. */
  const layersFor = (points: Pt[]): Layer[] => {
    const on = points.map((p) => digitDistance(p, STROKE + 3) < STROKE + 3);
    const crossings: { from: number; to: number }[] = [];
    for (let i = 0; i < points.length; i++) {
      if (!on[i]) continue;
      const from = i;
      while (i + 1 < points.length && on[i + 1]) i++;
      crossings.push({ from, to: i });
    }
    const layers: Layer[] = new Array(points.length).fill("front");
    crossings.forEach((crossing, k) => {
      const layer: Layer = k % 2 === 0 ? "front" : "back";
      const from = k === 0 ? 0 : Math.round((crossings[k - 1].to + crossing.from) / 2);
      const to =
        k === crossings.length - 1 ? points.length - 1 : Math.round((crossing.to + crossings[k + 1].from) / 2);
      for (let i = from; i <= to; i++) layers[i] = layer;
    });
    return layers;
  };

  type Grown = { points: Sample[]; timeAt: (i: number) => number; layers: Layer[]; length: number };

  /** Adds a line to the drawing: split by layer, timed, and made solid for collisions. */
  const commit = (points: Sample[], start: number, speed: number, width: number, stem: boolean, layer?: Layer): Grown => {
    const along = [0];
    for (let i = 1; i < points.length; i++) {
      along.push(along[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    const timeAt = (i: number) => start + along[i] / speed;
    const layers = layer ? points.map(() => layer) : layersFor(points);

    let begin = 0;
    for (let i = 1; i <= points.length; i++) {
      if (i < points.length && layers[i] === layers[begin]) continue;
      // Each piece runs one sample into the next, so the joins do not show.
      const end = Math.min(i, points.length - 1);
      lines.push({
        d: `M${points
          .slice(begin, end + 1)
          .map((p) => `${round(p.x)} ${round(p.y)}`)
          .join(" L")}`,
        delay: seconds(timeAt(begin)),
        duration: seconds(Math.max(0.05, timeAt(end) - timeAt(begin))),
        width,
        layer: layers[begin],
        stem,
      });
      begin = i;
    }

    linePoints.push(...points);
    return { points, timeAt, layers, length: along[along.length - 1] };
  };

  /** Heading at each sample, from its neighbours. */
  const withHeadings = (points: Pt[]): Sample[] =>
    points.map((p, i) => {
      const a = points[Math.max(0, i - 2)];
      const b = points[Math.min(points.length - 1, i + 2)];
      return { ...p, heading: Math.atan2(b.y - a.y, b.x - a.x) };
    });

  /** A gentle curve: starts along `heading` and turns smoothly by `bend`. */
  const curve = (base: Pt, heading: number, length: number, bend: number): Sample[] => {
    const steps = Math.max(2, Math.ceil(length / STEP));
    const points: Sample[] = [{ ...base, heading }];
    let { x, y } = base;
    for (let k = 1; k <= steps; k++) {
      const theta = heading + bend * smooth(k / steps);
      x += (Math.cos(theta) * length) / steps;
      y += (Math.sin(theta) * length) / steps;
      points.push({ x, y, heading: theta });
    }
    return points;
  };

  /**
   * A side vine: heads for `target`, turning no faster than a vine can, with a
   * wiggle and maybe a loop. Stops at the edge of the space or before running
   * into a flower.
   */
  const wander = (base: Pt, heading: number, target: Pt, maxLength: number): Sample[] => {
    const points: Sample[] = [{ ...base, heading }];
    let theta = heading;
    let { x, y } = base;
    const wiggle = between(0.01, 0.025);
    const wiggleLength = between(14, 26);
    const loop =
      rand() < 0.4 ? { at: between(0.25, 0.5) * maxLength, length: between(150, 200), turn: pick([-1, 1]) } : null;

    for (let s = STEP; s <= maxLength; s += STEP) {
      const looping = loop && s > loop.at && s < loop.at + loop.length;
      if (looping) {
        // One full turn over the loop's length, eased in and out.
        const u = (s - loop.at) / loop.length;
        theta += loop.turn * ((Math.PI * 2) / loop.length) * 2 * Math.sin(Math.PI * u) ** 2 * STEP;
      } else if (Math.hypot(target.x - x, target.y - y) > 30) {
        const diff = wrap(Math.atan2(target.y - y, target.x - x) - theta);
        theta += Math.max(-0.03, Math.min(0.03, diff * 0.05));
      }
      theta += Math.sin(s / wiggleLength) * wiggle * (STEP / 2);

      x += Math.cos(theta) * STEP;
      y += Math.sin(theta) * STEP;
      if (!inBounds({ x, y }, 8) || !clearOfFlowers({ x, y }, 3)) break;
      points.push({ x, y, heading: theta });
    }
    return points;
  };

  /** Which side of a line at p has more open space: 1 or -1. Usually. */
  const openSide = (p: Sample) => {
    const probe = (side: number) =>
      digitDistance({ x: p.x - Math.sin(p.heading) * side * 40, y: p.y + Math.cos(p.heading) * side * 40 }, 80);
    const better = probe(1) >= probe(-1) ? 1 : -1;
    return rand() < 0.78 ? better : -better;
  };

  const indexAtLength = (grown: Grown, distance: number) => {
    let total = 0;
    for (let i = 1; i < grown.points.length; i++) {
      total += Math.hypot(grown.points[i].x - grown.points[i - 1].x, grown.points[i].y - grown.points[i - 1].y);
      if (total >= distance) return i;
    }
    return grown.points.length - 1;
  };

  /* ---------------------------------------------------------------- */
  /* Main vine                                                         */
  /* ---------------------------------------------------------------- */

  const amplitude = between(38, 62);
  const cycles = between(1.9, 3.0);
  const phase = between(0, Math.PI * 2);
  const wobbleHeight = between(3, 7);
  const wobbleLength = between(20, 32);
  const baseY = between(120, 142);
  const loop =
    rand() < 0.5
      ? { at: between(0.28, 0.72), width: 0.1, radius: between(20, 30), direction: rand() < 0.5 ? -1 : 1 }
      : null;

  const raw: Pt[] = [];
  for (let k = 0; k <= 1600; k++) {
    const t = k / 1600;
    let x = t * 612;
    const lift = x > 555 ? ((x - 555) / 57) ** 2 * 34 : 0;
    // Eased in from the root, so the vine starts without a bend.
    const rootEase = smooth(Math.min(1, t / 0.12));
    let y =
      baseY +
      amplitude * Math.sin(t * Math.PI * 2 * cycles + phase) * rootEase +
      wobbleHeight * Math.sin(x / wobbleLength) * rootEase -
      lift;
    if (loop) {
      const u = (t - (loop.at - loop.width / 2)) / loop.width;
      if (u > 0 && u < 1) {
        // Eased, so the vine slides into the loop and out without a kink. The
        // turn is fastest at the far side, which is where the swing runs
        // backwards and closes the loop.
        const theta = Math.PI * 2 * smooth(u);
        x += loop.radius * Math.sin(theta);
        y += loop.direction * loop.radius * (1 - Math.cos(theta));
      }
    }
    raw.push({ x, y });
  }

  // The bloom's space is taken before anything else can be.
  const last = raw[raw.length - 1];
  flowerSpace.push({ x: last.x, y: last.y, r: 17 });

  const mainPoints = withHeadings(raw);
  let mainLength = 0;
  for (let i = 1; i < mainPoints.length; i++) {
    mainLength += Math.hypot(mainPoints[i].x - mainPoints[i - 1].x, mainPoints[i].y - mainPoints[i - 1].y);
  }
  const speed = mainLength / MAIN_DURATION;
  const main = commit(mainPoints, START, speed, 2.6, true);

  /* ---------------------------------------------------------------- */
  /* Side vines                                                        */
  /* ---------------------------------------------------------------- */

  const sideVines: Grown[] = [];
  const sideCount = pick([1, 1, 2, 2, 3]);
  for (let v = 0; v < sideCount; v++) {
    const i = indexAtLength(main, mainLength * between(0.12, 0.78));
    const p = main.points[i];
    const side = openSide(p);
    // Which way is out, on this side of the main vine.
    const outY = Math.cos(p.heading) * side;
    const target = {
      x: Math.max(20, Math.min(620, p.x + between(-110, 170))),
      y: outY < 0 ? between(-38, 12) : between(238, 268),
    };
    const points = wander(p, p.heading + side * between(0.35, 0.5), target, between(170, 310));
    if (points.length < 35) continue;

    const end = points[points.length - 1];
    const tip = claimFlower(end, "flower", between(1.05, 1.25)) ?? claimFlower(end, "bud", 0.8);
    const grown = commit(points, main.timeAt(i), speed * 1.15, 2, true);
    if (tip) tip.delay = seconds(grown.timeAt(points.length - 1) + 0.05);
    sideVines.push(grown);
  }

  /* ---------------------------------------------------------------- */
  /* Flower branches, on every vine                                    */
  /* ---------------------------------------------------------------- */

  /** Branches that get a leaf later, and where along them it may go. */
  const branchHosts: Grown[] = [];

  /** A line may be grown only if no part of it, its base included, runs through a flower. */
  const pathClear = (points: Pt[]) => points.every((p) => clearOfFlowers(p, 2));

  const flowerBranch = (host: Grown, i: number, depth: 0 | 1) => {
    const p = host.points[i];
    const preferred = openSide(p);
    const kind: Tip["kind"] = depth === 0 || rand() < 0.6 ? "flower" : "bud";
    const size = depth === 0 ? between(0.95, 1.35) : between(0.7, 0.9);

    // A handful of tries: the open side first, then the other, each with its
    // own length and curve, before giving up on this spot.
    for (let attempt = 0; attempt < 6; attempt++) {
      const side = attempt < 4 ? preferred : -preferred;
      const length = depth === 0 ? between(40, 95) : between(16, 30);
      // Off at a shallow angle, then curving away: never a corner. A short
      // stem is only allowed a gentle curve, or it would curl.
      const heading = p.heading + side * between(0.3, 0.5);
      const bend = side * Math.min(between(0.25, 0.85), length / 45);

      const points = curve(p, heading, length, bend);
      const end = points[points.length - 1];
      if (!inBounds(end, 12) || !pathClear(points)) continue;

      // The flower first, so its own stem does not count against it.
      const tip = claimFlower(end, kind, size);
      if (!tip) continue;

      const grown = commit(points, host.timeAt(i), speed * 1.3, depth === 0 ? 1.7 : 1.2, false, host.layers[i]);
      tip.delay = seconds(grown.timeAt(points.length - 1) + 0.05);
      if (depth === 0) branchHosts.push(grown);

      // Often one twig, with a flower of its own.
      if (depth === 0 && rand() < 0.6) {
        flowerBranch(grown, Math.floor(points.length * between(0.35, 0.6)), 1);
      }
      return;
    }
  };

  for (const vine of [main, ...sideVines]) {
    const isMain = vine === main;
    const count = Math.max(1, Math.round(vine.length / (isMain ? 60 : 65)));
    for (let k = 0; k < count; k++) {
      const fraction = (k + 0.5 + between(-0.3, 0.3)) / count;
      // Not at the very root, and not crowding the bloom at the main vine's end.
      if (fraction < 0.05 || (isMain && fraction > 0.92)) continue;
      flowerBranch(vine, indexAtLength(vine, vine.length * fraction), 0);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Leaves, into what is left                                         */
  /* ---------------------------------------------------------------- */

  const placeLeaf = (p: Sample, side: number, delay: number, layer: Layer, scale: number) => {
    const angle = p.heading + side * ((between(48, 66) * Math.PI) / 180);
    const along = (d: number) => ({ x: p.x + Math.cos(angle) * d * scale, y: p.y + Math.sin(angle) * d * scale });
    const middle = along(9);
    const tipOfLeaf = along(18);
    const r = 6 * scale;

    // No part of it near a flower: where it joins, its middle, or its tip.
    if (!clearOfFlowers(p, 4) || !clearOfFlowers(middle, r + 2) || !clearOfFlowers(tipOfLeaf, 3)) return;
    if (!inBounds(tipOfLeaf, 2)) return;
    if (!leafSpace.every((l) => Math.hypot(l.x - middle.x, l.y - middle.y) >= l.r + r)) return;

    leafSpace.push({ ...middle, r });
    leaves.push({
      x: round(p.x),
      y: round(p.y),
      rotate: Math.round((angle * 180) / Math.PI),
      scale: Math.round(scale * 100) / 100,
      delay: seconds(delay),
      fill: VINE_COLORS.leaves[layer][leaves.length % 2],
      layer,
    });
  };

  for (const vine of [main, ...sideVines]) {
    let side = 1;
    for (let at = between(14, 26); at < vine.length - 16; at += between(26, 40)) {
      const i = indexAtLength(vine, at);
      placeLeaf(vine.points[i], side, vine.timeAt(i) + 0.05, vine.layers[i], between(0.85, 1.05));
      side = -side;
    }
  }

  // One leaf on longer branches, on the half nearer the vine, away from the flower.
  for (const branch of branchHosts) {
    if (branch.length < 32) continue;
    const i = Math.floor(branch.points.length * between(0.2, 0.55));
    placeLeaf(branch.points[i], rand() < 0.5 ? 1 : -1, branch.timeAt(i) + 0.05, branch.layers[i], between(0.7, 0.9));
  }

  return {
    lines,
    leaves,
    tips,
    bloom: { x: round(last.x), y: round(last.y), delay: seconds(START + MAIN_DURATION - 0.1) },
  };
}
