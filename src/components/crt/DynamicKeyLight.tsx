"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { readSpectrum, type Engine } from "@/components/mp3/engine";
import type { Bounds } from "./CameraRig";

/**
 * A moving key light on the upper-left front quarter of the set.
 *
 * The studio IBL lights everything evenly, which is correct for reading the
 * textures but leaves the housing flat. This adds one soft source, high and to
 * the camera's left, to put a moving highlight along the top bezel and the
 * near top corner.
 *
 * "Camera left" is +Z here, not -X: the tube faces +X, so with the default view
 * looking back along -X the frame's left-hand side runs toward +Z. Getting that
 * backwards is what put the previous lamp on the side panel.
 *
 * It drifts on a slow Lissajous path so the highlight never sits still, and
 * leans on the low end of the spectrum so it breathes with the music. Both are
 * deliberately small: this is a moving glint, not a disco light.
 */

/** Where the light sits relative to the model centre, before drift. */
const OFFSET = new THREE.Vector3(1.05, 0.95, 0.85);
const BASE_INTENSITY = 5.5;

export default function DynamicKeyLight({
  engineRef,
  boundsRef,
}: {
  engineRef: React.RefObject<Engine | null>;
  /** Model bounds, so the light can be placed relative to the set. */
  boundsRef: React.RefObject<Bounds | null>;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  const spectrum = useRef(new Uint8Array(128));
  const level = useRef(0);
  const t = useRef(0);

  useFrame((_, delta) => {
    const light = lightRef.current;
    const origin = boundsRef.current?.centre;
    if (!light || !origin) return;

    t.current += delta;

    // Bass only. Using the full spectrum makes the light track overall loudness
    // and pump on every hi-hat, which reads as flicker rather than weight.
    let bass = 0;
    if (readSpectrum(engineRef.current, spectrum.current)) {
      let peak = 0;
      for (let i = 1; i < 6; i++) peak = Math.max(peak, spectrum.current[i]);
      bass = peak / 255;
    }
    // Attack fast, release slow, so hits land and then ease off.
    level.current += (bass - level.current) * (bass > level.current ? 0.35 : 0.05);

    const drift = t.current * 0.22;
    light.position.set(
      origin.x + OFFSET.x + Math.sin(drift) * 0.18,
      origin.y + OFFSET.y + Math.sin(drift * 0.7) * 0.12,
      origin.z + OFFSET.z + Math.cos(drift * 0.85) * 0.22
    );
    light.intensity = BASE_INTENSITY * (0.72 + level.current * 0.5);
  });

  return (
    <pointLight
      ref={lightRef}
      color="#cfe2ff"
      distance={6}
      decay={2}
      intensity={BASE_INTENSITY}
    />
  );
}
