import { SITE } from "./site";
import type { Clip, Slide } from "./content";

/**
 * cinema.odiwr.com: turning a clip into something that plays, and the addresses
 * of its pages.
 *
 * No server imports, so the dashboard's client components can use it too.
 */

export type Embed = {
  provider: "YouTube" | "TikTok" | "Instagram" | "Vimeo";
  /** The iframe src. */
  src: string;
  /** Width over height of the player. */
  aspect: number;
  /** A still that does not expire, when the provider has one at a fixed address. */
  thumb?: string;
};

/**
 * The player for a link to where a clip is officially posted, or null for a
 * link this does not know how to embed.
 *
 * Only the id is taken from the link; the player URL is built here, so nothing
 * typed into the dashboard ever becomes an iframe src as-is.
 */
export function embedFor(link: string | undefined): Embed | null {
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(link) ? link : `https://${link}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  const id = (value: string | null | undefined, pattern: RegExp) =>
    value && pattern.test(value) ? value : null;

  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    const short = parts[0] === "shorts";
    const video = id(
      host === "youtu.be"
        ? parts[0]
        : short || parts[0] === "embed" || parts[0] === "live"
          ? parts[1]
          : url.searchParams.get("v"),
      /^[\w-]{11}$/
    );
    if (!video) return null;
    return {
      provider: "YouTube",
      src: `https://www.youtube-nocookie.com/embed/${video}?rel=0&playsinline=1`,
      aspect: short ? 9 / 16 : 16 / 9,
      thumb: `https://i.ytimg.com/vi/${video}/hqdefault.jpg`,
    };
  }

  if (host === "tiktok.com") {
    const video = id(parts[parts.indexOf("video") + 1], /^\d+$/);
    if (!parts.includes("video") || !video) return null;
    return {
      provider: "TikTok",
      src: `https://www.tiktok.com/player/v1/${video}?rel=0&description=0&music_info=0`,
      aspect: 9 / 16,
    };
  }

  if (host === "instagram.com") {
    const kind = parts.find((p) => p === "p" || p === "reel" || p === "reels" || p === "tv");
    const code = kind ? id(parts[parts.indexOf(kind) + 1], /^[\w-]+$/) : null;
    if (!code) return null;
    return {
      provider: "Instagram",
      src: `https://www.instagram.com/p/${code}/embed`,
      // The embed carries its own header and footer around the video.
      aspect: 9 / 19,
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const video = id(parts.find((p) => /^\d+$/.test(p)), /^\d+$/);
    if (!video) return null;
    return { provider: "Vimeo", src: `https://player.vimeo.com/video/${video}`, aspect: 16 / 9 };
  }

  return null;
}

/** True for a link to an MP4 or WebM file, however it is queried or fragmented. */
export function isVideoFile(href: string | undefined): boolean {
  return !!href && /\.(mp4|webm)(?:[?#]|$)/i.test(href);
}

/** The picture on a clip's tile: its own poster first, then the provider's still. */
export function clipThumb(clip: Pick<Clip, "poster" | "embed">): string | undefined {
  return clip.poster || embedFor(clip.embed)?.thumb;
}

/**
 * Where the cinema's pages are linked from.
 *
 * The real host in production; in development the path proxy.ts rewrites it to,
 * so it opens without DNS. Posts sit directly under it either way.
 */
export const CINEMA_BASE = process.env.NODE_ENV === "production" ? SITE.cinemaUrl : "/cinema";

export function clipHref(slug: string): string {
  return `${CINEMA_BASE}/${slug}`;
}

/** A slide's own address: the post's for the first, /slug/2 and on for the rest. Slides count from 0. */
export function slidePath(slug: string, slide: number): string {
  return slide > 0 ? `${slug}/${slide + 1}` : slug;
}

/** The public page for a slide, on the real host. What gets shared. */
export function slideUrl(slug: string, slide: number): string {
  return `${SITE.cinemaUrl}/${slidePath(slug, slide)}`;
}

/**
 * A still that a card renderer can use, for a picture that is not one: an
 * uploaded still as it is, and Giphy's own JPEG still for one of its loops.
 */
export function stillFor(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const giphy = /^https:\/\/media\d*\.giphy\.com\/media\/([\w-]+)\//.exec(href);
  if (giphy) return `https://media.giphy.com/media/${giphy[1]}/480w_s.jpg`;
  return isVideoFile(href) || isGif(href) ? undefined : href;
}

/**
 * The same file, somewhere a canvas may read it back from.
 *
 * Recording the story card draws the loop into a canvas; a video from another
 * origin that sends no CORS headers "taints" it, and a tainted canvas cannot be
 * recorded. The bucket sends none, so its files go through the same-origin
 * /media route (allow-listed there for cinema/). Giphy does send them, and
 * local files are same-origin already. Server only: it reads the bucket's
 * public address from the environment.
 */
function readable(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const bucket = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
  if (bucket && href.startsWith(`${bucket}/`)) {
    return `/media?key=${encodeURIComponent(href.slice(bucket.length + 1))}`;
  }
  return href;
}

function isGif(href: string | undefined): boolean {
  return !!href && /\.gif(?:[?#]|$)/i.test(href);
}

/** All of a post's slides, its own fields first. */
export function clipSlides(clip: Clip): Slide[] {
  const first: Slide = {
    video: clip.video,
    poster: clip.poster,
    cover: clip.cover,
    width: clip.width,
    height: clip.height,
  };
  return [first, ...(clip.slides ?? [])];
}

/** One slide as the gallery plays it. */
export type ViewSlide = {
  /** Moving, muted: the tile (first slide only), and what the viewer opens on. A GIF or an MP4/WebM. */
  loop?: string;
  /** A still: the tile when nothing moves, and the video's poster. */
  still?: string;
  /** The full clip, played with sound once opened. */
  video?: string;
  /** An official player to open instead, when there is no upload (first slide only). */
  embed?: string;
  /** Width over height, when known ahead; otherwise measured as it loads. */
  aspect?: number;
  /** The loop again, from somewhere a canvas can record it (readable()). For the story card. */
  share?: string;
  /**
   * What to fetch ahead when a tile is pointed at: the clip and its loop, each
   * with where it can be read from (components/cinema/preload.ts).
   */
  preload: { src: string; from: string }[];
};

/**
 * What the gallery needs of one post, and nothing it does not: the page sends
 * this list to the browser, so captions and dashboard-only fields stay behind.
 */
export type ViewClip = {
  slug: string;
  title: string;
  show?: string;
  date: string;
  /** At least one. The first is the tile. */
  slides: ViewSlide[];
};

function viewSlide(slide: Slide, embedLink?: string): ViewSlide {
  const moving = isVideoFile(slide.poster) || isGif(slide.poster);
  const loop = slide.cover || (moving ? slide.poster : undefined);
  const embed = slide.video ? undefined : embedFor(embedLink);
  const still = slide.poster && !moving ? slide.poster : embedFor(embedLink)?.thumb;
  return {
    loop,
    still,
    video: slide.video,
    embed: embed?.src,
    share: readable(loop ?? slide.video),
    preload: [slide.video, loop]
      .filter((src): src is string => !!src && isVideoFile(src))
      .map((src) => ({ src, from: readable(src)! })),
    aspect:
      slide.video && slide.width && slide.height
        ? slide.width / slide.height
        : embed && !loop && !still
          ? embed.aspect
          : undefined,
  };
}

export function viewClip(clip: Clip): ViewClip {
  const [first, ...rest] = clipSlides(clip);
  return {
    slug: clip.slug,
    title: clip.title,
    show: clip.show,
    date: clip.date,
    slides: [viewSlide(first, clip.embed), ...rest.map((s) => viewSlide(s))],
  };
}
