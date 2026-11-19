"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/icons";
import { HOME_HREF, SITE } from "@/lib/site";
import {
  PORTFOLIO_BASE,
  clock,
  justify,
  type ViewItem,
  type ViewPortfolio,
} from "@/lib/portfolio";

/**
 * portfolio.odiwr.com, all of it: the cover, the bar with the sets, the grid,
 * and the viewer a tile opens into. Laid out after a Pixieset client gallery.
 *
 * The grid is justified rows cut ahead of time (lib/portfolio.ts): every item at
 * its own shape, uncropped, and the server's HTML is already the final layout,
 * so nothing jumps when the script arrives. Choosing a set filters in place and
 * re-cuts the rows for what is left; the address follows (/film), and the same
 * address loaded fresh renders that set from the server.
 *
 * A tile opens into the viewer: white, the picture as large as the window
 * allows, arrows and keys to step through, a swipe on a phone. Opening pushes
 * #id onto the address, so Back closes it and a link with the hash opens on that
 * picture; stepping replaces it, so Back still means "back to the grid". The
 * viewer shows the grid's copy at once (it is already loaded) and the sharper
 * one over it as it arrives.
 *
 * Slideshow steps through on its own, waiting out a video to its end.
 */

const SLIDE_MS = 4000;
/** How far a finger has to travel sideways for a swipe. */
const SWIPE = 48;

/** Marks a picture or video as arrived, which fades it in (portfolio.css). */
function arrived(el: HTMLImageElement | HTMLVideoElement | null) {
  if (!el) return;
  const ready = el instanceof HTMLImageElement ? el.complete : el.readyState >= 2;
  if (ready) el.dataset.loaded = "";
}

const markLoaded = (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
  e.currentTarget.dataset.loaded = "";
};

/** A plain left click, which the page handles; anything else (new tab, …) is the browser's. */
function plainClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function Tile({
  item,
  widths,
  onOpen,
}: {
  item: ViewItem;
  widths: string[];
  onOpen: () => void;
}) {
  const preview = useRef<HTMLVideoElement>(null);
  const style = {
    aspectRatio: `${item.width} / ${item.height}`,
    ...Object.fromEntries(widths.map((w, b) => [`--w${b}`, w])),
  } as React.CSSProperties;
  const label = item.caption || (item.kind === "video" ? "Video" : "Photograph");

  // A video plays muted under a resting mouse, from the start each time. Not
  // on touch, where there is no hovering.
  const hover = (e: React.PointerEvent, on: boolean) => {
    const video = preview.current;
    if (!video || e.pointerType !== "mouse") return;
    if (on) {
      video.currentTime = 0;
      video
        .play()
        .then(() => (video.dataset.playing = ""))
        .catch(() => {});
    } else {
      video.pause();
      delete video.dataset.playing;
    }
  };

  return (
    <a
      href={`#${item.id}`}
      className="pxs-cell"
      style={style}
      data-kind={item.kind}
      aria-label={label}
      onClick={(e) => {
        if (!plainClick(e)) return;
        e.preventDefault();
        onOpen();
      }}
      onPointerEnter={item.kind === "video" ? (e) => hover(e, true) : undefined}
      onPointerLeave={item.kind === "video" ? (e) => hover(e, false) : undefined}
    >
      {item.thumb ? (
        // Not next/image: the copies are already made at the size the grid
        // wants, and an animated GIF would be flattened to a still.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumb}
          alt={item.caption ?? ""}
          width={item.width}
          height={item.height}
          loading="lazy"
          decoding="async"
          ref={arrived}
          onLoad={markLoaded}
          onError={markLoaded}
        />
      ) : (
        // A video whose still could not be made: its own first frame.
        <video
          src={`${item.full}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          ref={arrived}
          onLoadedData={markLoaded}
          onError={markLoaded}
        />
      )}

      {item.kind === "video" && (
        <>
          <video
            ref={preview}
            className="pxs-preview"
            src={item.full}
            preload="none"
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          <span className="pxs-badge" aria-hidden="true">
            <Icon name="material-symbols:play-arrow-rounded" size="1.35em" />
            {item.duration ? clock(item.duration) : null}
          </span>
        </>
      )}
    </a>
  );
}

function Viewer({
  item,
  index,
  count,
  playing,
  onStep,
  onClose,
  onPlay,
}: {
  item: ViewItem;
  index: number;
  count: number;
  playing: boolean;
  onStep: (delta: number) => void;
  onClose: () => void;
  onPlay: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
  }, []);

  const style = { "--ar": item.width / item.height } as React.CSSProperties;

  return (
    <div className="pxs-lightbox" role="dialog" aria-modal="true" aria-label={item.caption || "Viewer"}>
      <div className="pxs-lb-bar">
        <span className="pxs-lb-count">
          {index + 1} / {count}
        </span>
        <div className="pxs-lb-actions">
          {count > 1 && (
            <button
              type="button"
              className="pxs-icon"
              onClick={onPlay}
              aria-label={playing ? "Pause slideshow" : "Play slideshow"}
              title={playing ? "Pause slideshow" : "Slideshow"}
            >
              <Icon
                name={playing ? "material-symbols:pause-rounded" : "material-symbols:play-arrow-rounded"}
              />
            </button>
          )}
          <button ref={closeButton} type="button" className="pxs-icon" onClick={onClose} aria-label="Close" title="Close">
            <Icon name="material-symbols:close-rounded" />
          </button>
        </div>
      </div>

      <div
        className="pxs-lb-stage"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          touch.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) onStep(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => (touch.current = null)}
      >
        {/* Keyed, so each one fades in fresh rather than swapping its file in place. */}
        <figure key={item.id} className="pxs-lb-figure" style={style}>
          <div className="pxs-lb-frame">
            {item.kind === "image" ? (
              <>
                {/* The grid's copy, already loaded, held under the sharper one until it arrives. */}
                {item.thumb !== item.full && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="pxs-lb-low" src={item.thumb} alt="" aria-hidden="true" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="pxs-lb-full"
                  src={item.full}
                  alt={item.caption ?? ""}
                  ref={arrived}
                  onLoad={markLoaded}
                  onError={markLoaded}
                />
              </>
            ) : (
              <video
                src={item.full}
                poster={item.thumb || undefined}
                controls
                autoPlay
                playsInline
                onEnded={() => {
                  if (playing) onStep(1);
                }}
              />
            )}
          </div>
          {item.caption && <figcaption>{item.caption}</figcaption>}
        </figure>
      </div>

      {count > 1 && (
        <>
          <button type="button" className="pxs-lb-arrow pxs-lb-prev" onClick={() => onStep(-1)} aria-label="Previous">
            <Icon name="material-symbols:chevron-left-rounded" />
          </button>
          <button type="button" className="pxs-lb-arrow pxs-lb-next" onClick={() => onStep(1)} aria-label="Next">
            <Icon name="material-symbols:chevron-right-rounded" />
          </button>
        </>
      )}
    </div>
  );
}

export default function PortfolioGallery({
  portfolio,
  initialSet,
}: {
  portfolio: ViewPortfolio;
  /** The set an address named (/film), or null for everything. */
  initialSet: string | null;
}) {
  const { title, subtitle, cover, focus, sets, items } = portfolio;
  const [set, setSet] = useState<string | null>(initialSet);
  const [open, setOpen] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const visible = useMemo(
    () => (set ? items.filter((i) => i.set === set) : items),
    [items, set]
  );
  const widths = useMemo(() => justify(visible), [visible]);

  /** "" on the subdomain, "/portfolio" where it is reached by path. Known only in the browser. */
  const base = useRef("");
  /** True when opening pushed an address, so closing can go Back to the one before it. */
  const pushed = useRef(false);
  /** The tile that opened the viewer, to give focus back to. */
  const opener = useRef<HTMLElement | null>(null);
  const gallery = useRef<HTMLElement>(null);

  const current = open !== null ? visible[open] : undefined;

  /** The address of the page without any hash, for closing without Back. */
  const plain = () => window.location.pathname + window.location.search;

  const show = useCallback(
    (i: number, push: boolean) => {
      setOpen(i);
      const hash = `#${visible[i].id}`;
      if (push) {
        opener.current = document.activeElement as HTMLElement | null;
        window.history.pushState(null, "", hash);
        pushed.current = true;
      } else {
        window.history.replaceState(null, "", hash);
      }
    },
    [visible]
  );

  const step = useCallback(
    (delta: number) => {
      if (open === null || !visible.length) return;
      show((open + delta + visible.length) % visible.length, false);
    },
    [open, visible, show]
  );

  const shut = useCallback(() => {
    setOpen(null);
    setPlaying(false);
    opener.current?.focus({ preventScroll: true });
    opener.current = null;
  }, []);

  /** Close from the page (Esc, the cross): Back does the work if opening pushed. */
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", plain());
      shut();
    }
  }, [shut]);

  const choose = (e: React.MouseEvent, slug: string | null) => {
    if (!plainClick(e)) return;
    e.preventDefault();
    setSet(slug);
    window.history.replaceState(null, "", slug ? `${base.current}/${slug}` : base.current || "/");
    // Back to the top of the grid if it was scrolled past, so a short set does
    // not leave the page somewhere below its end.
    const top = gallery.current?.offsetTop ?? 0;
    if (window.scrollY > top) window.scrollTo({ top });
  };

  // First look: where this is served from, and a #id in the address opened.
  useEffect(() => {
    base.current = window.location.pathname.startsWith("/portfolio") ? "/portfolio" : "";
    const id = decodeURIComponent(window.location.hash.slice(1));
    const i = id ? visible.findIndex((v) => v.id === id) : -1;
    // A timeout, not a state update in the effect body: the viewer opens
    // after the page has hydrated, as a click would.
    const timer = i >= 0 ? window.setTimeout(() => setOpen(i)) : undefined;
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back and Forward: the hash says what is open.
  useEffect(() => {
    const sync = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const i = id ? visible.findIndex((v) => v.id === id) : -1;
      if (i >= 0) setOpen(i);
      else {
        pushed.current = false;
        shut();
      }
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [visible, shut]);

  // While open: keys, and the page not scrolling under it.
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, step]);

  // The neighbours' sharp copies, fetched ahead so stepping is instant.
  useEffect(() => {
    if (open === null || visible.length < 2) return;
    for (const d of [1, -1]) {
      const next = visible[(open + d + visible.length) % visible.length];
      if (next.kind === "image") new Image().src = next.full;
    }
  }, [open, visible]);

  // Slideshow: a picture holds for SLIDE_MS; a video plays out (Viewer's onEnded).
  useEffect(() => {
    if (!playing || !current || current.kind !== "image") return;
    const timer = window.setTimeout(() => step(1), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [playing, current, step]);

  const slideshow = () => {
    if (!visible.length) return;
    setPlaying(true);
    show(0, true);
  };

  const coverStyle = { objectPosition: `${focus.x}% ${focus.y}%` };

  return (
    <>
      {cover ? (
        <header className="pxs-cover">
          {cover.kind === "video" ? (
            <video
              src={cover.full}
              poster={cover.thumb || undefined}
              style={coverStyle}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
              ref={arrived}
              onLoadedData={markLoaded}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.full}
              alt=""
              style={coverStyle}
              fetchPriority="high"
              ref={arrived}
              onLoad={markLoaded}
              onError={markLoaded}
            />
          )}
          <div className="pxs-cover-text">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
            <a
              href="#gallery"
              className="pxs-cover-button"
              onClick={(e) => {
                if (!plainClick(e)) return;
                e.preventDefault();
                gallery.current?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              View gallery
            </a>
          </div>
        </header>
      ) : (
        <header className="pxs-cover pxs-cover-plain">
          <div className="pxs-cover-text">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </header>
      )}

      <section id="gallery" ref={gallery} className="pxs-gallery" aria-label={title}>
        <nav className="pxs-bar" aria-label="Sets">
          <div className="pxs-bar-row">
            <div className="pxs-bar-title">
              <span>{title}</span>
              {subtitle && <small>{subtitle}</small>}
            </div>
            <div className="pxs-bar-actions">
              {visible.length > 1 && (
                <button type="button" className="pxs-icon" onClick={slideshow} aria-label="Slideshow" title="Slideshow">
                  <Icon name="material-symbols:slideshow-outline-rounded" />
                </button>
              )}
              <a href={HOME_HREF} className="pxs-home">
                odiwr.com
              </a>
            </div>
          </div>

          {sets.length > 0 && (
            <ul className="pxs-sets">
              <li>
                <a
                  href={PORTFOLIO_BASE}
                  aria-current={set === null ? "page" : undefined}
                  onClick={(e) => choose(e, null)}
                >
                  All
                </a>
              </li>
              {sets.map((s) => (
                <li key={s.slug}>
                  <a
                    href={`${PORTFOLIO_BASE}/${s.slug}`}
                    aria-current={set === s.slug ? "page" : undefined}
                    onClick={(e) => choose(e, s.slug)}
                  >
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="pxs-frame">
          {visible.length ? (
            <div className="pxs-grid">
              {visible.map((item, i) => (
                <Tile key={item.id} item={item} widths={widths[i]} onOpen={() => show(i, true)} />
              ))}
            </div>
          ) : (
            <p className="pxs-empty">Nothing here yet.</p>
          )}
        </div>
      </section>

      <footer className="pxs-footer">
        <span suppressHydrationWarning>
          © {new Date().getFullYear()} {SITE.fullName}
        </span>
        <a href={HOME_HREF}>odiwr.com</a>
      </footer>

      {current && open !== null && (
        <Viewer
          item={current}
          index={open}
          count={visible.length}
          playing={playing}
          onStep={step}
          onClose={close}
          onPlay={() => setPlaying((p) => !p)}
        />
      )}
    </>
  );
}
