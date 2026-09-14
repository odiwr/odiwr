"use client";

import { useState } from "react";
import type { WishItem } from "@/lib/content";
import { hostOf, wishBackground, wishImage, wishSite } from "@/lib/wish";

/**
 * The wishlist, one section per category, every category shown.
 *
 * Headings are plain white and underlined: the one place on the page with no
 * picture to lead the eye, so they carry the structure.
 */
export default function Wishlist({ groups }: { groups: { category: string; items: WishItem[] }[] }) {
  return (
    <div className="flex flex-col gap-14">
      {groups.map((group) => (
        <section key={group.category} className="flex flex-col gap-4">
          <h2 className="w-max text-white underline decoration-white decoration-1 underline-offset-[2.5px]">
            {group.category}
          </h2>
          <ul className="wish-grid">
            {group.items.map((item) => (
              <li key={item.id}>
                <Tile item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
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
    <a href={item.href} target="_blank" rel="noreferrer noopener" className="wish-tile group">
      <span
        className="wish-image"
        style={background ? { backgroundColor: background } : undefined}
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
      </span>

      {/* The whole name, over as many lines as it takes. Hovering the card
          recolours the text; the picture stays still. */}
      <span className="mt-3 text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent">
        {item.title}
      </span>
      <span className="text-foreground/50">{wishSite(item)}</span>
      {item.note && <span className="mt-1 text-foreground/40">{item.note}</span>}
    </a>
  );
}
