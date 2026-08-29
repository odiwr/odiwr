"use client";

import { useEffect, useRef, useState } from "react";
import { SITE } from "@/lib/site";

/**
 * The handle, with the accounts behind it.
 *
 * Opening runs in two movements: the line grows rightwards until it is as wide
 * as the longest social name, pushing the rest of the sentence along, and then
 * travels straight down, uncovering the names as it goes. Closing waits half a
 * second and plays the same two movements in reverse.
 *
 * Once a hover starts, the opening sequence ALWAYS finishes. Leaving early does
 * not interrupt it — the close simply queues behind however much of the opening
 * is left to play, so a pointer passing over the handle never leaves it caught
 * halfway.
 *
 * The stage lives in a ref as well as in state because open() and close() both
 * have to read the current stage to decide what to do, and doing that inside a
 * state updater would mean running side effects in a function React expects to
 * be pure and calls twice in development.
 */

/** Line growth. Must match the transition in globals.css. */
const GROW_MS = 260;
/** The travel down. Must match the transition in globals.css. */
const DROP_MS = 340;
/** How long the pointer can be away before it closes. */
const HOLD_MS = 500;
/** Gap above the first name. Must match padding-top on .handle-links. */
const PANEL_PAD = 8;

type Stage = 0 | 1 | 2;

export default function HandleMenu() {
  const [stage, setStage] = useState<Stage>(0);
  /** What the pointer wants. The sequence below is derived from it. */
  const [wantOpen, setWantOpen] = useState(false);
  const [metrics, setMetrics] = useState<{ label: number; line: number; drop: number } | null>(null);

  /** When the current opening began, so a close can wait for it to finish. */
  const openedAt = useRef(0);

  const labelRef = useRef<HTMLSpanElement>(null);
  const linksRef = useRef<HTMLSpanElement>(null);

  /**
   * Measure the handle and the names.
   *
   * The line stops at the width of the widest name rather than a round number,
   * so it lines up with the column it is about to uncover. Both depend on the
   * loaded face, hence measuring after the fonts settle and again on resize.
   */
  useEffect(() => {
    let alive = true;

    const measure = () => {
      const label = labelRef.current;
      const links = linksRef.current;
      if (!alive || !label || !links) return;

      const labelW = label.getBoundingClientRect().width;
      const names = Array.from(links.children) as HTMLElement[];
      const widest = names.reduce((w, el) => Math.max(w, el.getBoundingClientRect().width), 0);
      const lineHeight = parseFloat(getComputedStyle(links).lineHeight) || 28;

      setMetrics({
        label: labelW,
        line: Math.max(labelW, widest),
        drop: names.length * lineHeight + PANEL_PAD,
      });
    };

    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => {
      alive = false;
      window.removeEventListener("resize", measure);
    };
  }, []);

  /** Opens without waiting a frame; the effect below carries it on from there. */
  const begin = () => {
    openedAt.current = Date.now();
    // Never drags an already-open menu back a stage.
    setStage((current) => (current === 0 ? 1 : current));
    setWantOpen(true);
  };

  /**
   * The rest of the sequence, derived from one boolean.
   *
   * Every timer belongs to this effect and dies with it, so there is no state to
   * get out of step and nothing to cancel by hand. The previous version kept two
   * timer buckets and skipped scheduling when a step was already pending — which
   * meant that if that step was ever dropped, by a background tab or a
   * back-forward restore, nothing rescheduled it and the handle stayed expanded
   * for good. Re-deriving cannot strand itself that way.
   *
   * Opening always plays out in full: a close waits for whatever is left of it
   * before starting its own delay.
   */
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, Math.max(0, ms)));

    if (wantOpen) {
      at(openedAt.current + GROW_MS - Date.now(), () => setStage(2));
    } else {
      const finishesAt = openedAt.current + GROW_MS + DROP_MS;
      // Still opening: let it land before anything else happens.
      at(openedAt.current + GROW_MS - Date.now(), () => setStage(2));
      at(finishesAt - Date.now() + HOLD_MS, () => {
        setStage(1);
        at(DROP_MS, () => setStage(0));
      });
    }

    return () => timers.forEach(clearTimeout);
  }, [wantOpen]);

  return (
    <span
      className="handle"
      data-stage={stage}
      style={
        metrics
          ? ({
              "--label-w": `${metrics.label}px`,
              "--line-w": `${metrics.line}px`,
              "--drop": `${metrics.drop}px`,
            } as React.CSSProperties)
          : undefined
      }
      onPointerEnter={() => {
        // No hover, no sequence. On a touch screen the socials are listed in
        // the open instead, so this stays plain text.
        if (window.matchMedia("(hover: hover) and (min-width: 640px)").matches) begin();
      }}
      onPointerLeave={() => setWantOpen(false)}
      onFocus={begin}
      onBlur={() => setWantOpen(false)}
    >
      <button type="button" className="handle-trigger" aria-expanded={stage === 2}>
        <span className="handle-label" ref={labelRef}>
          {SITE.handle}
        </span>
      </button>
      <span className="handle-rail" aria-hidden="true" />
      <span className="handle-bridge" aria-hidden="true" />

      <span className="handle-panel">
        <span className="handle-clip">
          <span className="handle-links" ref={linksRef}>
            {SITE.profiles.map((p) => (
              <a
                key={p.label}
                href={p.href}
                tabIndex={stage === 2 ? undefined : -1}
                {...(p.href.startsWith("http")
                  ? { target: "_blank", rel: "noreferrer noopener" }
                  : {})}
              >
                {p.label}
              </a>
            ))}
          </span>
        </span>
      </span>
    </span>
  );
}
