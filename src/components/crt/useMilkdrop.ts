"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MilkdropVisualizerInstance, MilkdropPreset } from "butterchurn";
import type { Engine } from "@/components/mp3/engine";

/**
 * MilkDrop rendered into an offscreen canvas, for use as a texture.
 *
 * Nothing here touches the DOM layout — the canvas is detached and exists only
 * to be sampled by Three. That removes the trap the on-page version had to work
 * around: butterchurn never sizes the canvas you hand it (its only
 * `canvas.width` assignment is inside `toDataURL`, on a throwaway), so a canvas
 * left at the HTML 300x150 default gets stretched by whatever displays it. Here
 * the size is stated outright and never changes.
 *
 * SIZE is fixed at 4:3 because the CRT's screen mesh is exactly 4:3
 * (2.6927 x 2.0197 in model units), which is also what MilkDrop presets are
 * composed for. Matching all three means no letterboxing anywhere in the chain.
 *
 * butterchurn reads `window` at module scope, so it can only be reached through
 * a dynamic import inside an effect — a static import would crash the server
 * render of any client component that pulled this in.
 */

const SIZE = { w: 1024, h: 768 };

/** Crossfade between presets, in seconds. MilkDrop's own blend. */
const BLEND = 2.7;

/**
 * How often the preset changes on its own, in ms.
 *
 * Without this a preset only ever changed on a track boundary, so a four-minute
 * song was four minutes of one look. Winamp cycles on a timer for the same
 * reason.
 */
const CYCLE_MS = 21_000;

/**
 * Photosensitivity guard.
 *
 * Some stock presets strobe hard enough to be a genuine seizure risk. WCAG
 * 2.3.1 puts the general threshold at more than three flashes in any one
 * second, so that is what this counts: mean luminance is sampled off the
 * rendered frame, and a swing past FLASH_DELTA counts as a flash.
 *
 * The response is graded — `damp` rises first so the scene can pull contrast
 * down, and only sustained strobing forces a preset change. A hard cut on the
 * first bright frame would make ordinary bass-reactive presets unusable.
 *
 * It is a mitigation, not a guarantee: it damps what it detects, and cannot
 * catch a flash that falls between samples.
 */
const FLASH_DELTA = 0.18;
const FLASHES_PER_SEC = 3;
const BAIL_MS = 2200;
const SAMPLE_W = 32;
const SAMPLE_H = 24;

/**
 * MilkDrop's audio inputs. A preset that never mentions one of these cannot be
 * reacting to the music — it is an animation that happens to be playing.
 */
const AUDIO_VARS = /\b(bass|bass_att|mid|mid_att|treb|treb_att|vol|vol_att)\b/;

/**
 * Does this preset actually respond to sound?
 *
 * butterchurn ships each preset's equations as source strings, so this is a
 * direct check rather than a guess: gather every equation the preset carries —
 * per-frame, per-pixel, init, the warp and comp shaders, and the same set again
 * for each of its shapes and waves — and look for an audio variable.
 *
 * Of the 100 stock presets, 8 fail this and are the static ones.
 */
function isReactive(preset: MilkdropPreset): boolean {
  const p = preset as Record<string, unknown>;
  const parts: unknown[] = [
    p.init_eqs_str,
    p.frame_eqs_str,
    p.pixel_eqs_str,
    p.warp,
    p.comp,
  ];
  for (const key of ["shapes", "waves"]) {
    const group = p[key];
    if (!Array.isArray(group)) continue;
    for (const g of group) {
      if (!g) continue;
      const item = g as Record<string, unknown>;
      parts.push(item.init_eqs_str, item.frame_eqs_str, item.point_eqs_str);
    }
  }
  return AUDIO_VARS.test(parts.filter((x) => typeof x === "string").join(" "));
}

export type Milkdrop = {
  /** The offscreen canvas MilkDrop paints into. Stable for the hook's life. */
  canvas: HTMLCanvasElement | null;
  /** True once the visualiser is built and rendering. */
  running: boolean;
  failed: boolean;
  /**
   * 0..1 — how hard the flash guard is currently damping. The scene reads this
   * every frame to fade the screen's contrast down; it is not React state, so
   * it lives on a ref and never triggers a render.
   */
  dampRef: React.RefObject<number>;
  /** Crossfade to a new random preset. */
  nextPreset: () => void;
  /** Fire MilkDrop's smoky song-title overlay. */
  announce: (title: string) => void;
};

export function useMilkdrop(
  engineRef: React.RefObject<Engine | null>,
  /** While true the visualiser stops rendering — something else has the tube. */
  suspendedRef?: React.RefObject<boolean>
): Milkdrop {
  const vizRef = useRef<MilkdropVisualizerInstance | null>(null);
  const presetsRef = useRef<MilkdropPreset[]>([]);
  /** Shuffled indices, drawn from and refilled — random, no repeats. */
  const bagRef = useRef<number[]>([]);
  const nextRef = useRef<((blend: number) => void) | null>(null);
  const dampRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  /**
   * Bumped to tear the visualiser down and build it again. This is how the
   * scene recovers from a lost WebGL context — see the listeners below.
   */
  const [generation, setGeneration] = useState(0);

  // Created once, eagerly, so consumers have a stable canvas to bind a texture
  // to before the AudioContext exists.
  //
  // Two things about this canvas are load-bearing.
  //
  // 1. Nothing may take a 2D context on it — not even to paint an initial
  //    colour. A canvas only ever hands out one context type, so a single
  //    getContext("2d") permanently poisons it and butterchurn's later request
  //    for WebGL returns null, surfacing as the baffling "Cannot read
  //    properties of null (reading 'createFramebuffer')".
  //
  // 2. The WebGL context is claimed HERE, with preserveDrawingBuffer, rather
  //    than being left for butterchurn to create. By default a WebGL drawing
  //    buffer is cleared as soon as the frame is composited, and Three uploads
  //    this canvas from its OWN requestAnimationFrame callback — a different
  //    one from butterchurn's, with no ordering guarantee between them.
  //    Preserving the buffer makes the upload order irrelevant. Later
  //    getContext calls return this same context and ignore their own
  //    attributes, so butterchurn inherits the setting.
  //
  // Held in lazy state rather than a ref, because a ref written during render
  // is exactly the pattern the compiler's rules exist to stop.
  const [canvas] = useState<HTMLCanvasElement | null>(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = SIZE.w;
    c.height = SIZE.h;
    c.getContext("webgl2", { preserveDrawingBuffer: true, alpha: false, antialias: true });
    return c;
  });

  /**
   * Recover from a lost WebGL context.
   *
   * Browsers reclaim GPU resources from backgrounded tabs, and when they take
   * this canvas's context every butterchurn resource goes with it — the render
   * loop keeps running and quietly paints nothing, which is the "leave the tab,
   * come back, screen is black" failure. Two halves are needed: calling
   * preventDefault on the loss event, without which the browser never bothers
   * to restore the context at all, and rebuilding the visualiser once it does,
   * because the old one's buffers and shaders went with the context.
   */
  useEffect(() => {
    if (!canvas) return;
    const onLost = (e: Event) => {
      e.preventDefault();
      setRunning(false);
    };
    const onRestored = () => setGeneration((g) => g + 1);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [canvas]);

  /**
   * Coming back to the tab: resume the AudioContext, which the browser is free
   * to suspend while hidden. A suspended context feeds the analyser silence, so
   * the presets freeze even when the picture itself is fine.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const ctx = engineRef.current?.ctx;
      if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [engineRef]);

  useEffect(() => {
    if (!canvas) return;

    let disposed = false;
    let frame = 0;
    let waiting = 0;
    let cycle = 0;

    const start = async (engine: Engine) => {
      let butterchurn, butterchurnPresets;
      try {
        [butterchurn, butterchurnPresets] = await Promise.all([
          import("butterchurn"),
          import("butterchurn-presets"),
        ]);
      } catch {
        if (!disposed) setFailed(true);
        return;
      }
      if (disposed) return;

      const viz = butterchurn.default.createVisualizer(engine.ctx, canvas, {
        width: SIZE.w,
        height: SIZE.h,
        pixelRatio: 1,
        textureRatio: 1,
      });
      // Belt and braces: state the backing store too, since butterchurn won't.
      canvas.width = SIZE.w;
      canvas.height = SIZE.h;
      viz.setRendererSize(SIZE.w, SIZE.h);

      // Tap the end of the EQ chain. A fan-out, not a re-route: the analyser
      // still feeds the speakers, butterchurn just listens in.
      viz.connectAudio(engine.analyser);

      const stock = Object.values(butterchurnPresets.default.getPresets());
      const reactive = stock.filter(isReactive);
      // Fall back to the full set rather than shipping an empty bag if a future
      // pack stores its equations somewhere this doesn't know to look.
      presetsRef.current = reactive.length ? reactive : stock;
      if (!reactive.length) {
        console.warn("[milkdrop] No preset passed the audio-reactivity check; using all of them.");
      }
      vizRef.current = viz;

      /* ---- flash guard state (declared before the preset helpers, which reset it) ---- */
      const probe = document.createElement("canvas");
      probe.width = SAMPLE_W;
      probe.height = SAMPLE_H;
      const probeCtx = probe.getContext("2d", { willReadFrequently: true });
      let lastLum = -1;
      const flashes: number[] = [];
      let strobingSince = 0;
      let sampleAt = 0;

      const drawPreset = () => {
        const list = presetsRef.current;
        if (!list.length) return null;
        if (!bagRef.current.length) {
          const bag = list.map((_, i) => i);
          for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
          }
          bagRef.current = bag;
        }
        return bagRef.current.pop() ?? null;
      };

      const goToPreset = (blend: number) => {
        const i = drawPreset();
        if (i == null) return;
        viz.loadPreset(presetsRef.current[i], blend);
        flashes.length = 0;
        strobingSince = 0;
      };
      nextRef.current = goToPreset;
      goToPreset(0);

      // Keep the look moving within a track, not only between tracks.
      cycle = window.setInterval(() => goToPreset(BLEND), CYCLE_MS);

      if (!disposed) setRunning(true);

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const guard = (now: number) => {
        if (!probeCtx) return;
        // ~30Hz catches a 3-per-second flash rate for far less than a readback
        // on every frame.
        if (now - sampleAt < 33) return;
        sampleAt = now;

        probeCtx.drawImage(canvas, 0, 0, SAMPLE_W, SAMPLE_H);
        const d = probeCtx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) {
          // Rec. 601 luma — close enough for a flash detector.
          sum += (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
        }
        const lum = sum / (d.length / 4);

        if (lastLum >= 0 && Math.abs(lum - lastLum) > FLASH_DELTA) flashes.push(now);
        lastLum = lum;
        while (flashes.length && now - flashes[0] > 1000) flashes.shift();

        const strobing = flashes.length > FLASHES_PER_SEC;
        if (strobing) {
          if (!strobingSince) strobingSince = now;
        } else if (now - (strobingSince || now) > 600) {
          strobingSince = 0;
        }

        // Ease rather than snap, so one bright hit doesn't visibly grey the tube.
        const target = strobing ? (reduced ? 0.8 : 0.55) : 0;
        dampRef.current += (target - dampRef.current) * (target > dampRef.current ? 0.25 : 0.03);

        // Still strobing after the damping has had time to work — the preset is
        // the problem, so move on rather than damp it forever.
        if (strobingSince && now - strobingSince > BAIL_MS) goToPreset(1.2);
      };

      // Rendering stops entirely while the tab is hidden. Browsers already
      // throttle rAF in background tabs, but not reliably to zero, and MilkDrop
      // is a heavy fragment shader plus a per-frame readback for the flash
      // guard — worth not paying for a tab nobody is looking at.
      const render = () => {
        frame = requestAnimationFrame(render);
        if (document.hidden || suspendedRef?.current) return;
        viz.render();
        guard(performance.now());
      };
      frame = requestAnimationFrame(render);
    };

    // Poll for the engine rather than keying the effect on it: engineRef is a
    // ref, so its assignment doesn't re-run anything on its own. The graph only
    // exists after the visitor's first play — built outside a user gesture, an
    // AudioContext starts suspended and no browser resumes it unprompted.
    const look = () => {
      if (disposed) return;
      const engine = engineRef.current;
      if (engine) void start(engine);
      else waiting = window.setTimeout(look, 250);
    };
    look();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(waiting);
      clearInterval(cycle);
      nextRef.current = null;
      vizRef.current = null;
    };
  }, [engineRef, canvas, generation, suspendedRef]);

  const nextPreset = useCallback(() => nextRef.current?.(BLEND), []);
  const announce = useCallback((title: string) => {
    if (title) vizRef.current?.launchSongTitleAnim(title);
  }, []);

  // Memoised so consumers can put this in a dependency array.
  return useMemo(
    () => ({ canvas, running, failed, dampRef, nextPreset, announce }),
    [canvas, running, failed, nextPreset, announce]
  );
}
