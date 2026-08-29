"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AmpTrack } from "@/components/mp3/types";

/**
 * The screen takeover: certain tracks briefly hand the tube over to a video.
 *
 * The video element runs on its OWN continuous timeline once it starts, and is
 * kept in sync with the song rather than being started and stopped as the
 * screen cuts back and forth. That is the whole point of the design: the
 * takeover can drop in and out repeatedly and the clip is always at the frame
 * it would have been at, because it never actually stopped. Pausing it on every
 * cut and resuming later would drift out of sync immediately.
 *
 * Sync is corrected, not merely set. Media elements do not seek exactly, and a
 * long track will drift; anything past DRIFT_TOLERANCE gets a hard re-seek,
 * anything under it is left alone because seeking is visible and drift this
 * small is not.
 */

/**
 * How far the video may drift from the song before it is re-seeked, seconds.
 *
 * Generous, because a seek is visible and drift this small is not. Ordinary
 * drift is corrected by nudging playbackRate instead, which converges without
 * a jump; the seek is only for a real break, like a scrub.
 */
const DRIFT_TOLERANCE = 0.9;
/** Hardest the clip will run to claw back drift. 6% is inaudible and unseen. */
const MAX_RATE_TRIM = 0.06;
/** Length of the static burst on each cut, in seconds. */
export const STATIC_SECONDS = 0.42;

type Takeover = {
  /** File under /public/video. */
  file: string;
  /**
   * Song time at which the clip's first frame lands. The video's own timeline
   * is offset by this, so video time = song time - startAt.
   */
  startAt: number;
  /** Leave this many seconds of the clip unplayed at the end. */
  stopBeforeEnd: number;
  /**
   * Hard stop, in the CLIP's own timeline. Past this the screen cuts back to
   * the visualiser and never returns to the clip for this track, whatever the
   * windows say.
   */
  hardStopAt?: number;
  /** Windows of song time, in seconds, where the screen shows the video. */
  windows: Array<[number, number]>;
};

/**
 * Per-track configuration, keyed by the track's title.
 *
 * Matched on title rather than filename so the R2 folder can be renamed without
 * breaking this, and kept as data so adding a track is a one-line change.
 */
export const TAKEOVERS: Record<string, Takeover> = {
  // Clip is 120.5s. Starting at 9.5s it covers song time 9.5 -> 130.0, and it
  // may run to the very end, so the last window stops just inside that.
  AIZO: {
    file: "Aizo.mp4",
    // Video time is songTime - startAt, so a LOWER number runs the clip
    // further in. Landed here by measurement, not by the nominal 9.5.
    startAt: 9.15,
    stopBeforeEnd: 0,
    // Never past 1:28 of the clip, even mid-window.
    hardStopAt: 88,
    windows: [
      [14, 30],
      [46, 68],
      [84, 106],
      [112, 129],
    ],
  },
  // Clip is 90.1s, less the 5s tail that must never play, so 85.1s of usable
  // footage covering song time 8.0 -> 93.1. Windows stay well inside that.
  //
  // 8.0 rather than the nominal 7.5: video time is songTime - startAt, so a
  // clip running half a second AHEAD is corrected by pushing its start later,
  // not earlier. This is the knob to turn if either clip drifts against its
  // song again — larger to hold the video back, smaller to bring it forward.
  "LOST IN PARADISE": {
    file: "LostInParadise.mp4",
    startAt: 8.0,
    stopBeforeEnd: 5,
    windows: [
      [12, 26],
      [38, 56],
      [66, 84],
    ],
  },
};

export type TakeoverState = {
  /** The element to sample as a texture, or null when no clip applies. */
  video: HTMLVideoElement | null;
  /**
   * True while the screen should be showing the video rather than MilkDrop.
   *
   * A ref, not state, for the same reason the flash damping is: the screen
   * material reads it once per frame, and routing a cut through React would
   * re-render the tree for something no React-rendered element depends on.
   */
  activeRef: React.RefObject<boolean>;
  /** 0..1, rises for a moment on every cut so the shader can burst to static. */
  staticRef: React.RefObject<number>;
};

export function useTakeover(
  track: AmpTrack | undefined,
  audioRef: React.RefObject<HTMLAudioElement | null>,
  playing: boolean
): TakeoverState {
  const activeRef = useRef(false);
  const staticRef = useRef(0);
  const cutAt = useRef(0);

  const config = useMemo(() => (track ? TAKEOVERS[track.title] : undefined), [track]);

  /* ---- one element per clip, created off-DOM ---- */
  const video = useMemo(() => {
    if (!config || typeof document === "undefined") return null;
    const el = document.createElement("video");
    el.src = `/media?key=mp3/${encodeURIComponent(config.file)}`;
    // Same-origin, so the texture is never tainted. Muted and inline are what
    // let it play without its own gesture — the audio is the song, not this.
    el.crossOrigin = "anonymous";
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    el.loop = false;
    return el;
  }, [config]);

  // Releasing the element is the effect's whole job; creating it above keeps
  // any setState out of an effect body, which the compiler rules forbid.
  useEffect(() => {
    if (!video) return;
    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      activeRef.current = false;
    };
  }, [video]);

  /* ---- drive it off the song's clock ---- */
  useEffect(() => {
    if (!config || !video) return;
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const audio = audioRef.current;
      if (!audio) return;

      const songTime = audio.currentTime;
      const wantVideoTime = songTime - config.startAt;
      const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
      const usable = Math.min(duration - config.stopBeforeEnd, config.hardStopAt ?? Infinity);

      const withinClip = wantVideoTime >= 0 && wantVideoTime < usable;
      const inWindow = config.windows.some(([a, b]) => songTime >= a && songTime < b);
      const shouldShow = withinClip && inWindow && playing;

      if (withinClip) {
        // Keep the clip running underneath, whether or not it is on screen, so
        // cutting back lands on the right frame.
        const drift = video.currentTime - wantVideoTime;
        if (Math.abs(drift) > DRIFT_TOLERANCE) {
          video.currentTime = wantVideoTime;
          video.playbackRate = 1;
        } else {
          // Behind the song reads as negative drift, so speed up slightly; the
          // clamp keeps the correction below the point where it is noticeable.
          video.playbackRate = 1 - Math.max(-MAX_RATE_TRIM, Math.min(MAX_RATE_TRIM, drift * 0.5));
        }
        if (playing && video.paused) void video.play().catch(() => {});
        if (!playing && !video.paused) video.pause();
      } else if (!video.paused) {
        video.pause();
      }

      if (shouldShow !== activeRef.current) {
        activeRef.current = shouldShow;
        cutAt.current = performance.now();
      }

      // Static burst on each cut, decaying over STATIC_SECONDS.
      const since = (performance.now() - cutAt.current) / 1000;
      staticRef.current = Math.max(0, 1 - since / STATIC_SECONDS);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [config, video, audioRef, playing]);

  return { video, activeRef, staticRef };
}
