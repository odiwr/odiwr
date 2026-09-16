"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { WishItem } from "@/lib/content";
import BackLink from "@/components/work/BackLink";
import {
  backgroundStyle,
  formatPrice,
  hostOf,
  wishBackground,
  wishImage,
  wishSite,
} from "@/lib/wish";

/**
 * The wishlist page: the header with its Filter, the intro the filters swap in
 * for, and the list, one section per category.
 *
 * Rendered as three siblings (a fragment) so each is still a direct child of
 * the page's `.enter` column and drops in on its own beat.
 *
 * Filtering never refetches: everything visible is already here, and hidden
 * items were dropped on the server before any of it was sent.
 */

type Sort = "default" | "low" | "high";

type Filters = {
  category: string | null;
  /** A store's key: its name, lower-cased, so "Amazon" and "amazon" are one. */
  store: string | null;
  sort: Sort;
  purchased: boolean;
};

const DEFAULTS: Filters = { category: null, store: null, sort: "default", purchased: false };

/** Must match .wish-swap's and .wish-results' height transition in globals.css. */
const SWAP_MS = 440;
/** How long a tile or heading takes to glide to its new place. */
const MOVE_MS = 440;
/** How long something leaving takes to dissolve, and something arriving to appear. */
const LEAVE_MS = 220;
const ARRIVE_MS = 320;
const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

/** Where everything in the list was, the moment before a filter changed it. */
type Snapshot = {
  origin: DOMRect;
  height: number;
  places: Map<string, { rect: DOMRect; node: HTMLElement }>;
};

const storeKey = (item: WishItem) => wishSite(item).trim().toLowerCase();

export default function Wishlist({
  groups,
  intro,
}: {
  groups: { category: string; items: WishItem[] }[];
  intro: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const panelId = useId();

  const swap = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const resultsInner = useRef<HTMLDivElement>(null);
  const snapshot = useRef<Snapshot | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);

  const everything = groups.flatMap((g) => g.items);

  // Stores named the same way are one store, labelled as first written.
  const storeLabels = new Map<string, string>();
  for (const item of everything) {
    const key = storeKey(item);
    if (!storeLabels.has(key)) storeLabels.set(key, wishSite(item).trim());
  }
  // Alphabetical: with a couple of dozen shops, first-seen order is unscannable.
  const stores = [...storeLabels]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  const shown = groups
    .filter((g) => filters.category === null || g.category === filters.category)
    .map((g) => {
      const items = g.items.filter(
        (item) =>
          (filters.purchased || !item.purchased) &&
          (filters.store === null || storeKey(item) === filters.store)
      );
      if (filters.sort !== "default") {
        const direction = filters.sort === "low" ? 1 : -1;
        // Stable, so equal prices keep the order set in the dashboard, and
        // anything without a price goes last either way.
        items.sort((a, b) => {
          if (a.price === undefined || b.price === undefined) {
            return (a.price === undefined ? 1 : 0) - (b.price === undefined ? 1 : 0);
          }
          return (a.price - b.price) * direction;
        });
      }
      return { category: g.category, items };
    })
    .filter((g) => g.items.length);

  const changed =
    filters.category !== null ||
    filters.store !== null ||
    filters.sort !== "default" ||
    filters.purchased;

  /**
   * A new choice.
   *
   * Nothing that stays is faded: before the list changes, where every tile and
   * heading sits is noted, and once it has changed each one glides from there to
   * its new place. Only what is going away dissolves (a copy of it, left where
   * it was), and only what is new fades in. The list's height slides to fit.
   *
   * Clicking again mid-move starts from wherever things are at that moment.
   */
  const choose = (next: Filters) => {
    // Clicking what is already chosen changes nothing, so nothing moves.
    if ((Object.keys(next) as (keyof Filters)[]).every((key) => next[key] === filters[key])) {
      return;
    }
    const box = results.current;
    if (box && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const places = new Map<string, { rect: DOMRect; node: HTMLElement }>();
      box.querySelectorAll<HTMLElement>("[data-flip]").forEach((node) => {
        places.set(node.dataset.flip!, { rect: node.getBoundingClientRect(), node });
      });
      snapshot.current = { origin: box.getBoundingClientRect(), height: box.offsetHeight, places };
      box.style.height = `${box.offsetHeight}px`;
    }
    setFilters(next);
  };

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    choose({ ...filters, [key]: value });

  // The new list is in the DOM, not yet painted: play the moves from the snapshot.
  useLayoutEffect(() => {
    const before = snapshot.current;
    const box = results.current;
    const inner = resultsInner.current;
    snapshot.current = null;
    if (!before || !box || !inner) return;

    for (const node of box.querySelectorAll<HTMLElement>("[data-flip]")) {
      // Measure where it now belongs, not where an unfinished move has it.
      node.getAnimations().forEach((animation) => animation.cancel());
      const key = node.dataset.flip!;
      const was = before.places.get(key);
      before.places.delete(key);

      if (was) {
        const now = node.getBoundingClientRect();
        const dx = was.rect.left - now.left;
        const dy = was.rect.top - now.top;
        if (dx || dy) {
          node.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
            { duration: MOVE_MS, easing: EASE }
          );
        }
      } else {
        node.animate(
          [
            { opacity: 0, filter: "blur(4px)" },
            { opacity: 1, filter: "none" },
          ],
          { duration: ARRIVE_MS, delay: LEAVE_MS / 2, easing: "ease", fill: "backwards" }
        );
      }
    }

    // Whatever is left in the snapshot has gone. A copy of each dissolves where
    // the original was; the list itself has already moved on without it.
    for (const { rect, node } of before.places.values()) {
      const ghost = node.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-flip");
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      Object.assign(ghost.style, {
        position: "absolute",
        left: `${rect.left - before.origin.left}px`,
        top: `${rect.top - before.origin.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        listStyle: "none",
        pointerEvents: "none",
      });
      box.appendChild(ghost);
      ghost
        .animate(
          [
            { opacity: 1, filter: "none" },
            { opacity: 0, filter: "blur(4px)" },
          ],
          { duration: LEAVE_MS, easing: "ease", fill: "forwards" }
        )
        .finished.then(
          () => ghost.remove(),
          () => ghost.remove()
        );
    }

    // Slide the height from what it was to what the new list needs, then let go.
    box.style.height = `${before.height}px`;
    void box.offsetHeight;
    box.style.height = `${inner.offsetHeight}px`;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      box.style.height = "";
    }, SWAP_MS);
  }, [filters]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  /**
   * The intro and the filters share one slot, and the slot's height follows
   * whichever is showing, so everything below slides rather than jumps.
   *
   * Height only transitions between two lengths, so it is pinned to the current
   * one first, then set to the target. Closed and settled, it goes back to auto
   * — which is also how it renders before any script runs.
   */
  useEffect(() => {
    const box = swap.current;
    const panel = panelRef.current;
    const text = introRef.current;
    if (!box || !panel || !text) return;

    const target = () => (open ? panel.offsetHeight : text.offsetHeight);

    // Nothing to animate on first mount, closed.
    if (!open && !box.style.height) return;

    box.style.height = `${box.offsetHeight}px`;
    // Read back so the pinned height is committed before it changes.
    void box.offsetHeight;
    box.style.height = `${target()}px`;

    // The panel rewraps as the window narrows; keep up with it while open.
    const observer = new ResizeObserver(() => {
      if (open) box.style.height = `${target()}px`;
    });
    observer.observe(panel);

    const settle = open
      ? undefined
      : window.setTimeout(() => {
          box.style.height = "";
        }, SWAP_MS + 40);

    return () => {
      observer.disconnect();
      if (settle) window.clearTimeout(settle);
    };
  }, [open]);

  const hasItems = everything.length > 0;

  return (
    <>
      <header className="flex items-baseline justify-between gap-4">
        {/* Someone given this link may never have seen the main site, so the
            way out names where it goes. */}
        <BackLink label="odiwr.com" />
        <h1 className="sr-only">Wishlist</h1>

        {hasItems && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            className={`inline-flex items-center gap-1.5 font-medium transition-colors hover:text-accent ${
              open || changed ? "text-accent" : ""
            }`}
          >
            <FilterGlyph />
            Filter
          </button>
        )}
      </header>

      <div ref={swap} className="wish-swap" data-open={open}>
        <div ref={introRef} className="wish-swap-intro" inert={open} aria-hidden={open}>
          {intro}
        </div>

        <div
          ref={panelRef}
          id={panelId}
          className="wish-swap-panel"
          inert={!open}
          aria-hidden={!open}
          role="group"
          aria-label="Filters"
        >
          <FilterRow label="Category">
            <Chip active={filters.category === null} onClick={() => set("category", null)}>
              All
            </Chip>
            {groups.map((g) => (
              <Chip
                key={g.category}
                active={filters.category === g.category}
                onClick={() => set("category", g.category)}
              >
                {g.category}
              </Chip>
            ))}
          </FilterRow>

          <FilterRow label="Store">
            <Chip active={filters.store === null} onClick={() => set("store", null)}>
              All
            </Chip>
            {stores.map((s) => (
              <Chip key={s.key} active={filters.store === s.key} onClick={() => set("store", s.key)}>
                {s.label}
              </Chip>
            ))}
          </FilterRow>

          <FilterRow label="Price">
            <Chip active={filters.sort === "default"} onClick={() => set("sort", "default")}>
              Default
            </Chip>
            <Chip active={filters.sort === "low"} onClick={() => set("sort", "low")}>
              Low to high
            </Chip>
            <Chip active={filters.sort === "high"} onClick={() => set("sort", "high")}>
              High to low
            </Chip>
          </FilterRow>

          <FilterRow label="Purchased">
            <Chip active={!filters.purchased} onClick={() => set("purchased", false)}>
              Hide
            </Chip>
            <Chip active={filters.purchased} onClick={() => set("purchased", true)}>
              Show
            </Chip>
            {changed && (
              <button
                type="button"
                onClick={() => choose(DEFAULTS)}
                className="ml-auto text-foreground/40 transition-colors hover:text-accent"
              >
                Reset
              </button>
            )}
          </FilterRow>
        </div>
      </div>

      {!hasItems ? (
        <p className="text-foreground/50">Nothing here yet.</p>
      ) : (
        <div ref={results} className="wish-results">
          <div ref={resultsInner}>
            {shown.length === 0 ? (
              <p className="text-foreground/50" data-flip="empty">
                Nothing matches.
              </p>
            ) : (
              <div className="flex flex-col gap-14">
                {shown.map((group) => (
                  <section key={group.category} className="flex flex-col gap-4">
                    {/* Plain white and underlined: the one place on the page with
                        no picture to lead the eye, so the headings carry the
                        structure. */}
                    <h2
                      data-flip={`heading:${group.category}`}
                      className="w-max text-white underline decoration-white decoration-1 underline-offset-[2.5px]">
                      {group.category}
                    </h2>
                    <ul className="wish-grid">
                      {group.items.map((item) => (
                        <li key={item.id} data-flip={`item:${item.id}`}>
                          <Tile item={item} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="wish-filter-row">
      <span className="text-foreground/50">{label}</span>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className="wish-chip">
      {children}
    </button>
  );
}

/**
 * Material Symbols' filter-list-rounded, drawn as its three bars so each can
 * move on its own: they narrow and widen in turn, top to bottom, like something
 * being sifted. Same geometry as the library icon, so at rest it is that icon.
 */
function FilterGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.1em"
      height="1.1em"
      aria-hidden="true"
      focusable="false"
      className="filter-glyph"
      style={{ display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0 }}
    >
      <rect x="3" y="6" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="6" y="11" width="12" height="2" rx="1" fill="currentColor" />
      <rect x="10" y="16" width="4" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function Tile({ item }: { item: WishItem }) {
  const src = wishImage(item);
  // A shop that blocks hotlinking gives a broken image; show the blank tile
  // instead of the browser's broken-image glyph.
  const [failed, setFailed] = useState(false);
  // The colour behind the picture: the pulled image's own background, so the
  // photo fills the card, or one set by hand in the dashboard.
  const background = src && !failed ? wishBackground(item) : undefined;

  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer noopener"
      className="wish-tile group"
      data-purchased={item.purchased ? "" : undefined}
    >
      <span
        className="wish-image"
        style={backgroundStyle(background)}
      >
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote images from any shop; nothing to optimise through
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            // Sized in the dashboard, from half to one and a half times.
            style={
              item.imageScale && item.imageScale !== 100
                ? { transform: `scale(${item.imageScale / 100})` }
                : undefined
            }
          />
        ) : (
          <span className="wish-initial" aria-hidden="true">
            {hostOf(item.href).charAt(0)}
          </span>
        )}

        {item.price !== undefined && !item.purchased && (
          <span className="wish-price">{formatPrice(item.price)}</span>
        )}
      </span>

      {/* The whole name, over as many lines as it takes. It grows to fill the
          card, so the line below lines up across the row whatever the title's
          length. Hovering the card recolours the text; the picture stays still. */}
      <span className="mt-3 flex-1 text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent">
        {item.title}
      </span>
      <span className="flex items-baseline justify-between gap-3 text-foreground/50">
        <span className="truncate">{wishSite(item)}</span>
        {item.purchased && <span className="shrink-0 text-accent">Purchased</span>}
      </span>
    </a>
  );
}
