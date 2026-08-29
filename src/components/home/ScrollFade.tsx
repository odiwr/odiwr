"use client";

import { useEffect, useRef } from "react";

/**
 * Fades the column out along a gradient as it reaches the top of the viewport,
 * with the text lighting up on its way through.
 *
 * The fade is a fixed strip of the page's own background colour, sitting over
 * the top of the viewport and dissolving into nothing. Because the background is
 * flat, covering the text with it is indistinguishable from fading the text out
 * — and it is continuous, so it ignores where blocks happen to start and end.
 *
 * It was a mask on the column before that, which produced this bug: a mask never
 * paints outside its own element, so the handle's dropdown — absolutely
 * positioned and hanging below the column — had its lower half and its line cut
 * away entirely. No mask-size or repeat setting fixes that; the paint area is
 * the box. An overlay has no such limit.
 *
 * The glow is per block, and rises and falls: a half sine over the block's trip
 * through the band, so it comes up, peaks, and is gone again rather than
 * arriving at full strength and staying there.
 */

/** Peak glow radius, in px. */
const GLOW_RADIUS = 26;
/**
 * Ceiling on the band, as a fraction of the viewport height.
 *
 * --page-top alone is 128px, which on a short window is a sizeable slice of the
 * screen fading at once. This keeps the effect to a strip along the top however
 * tall the padding is.
 */
const MAX_BAND = 0.075;

export default function ScrollFade({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const column = ref.current;
    if (!column) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const blocks = Array.from(column.children) as HTMLElement[];
    let frame = 0;

    const clear = () => {
      for (const block of blocks) block.style.textShadow = "";
    };

    const update = () => {
      frame = 0;

      // The band: transparent at the top of the viewport, opaque by the time it
      // reaches where the first block sits. Taken from --page-top so it tracks
      // the padding at every breakpoint instead of guessing, then capped so it
      // never covers more than a strip of the screen.
      const pageTop =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--page-top")) || 128;
      const band = Math.min(pageTop, window.innerHeight * MAX_BAND);
      const columnTop = column.getBoundingClientRect().top;

      // Nothing has reached the band yet.
      if (columnTop >= band) {
        clear();
        return;
      }

      for (const block of blocks) {
        const { top } = block.getBoundingClientRect();
        // 0 where the block rests, 1 as it reaches the top of the viewport.
        const u = (band - top) / band;

        if (u <= 0 || u >= 1) {
          block.style.textShadow = "";
          continue;
        }

        // Half sine: in and back out.
        const glow = Math.sin(Math.PI * u);
        const wide = (glow * GLOW_RADIUS).toFixed(2);
        const tight = (glow * GLOW_RADIUS * 0.35).toFixed(2);
        const alpha = (glow * 0.7).toFixed(3);
        block.style.textShadow = `0 0 ${wide}px rgba(242, 242, 242, ${alpha}), 0 0 ${tight}px rgba(242, 242, 242, ${alpha})`;
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clear();
    };
  }, []);

  return (
    <>
      {/* Fixed, so it never clips the page's own content. */}
      <div className="top-fade" aria-hidden="true" />
      <article className="prose enter" ref={ref}>
        {children}
      </article>
    </>
  );
}
