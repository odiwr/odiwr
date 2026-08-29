"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ScreenFrame } from "./screen";

/**
 * The camera.
 *
 * Purpose-built rather than OrbitControls. Two of the behaviours here can't be
 * had from it: easing the azimuth back to a home angle, and driving a scripted
 * move. OrbitControls owns its spherical state internally and this version
 * exposes no setter for the azimuth (only `getAzimuthalAngle`), so anything
 * that writes `camera.position` from outside is immediately overwritten on the
 * controls' next update. Owning the spherical outright is far less code than
 * fighting that.
 *
 * The rig is a single spherical coordinate around a target:
 *
 *   - AZIMUTH is the only axis the visitor controls. Drag left/right, 360
 *     degrees, and after IDLE_MS of no input it eases back to the angle where
 *     the tube faces the camera.
 *   - POLAR and DISTANCE are fixed in orbit mode, so height and pitch never
 *     drift no matter how the pointer moves.
 *
 * FOCUS is one scalar, `focus`, running 0..1, that the whole cinematic move
 * hangs off: polar, distance and target all interpolate between their orbit and
 * their close-up values. Reversing the move is just animating that scalar back
 * to zero, which is why "H undoes F" needs no separate path.
 *
 * The move is staged, though. Focus does not start ramping until the azimuth
 * has actually arrived home, so the set squares up to the camera first and only
 * then dips and closes in.
 */

/** Camera pitch in orbit, radians from +Y. Just under a right angle. */
export const ORBIT_POLAR = THREE.MathUtils.degToRad(80);
/** Orbit distance, as a multiple of the model's largest dimension. */
const ORBIT_DISTANCE = 3.4;
/** Pitch at full focus — below the tube's centre line, looking slightly up. */
const FOCUS_POLAR = THREE.MathUtils.degToRad(94);
/**
 * Focus distance, same units.
 *
 * Sized so the tube roughly fills the frame with a margin, not so the camera
 * ends up inside it. The screen is 0.67 x 0.50 in world units and the lens is
 * 32 degrees vertical, which wants about 0.87 to exactly fill the height; the
 * rest is headroom. At 1.15 the camera went through the glass.
 */
const FOCUS_DISTANCE = 1.42;

/** Idle time before the view eases back home, in ms. */
const IDLE_MS = 3000;
/** Duration of that return, in ms. */
const RETURN_MS = 1400;
/** Duration of the focus push, in seconds. Deliberately unhurried. */
const FOCUS_SECONDS = 2.6;

/**
 * Opening move: the rig starts high above its resting place and descends
 * straight down into it. Height as a multiple of the model's size.
 *
 * A pedestal move, not a crane — the camera's ORIENTATION never changes. The
 * look-at point is lifted by exactly the same amount as the camera, so the view
 * direction is identical at every moment of the descent and the set is seen at
 * its final angle the whole way. Lifting only the camera would tilt it steeply
 * down at the start and rotate to level as it fell, which is a different shot.
 *
 * The set therefore begins below the frame and rises into the middle of it as
 * the rig comes down.
 *
 * Only the camera moves — the model is never transformed, so there is nothing
 * to unwind and no way for an interrupted move to strand it.
 */
// 1.9 puts the set just below the frame at the start, so it begins rising
// almost immediately rather than leaving the shot empty for the first second.
const INTRO_LIFT = 1.9;
const INTRO_MS = 2400;

const TWO_PI = Math.PI * 2;

/** Ken Perlin's smootherstep: eased at both ends, so the move has no corners. */
function smootherstep(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Shortest signed way round from a to b, so the return never takes the long way. */
function shortestDelta(from: number, to: number) {
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

/** Model centre and size, measured once the glTF has loaded. */
export type Bounds = { centre: THREE.Vector3; radius: number };

type Props = {
  /** Screen placement, which supplies the home azimuth and the focus target. */
  screenRef: React.RefObject<ScreenFrame | null>;
  boundsRef: React.RefObject<Bounds | null>;
  /** True while the cinematic close-up should be engaged. */
  focused: boolean;
  /**
   * Fired on the first frame the camera is actually placed.
   *
   * The scene stays hidden until this, which is what removes the flash of the
   * set sitting at its origin: until the rig has bounds and a screen normal the
   * camera is still at the canvas default, pointed at nothing in particular,
   * and anything drawn in that window is drawn from the wrong place.
   */
  onReady: () => void;
};

export default function CameraRig({ screenRef, boundsRef, focused, onReady }: Props) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const azimuth = useRef(0);
  const homed = useRef(false);
  const focus = useRef(0);
  /** Timestamp of the first placed frame, which starts the crane down. */
  const introStart = useRef(0);

  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastInput = useRef(0);
  /** Non-null while an eased return is in flight. */
  const ret = useRef<{ from: number; delta: number; start: number } | null>(null);

  /* ---- pointer: azimuth only ---- */
  useEffect(() => {
    const el = gl.domElement;

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging.current = true;
      lastX.current = e.clientX;
      lastInput.current = performance.now();
      ret.current = null;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      // Scaled by width so the same drag turns the same amount on any display.
      azimuth.current -= (dx / el.clientWidth) * Math.PI * 2.2;
      lastInput.current = performance.now();
    };
    const up = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      lastInput.current = performance.now();
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl]);

  /* eslint-disable react-hooks/immutability -- the frame loop mutates the
     camera by design; see CrtModel for the full reasoning. */
  useFrame((_, delta) => {
    const bounds = boundsRef.current;
    const screen = screenRef.current;
    if (!bounds || !screen) return;

    const home = Math.atan2(screen.normal.x, screen.normal.z);

    // First frame with a known screen: start square-on rather than sweeping in.
    if (!homed.current) {
      azimuth.current = home;
      homed.current = true;
      introStart.current = performance.now();
      onReady();
    }

    const now = performance.now();
    const wantHome =
      focused || (!dragging.current && now - lastInput.current > IDLE_MS);

    if (wantHome) {
      const off = shortestDelta(azimuth.current, home);
      if (Math.abs(off) > 1e-4) {
        // Timed and eased at both ends, so it reads as a considered move rather
        // than an exponential glide that never quite lands.
        if (!ret.current) ret.current = { from: azimuth.current, delta: off, start: now };
        const r = ret.current;
        const e = smootherstep((now - r.start) / RETURN_MS);
        azimuth.current = r.from + r.delta * e;
        if (e >= 1) ret.current = null;
      } else {
        ret.current = null;
      }
    } else {
      ret.current = null;
    }

    // Focus only begins once the set is square to the camera.
    const squared = Math.abs(shortestDelta(azimuth.current, home)) < 0.02;
    const focusTarget = focused && squared ? 1 : 0;
    const step = delta / FOCUS_SECONDS;
    focus.current = THREE.MathUtils.clamp(
      focus.current + (focusTarget > focus.current ? step : -step),
      0,
      1
    );

    const f = smootherstep(focus.current);
    const polar = THREE.MathUtils.lerp(ORBIT_POLAR, FOCUS_POLAR, f);
    const dist = bounds.radius * THREE.MathUtils.lerp(ORBIT_DISTANCE, FOCUS_DISTANCE, f);
    const az = azimuth.current;
    // Drift the look-at from the whole set toward the tube itself, so closing in
    // also recomposes onto the picture.
    const target = bounds.centre.clone().lerp(screen.centre, f * 0.85);

    const sinP = Math.sin(polar);
    camera.position.set(
      target.x + dist * sinP * Math.sin(az),
      target.y + dist * Math.cos(polar),
      target.z + dist * sinP * Math.cos(az)
    );

    // The descent. Camera and look-at point are raised by the same amount, so
    // the direction between them — and therefore the angle the set is seen at —
    // is unchanged throughout. Eased at both ends so it neither starts nor
    // lands with a jerk.
    const lift =
      (1 - smootherstep((now - introStart.current) / INTRO_MS)) *
      bounds.radius *
      INTRO_LIFT;
    if (lift > 0) {
      camera.position.y += lift;
      target.y += lift;
    }

    camera.lookAt(target);
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}
