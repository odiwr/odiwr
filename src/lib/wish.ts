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
