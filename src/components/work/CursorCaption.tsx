"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/icons";

/**
 * A caption box that follows the cursor over the creative mosaic.
 *
 * Any descendant with `data-caption` shows that text while the pointer is over
 * it, with the outward arrow when it also carries `data-linked`. One box serves
 * every tile, so moving from one poster to the next swaps the text in place
 * rather than fading one box out and another in.
 *
 * Position is written straight to the element on each move instead of through
 * state: re-rendering on every pointer event would make the box trail behind.
 * It is portalled to <body> because `position: fixed` measures from the nearest
 * transformed ancestor, and the page's entrance animation transforms this one.
 *
 * Mouse only. A touch has no hover to follow, and the posters' alt text still
 * describes them to screen readers.
 */

/** Gap between the cursor and the box. */
const OFFSET = 14;
/** Closest the box may come to the edge of the window. */
const MARGIN = 8;

export default function CursorCaption({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLSpanElement>(null);
  // Kept after the pointer leaves, so the box fades out still showing its text.
  const [caption, setCaption] = useState<{ text: string; linked: boolean } | null>(null);
  const [visible, setVisible] = useState(false);

  const place = (x: number, y: number) => {
    const el = box.current;
    if (!el) return;
    // offsetWidth, not the bounding box, which the entrance scale shrinks.
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // Flip to the other side of the cursor rather than run off the window.
    const flipX = x + OFFSET + w > window.innerWidth - MARGIN;
    const flipY = y + OFFSET + h > window.innerHeight - MARGIN;
    const left = Math.max(MARGIN, flipX ? x - OFFSET - w : x + OFFSET);
    const top = Math.max(MARGIN, flipY ? y - OFFSET - h : y + OFFSET);
    el.style.translate = `${left}px ${top}px`;
    el.style.transformOrigin = `${flipX ? "right" : "left"} ${flipY ? "bottom" : "top"}`;
  };

  /**
   * The last pointer position, for placing the box the moment it first exists
   * or changes size: the first hover mounts it, and a new caption can be wider,
   * both after the move that caused them has already been handled.
   */
  const pointer = useRef({ x: 0, y: 0 });
  useLayoutEffect(() => {
    place(pointer.current.x, pointer.current.y);
  }, [caption]);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    pointer.current = { x: event.clientX, y: event.clientY };
    const tile = (event.target as Element).closest<HTMLElement>("[data-caption]");
    const text = tile?.dataset.caption;
    if (!tile || !text) {
      setVisible(false);
      return;
    }
    const linked = tile.dataset.linked !== undefined;
    if (caption?.text !== text || caption.linked !== linked) setCaption({ text, linked });
    place(event.clientX, event.clientY);
    setVisible(true);
  };

  // Scrolling moves the page under a cursor that has not moved, so the box
  // would be left pointing at the wrong thing.
  useEffect(() => {
    if (!visible) return;
    const hide = () => setVisible(false);
    window.addEventListener("scroll", hide, { passive: true });
    return () => window.removeEventListener("scroll", hide);
  }, [visible]);

  return (
    <div
      className={className}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setVisible(false)}
    >
      {children}

      {/* Only ever set from a pointer event, so this never renders on the
          server, where there is no document to portal into. */}
      {caption &&
        createPortal(
          <span
            ref={box}
            className="cursor-caption"
            data-visible={visible}
            aria-hidden="true"
          >
            {caption.text}
            {caption.linked && (
              <Icon name="material-symbols:arrow-outward-rounded" className="ml-1.5" />
            )}
          </span>,
          document.body
        )}
    </div>
  );
}
