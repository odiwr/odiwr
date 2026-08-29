/**
 * The creative mosaic.
 *
 * Fills ONE fixed rectangle completely with tiles of many different aspect
 * ratios — the puzzle the posters have to fit into. Given a count and a seed it
 * always returns the same layout, which is the whole point: the dashboard can
 * run this for slot N and tell you the exact aspect ratio to make that poster,
 * confident the site will lay it out the same way.
 *
 * The method is a recursive binary split rather than a grid. A grid gives you
 * one aspect ratio repeated; splitting gives a genuine spread. Each step takes
 * the largest tile left and cuts it in two at a randomised ratio, which keeps
 * the sizes varied without any tile collapsing into a sliver.
 *
 * Two rules stop it degenerating:
 *   - the cut runs across the tile's longer side IN REAL TERMS, so halves tend
 *     back towards square instead of getting thinner and thinner;
 *   - the split ratio is clamped to whatever keeps BOTH halves inside
 *     MAX_ASPECT, and the cut is turned 90 degrees if no ratio can.
 *
 * "Real terms" is the part that is easy to get wrong: tiles are stored in
 * fractions of the container, so a tile that is 0.5 x 0.5 is square on paper and
 * 3:2 on screen. Judging shape without folding in the container's own aspect
 * produced 59:14 slivers.
 */

export type Tile = {
  /** Normalised to the container: 0..1 of its width and height. */
  x: number;
  y: number;
  w: number;
  h: number;
};

/** The most elongated a tile may get, either way up. */
const MAX_ASPECT = 2.2;
/** How lopsided a single cut may be. */
const MIN_SPLIT = 0.28;
const MAX_SPLIT = 0.72;

/**
 * Deterministic PRNG. Math.random would reshuffle the puzzle on every render and
 * on the server vs the client, so the layout has to come from a seed.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Aspect of a tile, given the container's own aspect (width / height). */
export function tileAspect(tile: Tile, containerAspect: number): number {
  return (tile.w * containerAspect) / tile.h;
}

/** Rounded "3:2"-style label, for telling someone what to draw. */
export function aspectLabel(aspect: number): string {
  let best = { w: 1, h: 1, err: Infinity };
  for (let h = 1; h <= 16; h++) {
    const w = Math.round(aspect * h);
    if (w < 1) continue;
    const err = Math.abs(w / h - aspect);
    if (err < best.err - 1e-9) best = { w, h, err };
  }
  return `${best.w}:${best.h}`;
}

/**
 * The range of split ratios that keeps both halves inside MAX_ASPECT.
 *
 * `aspect` is the tile's real aspect, and `vertical` says which way the cut
 * runs. Returns null when no ratio works and the cut has to be turned.
 */
function splitRange(aspect: number, vertical: boolean): [number, number] | null {
  // A vertical cut scales each half's width by its share, so half aspects are
  // aspect * r and aspect * (1 - r). A horizontal cut scales the height, giving
  // aspect / r and aspect / (1 - r).
  const lo = vertical
    ? Math.max(MIN_SPLIT, 1 / (MAX_ASPECT * aspect), 1 - MAX_ASPECT / aspect)
    : Math.max(MIN_SPLIT, aspect / MAX_ASPECT, 1 - aspect * MAX_ASPECT);
  const hi = vertical
    ? Math.min(MAX_SPLIT, MAX_ASPECT / aspect, 1 - 1 / (MAX_ASPECT * aspect))
    : Math.min(MAX_SPLIT, aspect * MAX_ASPECT, 1 - aspect / MAX_ASPECT);

  return lo <= hi ? [lo, hi] : null;
}

/**
 * @param containerAspect width / height of the rectangle being filled. Required,
 * because shape is meaningless without it.
 */
export function mosaic(count: number, seed = 1, containerAspect = 1): Tile[] {
  if (count <= 0) return [];
  const rand = mulberry32(seed);
  const tiles: Tile[] = [{ x: 0, y: 0, w: 1, h: 1 }];

  while (tiles.length < count) {
    // Largest by area, so the split always attacks the biggest gap.
    let index = 0;
    for (let i = 1; i < tiles.length; i++) {
      if (tiles[i].w * tiles[i].h > tiles[index].w * tiles[index].h) index = i;
    }

    const tile = tiles[index];
    const aspect = (tile.w * containerAspect) / tile.h;

    // Cut across the longer side, and turn the cut if that leaves no room.
    let vertical = aspect >= 1;
    let range = splitRange(aspect, vertical);
    if (!range) {
      vertical = !vertical;
      range = splitRange(aspect, vertical);
    }
    // Nothing legal either way: halve it and take the better of two evils.
    const ratio = range ? range[0] + rand() * (range[1] - range[0]) : 0.5;

    const [a, b] = vertical
      ? [
          { x: tile.x, y: tile.y, w: tile.w * ratio, h: tile.h },
          { x: tile.x + tile.w * ratio, y: tile.y, w: tile.w * (1 - ratio), h: tile.h },
        ]
      : [
          { x: tile.x, y: tile.y, w: tile.w, h: tile.h * ratio },
          { x: tile.x, y: tile.y + tile.h * ratio, w: tile.w, h: tile.h * (1 - ratio) },
        ];

    tiles.splice(index, 1, a, b);
  }

  return tiles;
}
