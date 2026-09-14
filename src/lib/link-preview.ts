// SERVER-ONLY. Reads a page's own preview tags: the image and title a link
// unfurls with.
//
// Reading stops at </head> when the head already named an image — that is where
// the tags live, and some product pages run to megabytes past it. When it did
// not (Amazon sets no og:image at all), the body is read too, up to a limit, for
// the product image and structured data. Everything here degrades to "nothing
// found" rather than throwing: a shop that blocks the request just means no
// picture, and the image can always be set by hand.

import { tidySiteName } from "./wish";

export type LinkPreview = { title?: string; image?: string; site?: string };

const TIMEOUT_MS = 8_000;
const MAX_CHARS = 2_000_000;

/**
 * Sent as a browser. Plenty of shops answer an honest bot user agent with a
 * block page that has no preview tags on it.
 */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

/** Checked in order; the first one present wins. */
const IMAGE_KEYS = [
  "og:image:secure_url",
  "og:image",
  "og:image:url",
  "twitter:image",
  "twitter:image:src",
  "image",
];
const TITLE_KEYS = ["og:title", "twitter:title"];

export async function linkPreview(href: string): Promise<LinkPreview> {
  try {
    const res = await fetch(href, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok || !res.body) return {};

    const type = res.headers.get("content-type") ?? "";
    // A link straight to an image is its own picture.
    if (type.startsWith("image/")) return { image: res.url || href };
    if (!type.includes("html")) return {};

    const html = await readPage(res.body);
    const base = res.url || href;
    const tags = metaTags(html);

    const image =
      IMAGE_KEYS.map((k) => tags.get(k)).find(Boolean) ??
      linkHref(html, "image_src") ??
      productImage(html) ??
      jsonLdImage(html) ??
      linkHref(html, "apple-touch-icon");
    const title =
      TITLE_KEYS.map((k) => tags.get(k)).find(Boolean) ??
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];

    // Amazon titles every product "Amazon.com: <name> : <department>". Only that
    // exact shape is unwrapped; a colon in anyone else's title is left alone.
    let name = clean(title);
    const amazon = name?.match(/^Amazon(?:\.[a-z.]+)?\s*:\s*(.+?)(?:\s+:\s+[^:]+)?$/i);
    if (amazon) name = amazon[1];

    // What the site calls itself, for the line under the product name. When it
    // does not say, the name comes from its address instead (see lib/wish.ts).
    const site = tidySiteName(clean(tags.get("og:site_name") ?? tags.get("application-name")));

    return { image: absolute(image, base), title: name, site };
  } catch {
    return {};
  }
}

async function readPage(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  while (html.length < MAX_CHARS) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    const headEnd = html.search(/<\/head>/i);
    if (headEnd >= 0 && IMAGE_KEYS.some((k) => metaTags(html.slice(0, headEnd)).has(k))) break;
  }
  reader.cancel().catch(() => {});
  return html;
}

/** property/name/itemprop -> content, first occurrence of each. */
function metaTags(html: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop");
    const content = attr(tag, "content");
    if (key && content && !tags.has(key.toLowerCase())) tags.set(key.toLowerCase(), content);
  }
  return tags;
}

function linkHref(html: string, rel: string): string | undefined {
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rels = attr(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
    if (rels.includes(rel)) return attr(tag, "href");
  }
  return undefined;
}

/** Amazon's main product photo, which it never puts in a preview tag. */
function productImage(html: string): string | undefined {
  const tag = html.match(/<img\b[^>]*\bid\s*=\s*["']landingImage["'][^>]*>/i)?.[0];
  return tag ? (attr(tag, "data-old-hires") || attr(tag, "src")) : undefined;
}

/** schema.org Product/Article `image`, as a string, an array, or an ImageObject. */
function jsonLdImage(html: string): string | undefined {
  const pick = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(pick).find(Boolean);
    if (value && typeof value === "object") return pick((value as { url?: unknown }).url);
    return undefined;
  };
  const find = (node: unknown): string | undefined => {
    if (Array.isArray(node)) return node.map(find).find(Boolean);
    if (!node || typeof node !== "object") return undefined;
    const record = node as Record<string, unknown>;
    return pick(record.image) ?? find(record["@graph"]);
  };

  for (const [, json] of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const image = find(JSON.parse(json));
      if (image) return image;
    } catch {
      // Malformed JSON-LD is common; try the next block.
    }
  }
  return undefined;
}

function attr(tag: string, name: string): string | undefined {
  // Preceded by whitespace, so "name" never matches inside "data-name".
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  const value = m?.[1] ?? m?.[2] ?? m?.[3];
  return value === undefined ? undefined : decode(value);
}

function decode(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Relative and protocol-relative image paths are common; resolve them. */
function absolute(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const resolved = new URL(value.trim(), base);
    return resolved.protocol === "https:" || resolved.protocol === "http:"
      ? resolved.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function clean(value: string | undefined): string | undefined {
  const text = value ? decode(value).replace(/\s+/g, " ").trim() : "";
  return text || undefined;
}
