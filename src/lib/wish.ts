import type { WishItem } from "./content";

/**
 * Wishlist helpers that the public page's client component needs.
 *
 * Kept out of content.ts, which imports the R2 client: a client component
 * importing anything from there would drag the storage SDK into the browser.
 */

/** The image a wishlist item shows: the override when there is one. */
export function wishImage(item: Pick<WishItem, "image" | "imageOverride">): string | undefined {
  return item.imageOverride || item.image;
}

/** "www.apple.com" -> "apple.com", for labelling where a link goes. */
export function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

/** Second-level labels that sit in front of a country code: amazon.co.uk. */
const COUNTRY_SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov", "edu", "ne", "or"]);

/**
 * A shop's name from its address: amazon.com -> Amazon, amazon.co.uk -> Amazon.
 *
 * Only the fallback. A name the site declares for itself (og:site_name) is
 * better — it knows "Best Buy" has a space in it — and is used when there is one.
 */
export function siteFromHost(href: string): string {
  const parts = hostOf(href).split(".");
  let label = parts[0];
  if (parts.length >= 3 && parts.at(-1)!.length === 2 && COUNTRY_SECOND_LEVEL.has(parts.at(-2)!)) {
    label = parts.at(-3)!;
  } else if (parts.length >= 2) {
    label = parts.at(-2)!;
  }
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : hostOf(href);
}

/**
 * Tidies a declared site name, which is sometimes just the domain again
 * ("Amazon.com"). Those are turned into a name; real names are left alone.
 */
export function tidySiteName(name: string | undefined): string | undefined {
  const text = name?.trim();
  if (!text) return undefined;
  return /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(text) ? siteFromHost(`https://${text}`) : text;
}

/**
 * "#ABC", "abc", "aabbcc" or "rgb(170, 187, 204)" -> "#aabbcc". Anything else
 * is null. Shared by the colour field and the server action that stores it.
 */
export function normalizeHex(value: string | undefined | null): string | null {
  const text = (value ?? "").trim().toLowerCase();
  const rgb = text.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((c) => Math.min(255, Number(c)).toString(16).padStart(2, "0"))
      .join("")}`;
  }
  const hex = text.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(hex)) return `#${[...hex].map((c) => c + c).join("")}`;
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
}

/**
 * One point of a tile gradient: a colour, and where on the tile it sits, in
 * percent of the tile's width (x) and height (y).
 */
export type GradientPoint = { color: string; x: number; y: number };

/** The most points a gradient can have. */
export const MAX_GRADIENT_POINTS = 7;

/**
 * A tile background as stored: one "#rrggbb", or a gradient of two to seven
 * points written "#rrggbb@x:y|#rrggbb@x:y|…". Points come from the image's
 * edges automatically, or from the stops set in the editor.
 * Anything else is null.
 */
export function normalizeBackground(value: string | undefined | null): string | null {
  const text = (value ?? "").trim();
  if (!text.includes("@")) return normalizeHex(text);
  const points: GradientPoint[] = [];
  for (const part of text.split("|")) {
    const match = part.trim().match(/^(.+)@(-?[\d.]+):(-?[\d.]+)$/);
    const color = normalizeHex(match?.[1]);
    if (!match || !color) return null;
    const clamp = (n: string) => Math.min(100, Math.max(0, Math.round(Number(n))));
    points.push({ color, x: clamp(match[2]), y: clamp(match[3]) });
  }
  if (points.length > MAX_GRADIENT_POINTS) return null;
  return formatBackground(points) || null;
}

/** Points in, a stored background out: nothing, one colour, or a gradient. */
export function formatBackground(points: GradientPoint[]): string {
  if (points.length === 0) return "";
  if (new Set(points.map((p) => p.color)).size === 1) return points[0].color;
  return points.map((p) => `${p.color}@${p.x}:${p.y}`).join("|");
}

/** A stored gradient's points; none for a single colour or nothing. */
export function gradientPoints(background: string | undefined): GradientPoint[] {
  if (!background?.includes("@")) return [];
  return background.split("|").map((part) => {
    const [color, at] = part.split("@");
    const [x, y] = at.split(":").map(Number);
    return { color, x, y };
  });
}

/** True when a stored background is a gradient rather than one colour. */
export function isGradient(background: string | undefined): boolean {
  return Boolean(background?.includes("@"));
}

/** Tiles are 2:3, so a step down the tile is one and a half steps across it. */
const TILE_HEIGHT = 1.5;

/**
 * The CSS for a stored background.
 *
 * Two points are a straight gradient from one to the other, with each colour
 * exactly where its point is. Three or more are soft pools of colour, one
 * centred on each point, over the average of them all.
 */
export function backgroundStyle(background: string | undefined): React.CSSProperties | undefined {
  if (!background) return undefined;
  const points = gradientPoints(background);
  if (points.length === 0) return { backgroundColor: background };

  if (points.length === 2) {
    const [a, b] = points;
    const dx = (b.x - a.x) / 100;
    const dy = ((b.y - a.y) / 100) * TILE_HEIGHT;
    // CSS angles: 0deg points up, clockwise.
    const angle = Math.atan2(dx, -dy);
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    // Where a point falls along the gradient line, which runs through the tile's
    // centre and is as long as the tile is deep in that direction.
    const length = Math.abs(sin) + Math.abs(TILE_HEIGHT * cos);
    const along = (p: GradientPoint) =>
      (((p.x / 100 - 0.5) * sin - (p.y / 100 - 0.5) * TILE_HEIGHT * cos) / length + 0.5) * 100;
    const deg = (angle * 180) / Math.PI;
    return {
      backgroundColor: a.color,
      backgroundImage: `linear-gradient(${deg.toFixed(1)}deg, ${a.color} ${along(a).toFixed(1)}%, ${
        b.color
      } ${along(b).toFixed(1)}%)`,
    };
  }

  const channel = (i: number) =>
    Math.round(points.reduce((sum, p) => sum + parseInt(p.color.slice(i, i + 2), 16), 0) / points.length)
      .toString(16)
      .padStart(2, "0");
  return {
    backgroundColor: `#${channel(1)}${channel(3)}${channel(5)}`,
    // 85% of the width by 57% of the height is round on a 2:3 tile.
    backgroundImage: points
      .map((p) => `radial-gradient(ellipse 85% 57% at ${p.x}% ${p.y}%, ${p.color}, transparent)`)
      .join(", "),
  };
}

/**
 * The colour behind an item's picture, or nothing for the plain tile.
 *
 * A colour set by hand always applies. One worked out from the pulled image
 * only applies to that image, so not once a different image has been chosen.
 */
export function wishBackground(
  item: Pick<WishItem, "imageBg" | "imageBgCustom" | "imageOverride">
): string | undefined {
  if (item.imageBgCustom) return item.imageBg;
  return item.imageOverride ? undefined : item.imageBg;
}

/** The shop name shown under an item. */
export function wishSite(item: Pick<WishItem, "site" | "href">): string {
  return item.site || siteFromHost(item.href);
}

/** 24.5 -> "$24.50", 1299 -> "$1,299". Cents only when there are some. */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
}
