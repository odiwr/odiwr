"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import Icon from "@/components/icons";
import {
  clipHref,
  slidePath,
  slideUrl,
  type ViewClip,
  type ViewSlide,
} from "@/lib/cinema";
import { HOME_HREF } from "@/lib/site";
import { cached, cool, hold, release, warm } from "./preload";
import { makeStory, shareStory } from "./story";

/**
 * cinema.odiwr.com, all of it: the grid, and the viewer a tile opens into.
 *
 * Opening a post is a fade: the grid goes, black comes up over the page, and
 * the clip appears in the middle at its own shape. Closing fades the other way
 * — the clip out, the grid back, and the page's own colour back under it. The
 * clip opens on its cover loop, the same one the tile was playing, and the full
 * clip takes its place once it is up.
 *
 * A post can have several slides. The dots are that post's slides (under it;
 * down the right side on a phone), and the arrow keys step through them; the
 * box re-shapes to each in turn. Every slide is its own address: /slug for the
 * first, /slug/2 and on for the rest. Opening pushes one, so Back closes;
 * changing slides replaces it, so Back still means "back to the grid". The same
 * component renders those addresses directly, opened already.
 *
 * Built to stay quick with hundreds of posts: only the rows near the screen
 * exist at all (the rest are one spacer above and one below), a loop plays only
 * while a quarter of its tile is on screen, and a tile shows a skeleton until
 * its picture arrives. Anything that fails to load turns grey rather than
 * black; an open slide gets a second first. A tile the pointer settles on (not
 * one it merely crosses) has its post's clips fetched into memory, so opening
 * it plays at once; leaving without opening lets them go (preload.ts).
 *
 * Before anything, a first visit is asked whether clips may play with sound;
 * saying no leaves for the main site. The answer is kept in this browser only.
 *
 * Share is for whoever keeps the place: it appears only for a browser signed
 * into the dashboard.
 */

const DURATION = 700;
/** Opening, closing, and the page's colour with them. */
const FADE = 320;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Space around the open clip, and the strip below it for the dots. */
const MARGIN = 24;
const DOTS = 48;
/** On a phone the dots run down the right; the clip keeps this much either side, so it stays centred. */
const SIDE = 28;
const PHONE = 640;
/** A screen this short and wider than tall is a phone on its side. */
const SIDEWAYS = 500;
/** How long the dots stay fully visible after being looked at, before dimming. */
const LINGER = 1500;
/** How long an open slide gets to show something before it is marked grey. */
const PATIENCE = 1000;
/**
 * Looping a trim inside a longer clip: how long before its end the spare copy
 * takes over, and how often that is checked.
 */
const SWAP_LEAD = 0.06;
const SWAP_TICK = 25;
/** A tile's loop plays only while at least this much of it is on screen. */
const VISIBLE = 0.25;
const SOUND_KEY = "cinema-sound";
/**
 * Pointer intent: the pointer has settled on a tile when it moves slower than
 * this (px per ms, over the last few moves), or rests without moving for
 * SETTLE ms. A sweep across the grid does neither on the tiles it passes.
 */
const SLOW = 0.25;
const SETTLE = 140;

type Rect = { left: number; top: number; width: number; height: number };
/** Which posts are mounted, and the space standing in for the rest. */
type Window = { start: number; end: number; above: number; below: number };

/**
 * Whether sound has been allowed, as a tiny store: this browser's storage, with
 * a copy in memory so a browser that refuses storage still gets past the prompt
 * (and is simply asked again next visit).
 *
 * There is only one answer to keep. Saying no leaves for the main site rather
 * than watching in silence, so nothing here turns sound off again.
 */
let allowedMemory = false;
const soundListeners = new Set<() => void>();

function allowed(): boolean {
  if (allowedMemory) return true;
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    // Blocked storage reads as unanswered.
    return false;
  }
}

function allow() {
  allowedMemory = true;
  try {
    localStorage.setItem(SOUND_KEY, "on");
  } catch {
    // Private window or blocked storage: the memory copy covers this visit.
  }
  soundListeners.forEach((listener) => listener());
}

function subscribeSound(listener: () => void) {
  soundListeners.add(listener);
  return () => soundListeners.delete(listener);
}

/** YYYY-MM-DD -> MM/DD/YY. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y.slice(2)}`;
}

function isVideo(href: string): boolean {
  return /\.(mp4|webm)(?:[?#]|$)/i.test(href);
}

/**
 * The grid's measurements, the same numbers globals.css lays it out with:
 * columns and gaps by width, the tile at 2.39:1, the line under it 24px.
 */
function gridMetrics(listWidth: number) {
  const w = window.innerWidth;
  const cols = w < PHONE ? 2 : w <= 1024 ? 3 : 5;
  const colGap = w < PHONE ? 4 : 6;
  const rowGap = w < PHONE ? 14 : 18;
  const tile = (listWidth - colGap * (cols - 1)) / cols / 2.39;
  return { cols, tile, stride: tile + 24 + rowGap };
}

/**
 * Everything a browser might lay over a playing video on its own — the
 * picture-in-picture and cast buttons, the download and fullscreen items — is
 * switched off. There is no `controls` attribute, and CSS hides the control
 * layer itself for the browsers that draw one anyway (globals.css).
 */
const BARE = {
  disablePictureInPicture: true,
  disableRemotePlayback: true,
  controlsList: "nodownload nofullscreen noremoteplayback noplaybackrate",
  playsInline: true,
} as const;

/**
 * A tile's picture: the post's first slide, moving if anything moves,
 * contained, never cropped. Plays only while a quarter of it is on screen.
 */
function TileMedia({
  slide,
  onReady,
  onFail,
}: {
  slide: ViewSlide;
  onReady: () => void;
  onFail: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const src = slide.loop ?? (slide.video && !slide.still ? slide.video : undefined);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= VISIBLE) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: [0, VISIBLE, 0.5, 1] }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  if (src && isVideo(src)) {
    return (
      <video
        // Keyed by what it plays: handed a new address, a video element keeps
        // the old picture until it is replaced outright, so a cover just
        // remade would not show.
        key={src}
        ref={ref}
        src={src}
        poster={slide.still}
        muted
        loop
        preload="none"
        {...BARE}
        onLoadedData={onReady}
        onError={onFail}
      />
    );
  }
  const picture = src ?? slide.still;
  if (slide.video && !picture) {
    return (
      <video
        key={slide.video}
        ref={ref}
        src={`${slide.video}#t=${slide.start ?? 0.1}`}
        muted
        loop
        preload="metadata"
        {...BARE}
        onLoadedData={onReady}
        onError={onFail}
      />
    );
  }
  if (!picture) return null;
  // Not next/image: the optimiser would flatten a GIF to a still.
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={picture} src={picture} alt="" loading="lazy" onLoad={onReady} onError={onFail} />;
}

/** Every file worth fetching ahead for a post, across its slides. */
function postFiles(clip: ViewClip) {
  return clip.slides.flatMap((s) => s.preload);
}

/** A tile: a skeleton until its picture arrives, grey if it never does. */
function Tile({
  clip,
  hidden,
  tileRef,
  onOpen,
}: {
  clip: ViewClip;
  hidden: boolean;
  tileRef: (el: HTMLAnchorElement | null) => void;
  onOpen: () => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  // Recent pointer positions over this tile, for its speed; and the timer that
  // counts a still pointer as settled.
  const trail = useRef<{ x: number; y: number; t: number }[]>([]);
  const settle = useRef<number | null>(null);
  const warmed = useRef(false);

  const intend = () => {
    if (warmed.current) return;
    warmed.current = true;
    warm(clip.slug, postFiles(clip));
  };
  const restartSettle = () => {
    if (settle.current !== null) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(intend, SETTLE);
  };

  useEffect(
    () => () => {
      if (settle.current !== null) window.clearTimeout(settle.current);
    },
    []
  );

  return (
    <li>
      <a
        ref={tileRef}
        href={clipHref(clip.slug)}
        className="cinema-tile"
        data-state={state}
        aria-label={clip.title}
        // The box stands in for it while open, so it is not there twice.
        style={{ visibility: hidden ? "hidden" : undefined }}
        // A mouse only: touch has no hover, and a tap opens it anyway.
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          trail.current = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
          restartSettle();
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse" || warmed.current) return;
          const now = { x: e.clientX, y: e.clientY, t: e.timeStamp };
          const points = [...trail.current, now].filter((p) => now.t - p.t <= 100);
          trail.current = points;
          const from = points[0];
          const ms = now.t - from.t;
          if (ms >= 30 && Math.hypot(now.x - from.x, now.y - from.y) / ms < SLOW) intend();
          else restartSettle();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse") return;
          if (settle.current !== null) window.clearTimeout(settle.current);
          settle.current = null;
          if (warmed.current) cool(clip.slug);
          warmed.current = false;
        }}
        onClick={(e) => {
          // A modified click means "somewhere else": let it be a link.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onOpen();
        }}
      >
        <TileMedia
          slide={clip.slides[0]}
          onReady={() => setState("ready")}
          onFail={() => setState("failed")}
        />
      </a>
      <p className="cinema-meta">
        <span>{clip.show || clip.title}</span>
        <time dateTime={clip.date}>{shortDate(clip.date)}</time>
      </p>
    </li>
  );
}

/**
 * A trim inside a longer clip, looped without a stall.
 *
 * Sending one video back to the trim's start is a backwards seek, and on a file
 * still arriving over the network that takes long enough to look like a freeze
 * at the end of every round. So the clip is opened twice: one plays while the
 * other waits, parked at the start and already buffered there. At the end they
 * change places — the spare is simply told to play, which it can do at once —
 * and the one that just finished parks itself for the next round.
 *
 * Which of the two is in front is kept in a ref and shown by setting their
 * opacity directly: going through React would put a frame between them.
 *
 * Clips cut to their trim (nothing to skip) do not come through here; the
 * browser loops those on its own.
 */
function TrimmedVideo({
  src,
  poster,
  start,
  end,
  active,
  onReady,
  onMeasure,
  onSilent,
}: {
  src: string;
  poster?: string;
  start: number;
  end: number;
  /** False until sound is allowed: nothing plays before that. */
  active: boolean;
  onReady: () => void;
  onMeasure: (width: number, height: number) => void;
  /** It had to start without sound, and a tap is needed to have it. */
  onSilent: () => void;
}) {
  const one = useRef<HTMLVideoElement>(null);
  const two = useRef<HTMLVideoElement>(null);
  const frontIsOne = useRef(true);

  const pair = () => ({
    front: (frontIsOne.current ? one : two).current,
    back: (frontIsOne.current ? two : one).current,
  });

  const park = (video: HTMLVideoElement | null) => {
    if (video && Math.abs(video.currentTime - start) > 0.05) video.currentTime = start;
  };

  // Both to the start, and the front away.
  useEffect(() => {
    if (!active) return;
    const { front, back } = pair();
    park(front);
    park(back);
    if (!front) return;
    front.muted = false;
    // A browser only plays sound from a click. Opening from a tile is one;
    // arriving at /slug directly is not, so that falls back to silent.
    front.play().catch(() => {
      front.muted = true;
      onSilent();
      front.play().catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, start]);

  /**
   * The changeover, watched two ways: once per drawn frame, which is as close
   * to the cut as a page can get, and on a timer as well, since frame callbacks
   * stop for a tab that is not drawing (and a phone saving power slows timers,
   * which on its own let clips run past their end).
   */
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const { front, back } = pair();
      if (front && back && front.currentTime >= end - SWAP_LEAD) {
        park(back);
        back.muted = front.muted;
        back.style.opacity = "1";
        front.style.opacity = "0";
        void back.play().catch(() => {});
        front.pause();
        // Ready for its turn again, out of sight.
        front.currentTime = start;
        frontIsOne.current = !frontIsOne.current;
      }
      timer = window.setTimeout(tick, SWAP_TICK);
    };
    timer = window.setTimeout(tick, SWAP_TICK);

    // Both re-register themselves; whichever is in front is the one that
    // matters, and the check knows which that is.
    let live = true;
    const perFrame = (video: HTMLVideoElement | null) => {
      if (!video || !("requestVideoFrameCallback" in video)) return;
      const again = () => {
        if (!live) return;
        const { front, back } = pair();
        if (front && back && front.currentTime >= end - SWAP_LEAD) tick();
        video.requestVideoFrameCallback(again);
      };
      video.requestVideoFrameCallback(again);
    };
    perFrame(one.current);
    perFrame(two.current);

    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  const common = {
    src,
    poster,
    preload: "auto" as const,
    className: "cinema-full",
    ...BARE,
  };

  return (
    <>
      <video
        {...common}
        ref={one}
        onLoadedMetadata={(e) => {
          onMeasure(e.currentTarget.videoWidth, e.currentTarget.videoHeight);
          park(e.currentTarget);
        }}
        onPlaying={(e) => {
          // Whichever is in front is the one to show.
          if (frontIsOne.current) e.currentTarget.style.opacity = "1";
          onReady();
        }}
      />
      <video
        {...common}
        ref={two}
        muted
        onLoadedMetadata={(e) => park(e.currentTarget)}
        onPlaying={(e) => {
          if (!frontIsOne.current) e.currentTarget.style.opacity = "1";
          onReady();
        }}
      />
    </>
  );
}

/**
 * One open slide. Starts on its loop, and lays the real clip over it once it
 * plays. Reports the clip's real shape as soon as any layer knows it, so the
 * box can settle on it, and whether it has shown anything within PATIENCE.
 */
function ViewerMedia({
  slide,
  title,
  active,
  onAspect,
  onStalled,
  onSilent,
}: {
  slide: ViewSlide;
  title: string;
  /** False until sound is allowed: nothing plays before that. */
  active: boolean;
  onAspect: (aspect: number) => void;
  onStalled: (stalled: boolean) => void;
  /** It had to start without sound, and a tap is needed to have it. */
  onSilent: () => void;
}) {
  const full = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const shown = useRef(false);
  const cover = slide.loop ?? slide.still;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!shown.current) onStalled(true);
    }, PATIENCE);
    return () => {
      window.clearTimeout(timer);
      onStalled(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const video = full.current;
    if (!video || !active || slide.end !== undefined) return;
    video.muted = false;
    // A browser only plays sound from a click. Opening from a tile is one;
    // arriving at /slug directly is not, so that falls back to silent.
    video.play().catch(() => {
      video.muted = true;
      onSilent();
      video.play().catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, slide.end]);

  const measure = (w: number, h: number) => {
    if (w && h) onAspect(w / h);
  };
  const ready = () => {
    shown.current = true;
    onStalled(false);
  };

  return (
    <>
      {/* Until the clip plays, its cover holds the frame. It goes the moment
          the clip is up rather than fading under it: two nearly-alike frames
          fading through each other read as a ghost. */}
      {!playing &&
        cover &&
        (isVideo(cover) ? (
          <video
            src={cached(cover)}
            poster={slide.still}
            autoPlay
            muted
            loop
            {...BARE}
            onLoadedMetadata={(e) => measure(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
            onLoadedData={ready}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            onLoad={(e) => {
              measure(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
              ready();
            }}
          />
        ))}

      {slide.video &&
        (slide.end === undefined ? (
          <video
            ref={full}
            src={cached(slide.video)}
            // Cut to its trim: the browser loops it, seamlessly.
            loop
            preload="auto"
            {...BARE}
            className="cinema-full"
            data-playing={playing ? "" : undefined}
            onLoadedMetadata={(e) => {
              measure(e.currentTarget.videoWidth, e.currentTarget.videoHeight);
              if (slide.start) e.currentTarget.currentTime = slide.start;
            }}
            onPlaying={() => {
              setPlaying(true);
              ready();
            }}
          />
        ) : (
          // A trim inside a longer clip: two copies, taking turns.
          <TrimmedVideo
            src={cached(slide.video)}
            poster={slide.still}
            start={slide.start ?? 0}
            end={slide.end}
            active={active}
            onMeasure={measure}
            onSilent={onSilent}
            onReady={() => {
              setPlaying(true);
              ready();
            }}
          />
        ))}

      {!slide.video && slide.embed && active && (
        <iframe
          src={`${slide.embed}${slide.embed.includes("?") ? "&" : "?"}autoplay=1`}
          title={title}
          className="cinema-full"
          data-playing=""
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={ready}
        />
      )}
    </>
  );
}

export default function CinemaGallery({
  clips,
  initialSlug,
  initialSlide = 0,
}: {
  clips: ViewClip[];
  /** Set on /slug: open on that post, already large. */
  initialSlug?: string;
  /** And on /slug/2 and on: that slide, from 0. */
  initialSlide?: number;
}) {
  // Null on the server and in the first render, which has to match it.
  const sound = useSyncExternalStore(subscribeSound, allowed, () => null);
  // A /slug page renders already open, so the grid is never seen first. Where
  // the box goes needs the window, so it is placed right after mounting.
  const initialIndex = initialSlug ? clips.findIndex((c) => c.slug === initialSlug) : -1;
  const [index, setIndex] = useState<number | null>(initialIndex >= 0 ? initialIndex : null);
  const [slide, setSlide] = useState(initialIndex >= 0 ? initialSlide : 0);
  const [expanded, setExpanded] = useState(initialIndex >= 0);
  const [box, setBox] = useState<Rect | null>(null);
  const [animate, setAnimate] = useState(initialIndex < 0);
  const [stalled, setStalled] = useState(false);
  // The dots (and the share button) show fully for a while after anything
  // draws the eye to them — opening, a slide changing, the pointer on them —
  // then dim.
  const [awake, setAwake] = useState(true);
  const [sharing, setSharing] = useState<string | null>(null);
  // A clip that had to start silent: a browser only plays sound after a tap,
  // and arriving straight at /slug (or reloading there) is not one.
  const [silent, setSilent] = useState(false);
  // Black behind everything, page and browser bars included, while a post is up.
  const [dark, setDark] = useState(false);
  // Signed into the dashboard: only then is there a Share button. Asked once,
  // since these pages are the same for everyone and cached as such.
  const [admin, setAdmin] = useState(false);
  // Null until measured: the server, and the first render, have every post.
  const [win, setWin] = useState<Window | null>(null);

  const list = useRef<HTMLUListElement>(null);
  const tiles = useRef<(HTMLAnchorElement | null)[]>([]);
  /** Measured shapes, by "post:slide". */
  const aspects = useRef(new Map<string, number>());
  const base = useRef("");
  const pushed = useRef(false);
  const closing = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const awakeTimer = useRef<number | null>(null);
  const hovering = useRef(false);

  /* ---------------------------------------------------------------- */
  /* The window of mounted posts                                       */
  /* ---------------------------------------------------------------- */

  /** Mounts the rows from a screen above the viewport to a screen below it. */
  const measureWindow = useCallback(
    (scrollY = window.scrollY) => {
      const ul = list.current;
      if (!ul) return;
      const { cols, stride } = gridMetrics(ul.clientWidth);
      const rows = Math.ceil(clips.length / cols);
      const top = ul.getBoundingClientRect().top + window.scrollY;
      const vh = window.innerHeight;
      const first = Math.max(0, Math.floor((scrollY - top - vh) / stride));
      const last = Math.min(rows - 1, Math.ceil((scrollY - top + 2 * vh) / stride));
      const next: Window = {
        start: first * cols,
        end: Math.min(clips.length, (last + 1) * cols),
        above: first * stride,
        // Each unmounted row stands in with its gap: the rows above end in
        // theirs, the rows below start with theirs.
        below: Math.max(0, rows - 1 - last) * stride,
      };
      setWin((prev) =>
        prev && prev.start === next.start && prev.end === next.end && Math.abs(prev.above - next.above) < 0.5 && Math.abs(prev.below - next.below) < 0.5
          ? prev
          : next
      );
    },
    [clips.length]
  );

  useEffect(() => {
    const onScroll = () => measureWindow();
    measureWindow();
    window.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(() => measureWindow());
    if (list.current) observer.observe(list.current);
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [measureWindow]);

  /**
   * Makes sure post i's tile is mounted, scrolling the (invisible) grid to it
   * if it was not, so the box has somewhere to close into.
   */
  const ensureTile = (i: number) => {
    const ul = list.current;
    if (tiles.current[i] || !ul) return;
    const { cols, stride, tile } = gridMetrics(ul.clientWidth);
    const top = ul.getBoundingClientRect().top + window.scrollY;
    const y = Math.max(0, top + Math.floor(i / cols) * stride + tile / 2 - window.innerHeight / 2);
    window.scrollTo(0, y);
    flushSync(() => measureWindow(y));
  };

  /* ---------------------------------------------------------------- */
  /* The open post                                                     */
  /* ---------------------------------------------------------------- */

  const aspectOf = useCallback(
    (i: number, s: number) =>
      aspects.current.get(`${i}:${s}`) ?? clips[i]?.slides[s]?.aspect ?? 16 / 9,
    [clips]
  );

  /**
   * As large as fits, at the slide's own shape. Above the dots and centred
   * across; on a phone, dead centre, with the dots in the margin on the right;
   * on a phone turned sideways, the whole screen, with the dots over the clip.
   */
  const target = useCallback(
    (i: number, s: number): Rect => {
      const a = aspectOf(i, s);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const phone = vw < PHONE;
      // A phone on its side: too short for margins. The same test as the CSS
      // that lays the dots over the clip (globals.css).
      const sideways = vh <= SIDEWAYS && vw > vh;
      const maxW = sideways ? vw : vw - (phone ? SIDE : MARGIN) * 2;
      const maxH = sideways ? vh : vh - MARGIN * 2 - (phone ? 0 : DOTS);
      let width = maxW;
      let height = width / a;
      if (height > maxH) {
        height = maxH;
        width = height * a;
      }
      return {
        left: (vw - width) / 2,
        top: phone || sideways ? (vh - height) / 2 : MARGIN + (maxH - height) / 2,
        width,
        height,
      };
    },
    [aspectOf]
  );

  /** Full now, dim after a while — unless the pointer is still on them. */
  const wake = useCallback(() => {
    setAwake(true);
    if (awakeTimer.current !== null) window.clearTimeout(awakeTimer.current);
    awakeTimer.current = window.setTimeout(() => {
      awakeTimer.current = null;
      if (!hovering.current) setAwake(false);
    }, LINGER);
  }, []);

  /** The shape of whatever the tile has already loaded, so the box knows where to grow to. */
  const measureTile = (i: number) => {
    const media = tiles.current[i]?.querySelector("video, img");
    const [w, h] =
      media instanceof HTMLVideoElement
        ? [media.videoWidth, media.videoHeight]
        : media instanceof HTMLImageElement
          ? [media.naturalWidth, media.naturalHeight]
          : [0, 0];
    // An uploaded clip's own measured size wins over its cover's.
    const key = `${i}:0`;
    if (w && h && !clips[i].slides[0]?.aspect && !aspects.current.has(key)) {
      aspects.current.set(key, w / h);
    }
  };

  /** The address for a slide, on whichever host this is being served from. */
  const hrefFor = (i: number, s: number) => `${base.current}/${slidePath(clips[i].slug, s)}`;

  const open = useCallback(
    (i: number, s: number, push: boolean) => {
      if (closing.current !== null) {
        window.clearTimeout(closing.current);
        closing.current = null;
      }
      measureTile(i);
      // Put the box where it belongs, still invisible, and make the browser
      // take that in (reading its size forces it to) before fading it up. Set
      // in one go, the two would fold together and there would be nothing to
      // fade. No animation frames: a background tab never gets any.
      flushSync(() => {
        setAnimate(false);
        setIndex(i);
        setSlide(s);
        setSilent(false);
        setBox(target(i, s));
        setExpanded(false);
      });
      boxRef.current?.getBoundingClientRect();
      setExpanded(true);
      setDark(true);
      // From here on the box may move between slides, and that does animate.
      setAnimate(true);
      wake();
      hold(clips[i].slug, postFiles(clips[i]));
      if (push) {
        window.history.pushState(null, "", hrefFor(i, s));
        pushed.current = true;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clips, target, wake]
  );

  const shrink = useCallback(() => {
    if (index === null) return;
    // The grid is still behind the fade, so bringing the tile into view is not
    // seen; it has to exist for its loop to be started again below.
    ensureTile(index);
    setExpanded(false);
    setDark(false);
    setSilent(false);
    const slug = clips[index].slug;
    const closed = index;
    closing.current = window.setTimeout(() => {
      // Back to the first frame, so the tile picks up where the post left off
      // rather than wherever its loop had wandered to.
      const media = tiles.current[closed]?.querySelector("video");
      if (media instanceof HTMLVideoElement) {
        media.currentTime = 0;
        media.play().catch(() => {});
      }
      setIndex(null);
      setSlide(0);
      setBox(null);
      setSharing(null);
      closing.current = null;
      release(slug);
    }, FADE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  /** Close from the page (Esc, a click on black): Back does the work if we pushed. */
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", base.current || "/");
      shrink();
    }
  }, [shrink]);

  /** Another slide of the open post, at its own address. The box re-shapes to it. */
  const show = useCallback(
    (s: number) => {
      if (index === null || s < 0 || s >= clips[index].slides.length || s === slide) return;
      setAnimate(true);
      setSlide(s);
      setBox(target(index, s));
      setSharing(null);
      wake();
      window.history.replaceState(null, "", hrefFor(index, s));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clips, index, slide, target, wake]
  );

  useEffect(() => {
    let live = true;
    fetch("/dashboard/api/session")
      .then((res) => (res.ok ? res.json() : { admin: false }))
      .then((data: { admin?: boolean }) => {
        if (live && data.admin) setAdmin(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // First look: where this is served from, and a /slug page's box placed.
  useEffect(() => {
    base.current = window.location.pathname.startsWith("/cinema") ? "/cinema" : "";
    if (initialIndex < 0) return;
    const timer = window.setTimeout(() => {
      setBox(target(initialIndex, initialSlide));
      wake();
    });
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back and Forward. Back from an open post lands on the grid's address.
  useEffect(() => {
    const onPop = () => {
      const [slug = "", n] = window.location.pathname
        .slice(base.current.length)
        .split("/")
        .filter(Boolean);
      const i = clips.findIndex((c) => c.slug === slug);
      if (i >= 0) {
        const s = n ? Math.min(Math.max(Number(n) - 1, 0), clips[i].slides.length - 1) : 0;
        open(i, s, false);
      } else {
        pushed.current = false;
        shrink();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [clips, open, shrink]);

  // Keys, the page not scrolling under an open post, and a resize re-fitting it.
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") show(slide + 1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") show(slide - 1);
    };
    const onResize = () => {
      setAnimate(false);
      setBox(target(index, slide));
    };
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      root.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [index, slide, close, show, target]);

  useEffect(
    () => () => {
      if (awakeTimer.current !== null) window.clearTimeout(awakeTimer.current);
    },
    []
  );

  /**
   * Black behind everything while a post is up, and the page's own colour back
   * when it goes — faded, not switched, so closing does not jump. On the way in
   * it is immediate: iOS Safari tints its bars from the page the moment the
   * post opens, and would catch a colour still on its way to black.
   */
  useEffect(() => {
    const root = document.documentElement;
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (dark) {
      if (theme && !theme.dataset.was) theme.dataset.was = theme.content;
      root.dataset.cinemaOpen = "";
      if (theme) theme.content = "#000000";
      return;
    }
    // Its value is an empty string, so ask whether it is there at all.
    if (!("cinemaOpen" in root.dataset)) return;
    delete root.dataset.cinemaOpen;
    root.dataset.cinemaClosing = "";
    if (theme?.dataset.was) {
      theme.content = theme.dataset.was;
      delete theme.dataset.was;
    }
    const timer = window.setTimeout(() => delete root.dataset.cinemaClosing, FADE);
    return () => window.clearTimeout(timer);
  }, [dark]);

  const onAspect = (i: number, s: number, aspect: number) => {
    const key = `${i}:${s}`;
    if (Math.abs((aspects.current.get(key) ?? 0) - aspect) < 0.001) return;
    aspects.current.set(key, aspect);
    // Settle on the real shape if this slide is the one open and grown.
    if (i === index && s === slide && expanded && closing.current === null) {
      setAnimate(true);
      setBox(target(i, s));
    }
  };

  /**
   * On a phone, the story card for the slide showing, to the share sheet. On a
   * computer, where there is no story to post it to, just the slide's link, copied.
   */
  const share = async () => {
    if (index === null || sharing === "Making story…") return;
    const post = clips[index];
    const current = post.slides[slide];
    const url = slideUrl(post.slug, slide);
    wake();
    // Copied the moment Share is tapped, while the tap still allows it. A story
    // carries no link of its own — only Instagram's own link sticker does, and
    // only the person posting can add one — so the address is ready to paste
    // into it.
    const copied = await navigator.clipboard?.writeText(url).then(
      () => true,
      () => false
    );
    if (!window.matchMedia("(pointer: coarse)").matches) {
      setSharing(copied ? "Link copied" : url);
      return;
    }
    setSharing("Making story…");
    const file = current?.share
      ? await makeStory({
          src: current.share,
          label: post.show || post.title,
          date: shortDate(post.date),
          url: url.replace(/^https?:\/\//, ""),
          name: slidePath(post.slug, slide).replace("/", "-"),
        })
      : null;
    const result = await shareStory(file, url);
    setSharing(
      result === "saved"
        ? "Story saved · link copied"
        : result === "copied"
          ? "Link copied"
          : result === "shared"
            ? copied
              ? "Shared · link copied, paste it into a link sticker"
              : "Shared"
            : null
    );
    wake();
  };

  // Null in the first render, to match the server's; false puts the prompt up.
  const ready = sound === true;
  // The box only travels between slides of a post; opening and closing it is a
  // fade, so that is always on.
  const moves = animate
    ? `left ${DURATION}ms ${EASE}, top ${DURATION}ms ${EASE}, width ${DURATION}ms ${EASE}, height ${DURATION}ms ${EASE}, `
    : "";
  const fade = `opacity ${FADE}ms ease`;
  const chrome = {
    opacity: expanded ? (awake ? 1 : 0.3) : 0,
    transition: expanded && animate ? "opacity 400ms ease" : fade,
  };
  const post = index !== null ? clips[index] : null;
  const shown = win ? clips.slice(win.start, win.end) : clips;
  const offset = win?.start ?? 0;

  return (
    <>
      {sound === false && (
        <div className="cinema-ask" role="dialog" aria-label="Sound">
          <p>Clips play with sound. Is that all right?</p>
          {/* Two equal columns, so both are as wide as the wider label. */}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn btn-primary" onClick={allow}>
              Allow
            </button>
            {/* No quiet way in: sound is the point, so no leaves for the site. */}
            <a href={HOME_HREF} className="btn text-center">
              No thanks
            </a>
          </div>
        </div>
      )}

      <div style={{ visibility: ready ? "visible" : "hidden" }}>
        <ul
          ref={list}
          className="cinema-grid"
          style={{
            opacity: expanded ? 0 : 1,
            transition: fade,
            paddingTop: win?.above,
            paddingBottom: win?.below,
          }}
        >
          {shown.map((clip, k) => {
            const i = offset + k;
            return (
              <Tile
                key={clip.slug}
                clip={clip}
                hidden={index === i}
                tileRef={(el) => {
                  tiles.current[i] = el;
                }}
                onOpen={() => open(i, 0, true)}
              />
            );
          })}
        </ul>

        {post && index !== null && (
          <>
            <div
              className="cinema-backdrop"
              style={{ opacity: expanded ? 1 : 0, transition: fade }}
              onClick={close}
            />

            {box && (
              <div
                ref={boxRef}
                className="cinema-box"
                style={{
                  ...box,
                  opacity: expanded ? 1 : 0,
                  transition: `${moves}${fade}`,
                  // Grey if the slide has shown nothing; the backdrop is the
                  // black behind it otherwise.
                  backgroundColor: stalled ? "#2a2a2a" : undefined,
                }}
                // A browser that refused sound gives it up for a tap.
                onPointerUp={() => {
                  let found = false;
                  boxRef.current?.querySelectorAll("video").forEach((video) => {
                    // The spare copy of a trimmed clip is muted on purpose.
                    if (video.muted && !video.paused) {
                      video.muted = false;
                      // Some browsers stop a video the moment it gains a voice;
                      // the tap that got it here allows it to carry on.
                      void video.play().catch(() => {});
                      found = true;
                    }
                  });
                  if (found) setSilent(false);
                }}
              >
                <ViewerMedia
                  key={`${post.slug}:${slide}`}
                  slide={post.slides[slide] ?? post.slides[0]}
                  title={post.title}
                  active={ready}
                  onAspect={(a) => onAspect(index, slide, a)}
                  onStalled={setStalled}
                  onSilent={() => setSilent(true)}
                />
              </div>
            )}

            {admin && (
              <div
                className="cinema-share"
                style={chrome}
                onMouseEnter={() => {
                  hovering.current = true;
                  setAwake(true);
                }}
                onMouseLeave={() => {
                  hovering.current = false;
                  wake();
                }}
              >
                {sharing && <span>{sharing}</span>}
                <button type="button" aria-label="Share" onClick={share}>
                  <Icon name="material-symbols:ios-share-rounded" size="1.3em" />
                </button>
              </div>
            )}

            {silent && (
              <p className="cinema-silent" style={chrome}>
                Tap for sound
              </p>
            )}

            {post.slides.length > 1 && (
              <nav
                className="cinema-dots"
                aria-label="Slides"
                style={chrome}
                onMouseEnter={() => {
                  hovering.current = true;
                  setAwake(true);
                }}
                onMouseLeave={() => {
                  hovering.current = false;
                  wake();
                }}
              >
                {post.slides.map((_, s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={`Slide ${s + 1} of ${post.slides.length}`}
                    aria-current={s === slide ? "true" : undefined}
                    onClick={() => show(s)}
                  />
                ))}
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
