"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyEq, getEngine, PRESETS, type Engine } from "@/components/mp3/engine";
import type { AmpTrack } from "@/components/mp3/types";

/**
 * Transport + playlist for the CRT scene.
 *
 * Deliberately knows nothing about the scene or the overlay — it owns the
 * <audio> element, the R2 playlist and the Web Audio graph, and hands the live
 * Engine back by ref.
 *
 * That ref matters: OdiAMP polls its spectrum into React state and re-renders
 * every frame, which is fine for sixteen ASCII bars and ruinous here. MilkDrop
 * reads the analyser inside its own rAF loop and never touches React at all.
 */

/** Filenames in R2 are "Title - Artist.mp3", the same convention the shelf uses. */
function parseTrack(key: string, filename: string): AmpTrack {
  const name = filename.replace(/\.[^.]+$/, "");
  const i = name.indexOf(" - ");
  return {
    title: i >= 0 ? name.slice(0, i) : name,
    artist: i >= 0 ? name.slice(i + 3) : "",
    // Routed through the same-origin proxy — R2 sends no CORS headers, and a
    // tainted cross-origin element analyses as silence rather than erroring.
    src: `/media?key=${encodeURIComponent(key)}`,
  };
}

export type AmpPlayer = ReturnType<typeof useAmpPlayer>;

export function useAmpPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const engineRef = useRef<Engine | null>(null);

  const [tracks, setTracks] = useState<AmpTrack[]>([]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  // User intent, distinct from `playing` (which mirrors the element). Swapping
  // `src` halts playback, so this is what tells onCanPlay to pick it up again.
  const [wantPlay, setWantPlay] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  const track = tracks[current];

  useEffect(() => {
    let cancelled = false;
    fetch("/r2-list?prefix=legacy/music/")
      .then((r) => r.json())
      .then((data: { files?: { key: string; filename: string }[] }) => {
        if (cancelled) return;
        setTracks(
          (data.files ?? [])
            .filter((f) => /\.(mp3|wav|ogg|m4a|flac)$/i.test(f.filename))
            .map((f) => parseTrack(f.key, f.filename))
        );
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const play = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    // The graph has to be built inside a user gesture, or the AudioContext
    // starts suspended and no browser will resume it unprompted.
    if (!engineRef.current) {
      engineRef.current = getEngine(el);
      applyEq(engineRef.current, PRESETS[0].preamp, PRESETS[0].gains, true);
    }
    engineRef.current?.ctx.resume().catch(() => {});
    setWantPlay(true);
    el.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, []);

  const pause = useCallback(() => {
    setWantPlay(false);
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, pause, play]);

  const step = useCallback(
    (delta: number) => {
      if (!tracks.length) return;
      setCurrent((c) => (c + delta + tracks.length) % tracks.length);
    },
    [tracks.length]
  );

  const select = useCallback((i: number) => setCurrent(i), []);

  /** Seek to a fraction of the current track, 0–1. */
  const seek = useCallback((fraction: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const t = Math.max(0, Math.min(1, fraction)) * el.duration;
    el.currentTime = t;
    setCurrentTime(t);
  }, []);

  /** Props for the single <audio> element the view has to render. */
  const audioProps = {
    ref: audioRef,
    src: track?.src,
    preload: "metadata" as const,
    onCanPlay: (e: React.SyntheticEvent<HTMLAudioElement>) => {
      if (wantPlay && e.currentTarget.paused) e.currentTarget.play().catch(() => {});
    },
    onTimeUpdate: (e: React.SyntheticEvent<HTMLAudioElement>) =>
      setCurrentTime(e.currentTarget.currentTime),
    onDurationChange: (e: React.SyntheticEvent<HTMLAudioElement>) =>
      setDuration(e.currentTarget.duration || 0),
    onEnded: () => step(1),
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
  };

  return {
    tracks,
    track,
    current,
    playing,
    currentTime,
    duration,
    ready,
    engineRef,
    audioProps,
    play,
    pause,
    toggle,
    next: () => step(1),
    prev: () => step(-1),
    select,
    seek,
  };
}
