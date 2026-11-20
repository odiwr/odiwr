"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/icons";
import { justify, type ViewItem } from "@/lib/portfolio";

/**
 * portfolio.odiwr.com, all of it: the pictures, and the viewer a picture opens
 * into. No words anywhere — not a title, not a caption, not a count.
 *
 * The order is shuffled on the server for every visit (app/portfolio/page.tsx)
 * and handed in as it is, so the browser hydrates the same order it was sent.
 * The grid is justified rows cut ahead of time for that order
 * (lib/portfolio.ts): every item at its own shape, uncropped, and the server's
 * HTML is already the final layout, so nothing jumps when the script arrives.
 * Rows drop in top to bottom, the home page's entrance.
 *
 * A video plays on its tile, muted, looping, only while it is on screen. A
 * tile opens into the viewer: white, the picture as large as the window allows,
 * arrows and keys to step through, a swipe on a phone. Opening pushes #id onto
 * the address, so Back closes it and a link with the hash opens on that
 * picture; stepping replaces it, so Back still means "back to the grid".
 */

/** How far a finger has to travel sideways for a swipe. */
const SWIPE = 48;
/** A tile's loop plays only while at least this much of it is on screen. */
const VISIBLE = 0.25;

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

/** Plays a video while enough of it is on screen, and pauses it otherwise. */
function useOnScreen(video: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: VISIBLE }
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, [video]);
}

/**
 * What a screen reader hears for an item: its alt text, from the dashboard.
 * Until one is written, "Photograph 12 of 56", so the items are at least told
 * apart rather than all being "Photograph".
 */
function itemName(item: ViewItem, index: number, count: number): string {
  if (item.alt) return item.alt;
  return `${item.kind === "video" ? "Video" : "Photograph"} ${index + 1} of ${count}`;
}

function Tile({
  item,
  name,
  style,
  onOpen,
}: {
  item: ViewItem;
  name: string;
  style: Record<string, string>;
  onOpen: () => void;
}) {
  const loop = useRef<HTMLVideoElement>(null);
  useOnScreen(loop);

  return (
    <a
      href={`#${item.id}`}
      className="pxs-cell"
      style={{ aspectRatio: `${item.width} / ${item.height}`, ...style } as React.CSSProperties}
      aria-label={name}
      onClick={(e) => {
        if (!plainClick(e)) return;
        e.preventDefault();
        onOpen();
      }}
    >
      {item.kind === "image" ? (
        // Not next/image: the copies are already made at the size the grid
        // wants, and an animated GIF would be flattened to a still.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumb}
          alt={item.alt ?? ""}
          width={item.width}
          height={item.height}
          loading="lazy"
          decoding="async"
          ref={arrived}
          onLoad={markLoaded}
          onError={markLoaded}
        />
      ) : (
        // The still shows until the loop has something to play, and nothing is
        // fetched until the tile comes on screen. With no still, it fades in
        // once its first frame is there.
        <video
          ref={loop}
          src={item.loop}
          poster={item.thumb || undefined}
          data-loaded={item.thumb ? "" : undefined}
          preload="none"
          muted
          loop
          playsInline
          aria-hidden="true"
          onLoadedData={markLoaded}
          onError={markLoaded}
        />
      )}
    </a>
  );
}

function Viewer({
  item,
  name,
  count,
  onStep,
  onClose,
}: {
  item: ViewItem;
  name: string;
  count: number;
  onStep: (delta: number) => void;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
  }, []);

  const style = { "--ar": item.width / item.height } as React.CSSProperties;

  return (
    <div className="pxs-lightbox" role="dialog" aria-modal="true" aria-label={name}>
      <button ref={closeButton} type="button" className="pxs-lb-close" onClick={onClose} aria-label="Close">
        <Icon name="material-symbols:close-rounded" />
      </button>

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
        <div key={item.id} className="pxs-lb-frame" style={style}>
          {item.kind === "image" ? (
            <>
              {/* The grid's copy, already loaded, held under the sharper one until it arrives. */}
              {item.thumb !== item.full && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumb} alt="" aria-hidden="true" />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="pxs-lb-full"
                src={item.full}
                alt={name}
                ref={arrived}
                onLoad={markLoaded}
                onError={markLoaded}
              />
            </>
          ) : (
            <video src={item.full} poster={item.thumb || undefined} controls autoPlay playsInline />
          )}
        </div>
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

export default function PortfolioGallery({ items }: { items: ViewItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const styles = useMemo(() => justify(items), [items]);

  /** True when opening pushed an address, so closing can go Back to the one before it. */
  const pushed = useRef(false);
  /** The tile that opened the viewer, to give focus back to. */
  const opener = useRef<HTMLElement | null>(null);

  const current = open !== null ? items[open] : undefined;

  const show = useCallback(
    (i: number, push: boolean) => {
      setOpen(i);
      const hash = `#${items[i].id}`;
      if (push) {
        opener.current = document.activeElement as HTMLElement | null;
        window.history.pushState(null, "", hash);
        pushed.current = true;
      } else {
        window.history.replaceState(null, "", hash);
      }
    },
    [items]
  );

  const step = useCallback(
    (delta: number) => {
      if (open === null || !items.length) return;
      show((open + delta + items.length) % items.length, false);
    },
    [open, items, show]
  );

  const shut = useCallback(() => {
    setOpen(null);
    opener.current?.focus({ preventScroll: true });
    opener.current = null;
  }, []);

  /** Close from the page (Esc, the cross): Back does the work if opening pushed. */
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      shut();
    }
  }, [shut]);

  // First look: a #id in the address opened. A timeout, not a state update in
  // the effect body: the viewer opens after the page has hydrated, as a click would.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const i = id ? items.findIndex((v) => v.id === id) : -1;
    const timer = i >= 0 ? window.setTimeout(() => setOpen(i)) : undefined;
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back and Forward: the hash says what is open.
  useEffect(() => {
    const sync = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const i = id ? items.findIndex((v) => v.id === id) : -1;
      if (i >= 0) setOpen(i);
      else {
        pushed.current = false;
        shut();
      }
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [items, shut]);

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
    if (open === null || items.length < 2) return;
    for (const d of [1, -1]) {
      const next = items[(open + d + items.length) % items.length];
      if (next.kind === "image") new Image().src = next.full;
    }
  }, [open, items]);

  return (
    <>
      <div className="pxs-frame">
        <div className="pxs-grid">
          {items.map((item, i) => (
            <Tile
              key={item.id}
              item={item}
              name={itemName(item, i, items.length)}
              style={styles[i]}
              onOpen={() => show(i, true)}
            />
          ))}
        </div>
      </div>

      {current && open !== null && (
        <Viewer
          item={current}
          name={itemName(current, open, items.length)}
          count={items.length}
          onStep={step}
          onClose={close}
        />
      )}
    </>
  );
}
