"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import CrtModel from "./CrtModel";
import CrtOverlay from "./CrtOverlay";
import StudioLighting from "./StudioLighting";
import DynamicKeyLight from "./DynamicKeyLight";
import SceneGrain from "./SceneGrain";
import CameraRig, { type Bounds } from "./CameraRig";
import { useAmpPlayer } from "./useAmpPlayer";
import { useMilkdrop } from "./useMilkdrop";
import { useTakeover } from "./useTakeover";
import type { ScreenFrame } from "./screen";

/**
 * The CRT scene.
 *
 * Camera behaviour lives in CameraRig; this owns the model, the lighting, the
 * overlay and the keyboard.
 *
 * KEYS. Space plays/pauses and retires the intro hint. H toggles the control
 * window — and, while focused, backs out of the close-up. F pushes in: the UI
 * clears, the set squares up to the camera, then the camera dips and closes on
 * the tube.
 */

/**
 * Whether the intro hint has already been retired this page load.
 *
 * Module scope rather than component state on purpose. The hint must appear on
 * every load but must NOT come back mid-session, and component state is reset
 * by anything that remounts the tree — Fast Refresh, a StrictMode double mount,
 * a parent re-key. A module variable is re-initialised only when the module
 * itself is re-evaluated, which is exactly a fresh page load.
 */
let hintRetired = false;

/**
 * Measures the model once it has loaded and hands the numbers to the rig.
 *
 * Runs off useFrame rather than useEffect because the screen placement arrives
 * by ref from a sibling, and a ref assignment doesn't schedule a render — an
 * effect would look once, find nothing, and never be woken again.
 */
function Measure({
  screenRef,
  boundsRef,
  groupRef,
}: {
  screenRef: React.RefObject<ScreenFrame | null>;
  boundsRef: React.RefObject<Bounds | null>;
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  const done = useRef(false);

  useFrame(() => {
    if (done.current || !screenRef.current) return;
    const group = groupRef.current;
    if (!group) return;

    group.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(group);

    if (box.isEmpty()) return;
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(radius) || radius <= 0) return;
    boundsRef.current = { centre, radius };
    done.current = true;
  });

  return null;
}

export default function CrtScene() {
  const player = useAmpPlayer();
  const takeover = useTakeover(player.track, player.audioProps.ref, player.playing);
  // Only one of the two ever renders. While the clip is on the tube MilkDrop
  // stops drawing entirely — it is a heavy fragment shader plus a per-frame
  // readback, and nothing is sampling it. The clip itself keeps PLAYING either
  // way, because that is what lets the screen cut back and forth and always
  // land on the frame the song is at.
  const milkdrop = useMilkdrop(player.engineRef, takeover.activeRef);

  const screenRef = useRef<ScreenFrame | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  // Nothing is drawn until the camera has been placed. Until the rig has the
  // model's bounds and the screen's normal it is still at the canvas default,
  // so anything rendered in that window is rendered from the wrong place —
  // which is the flash of the set at its origin before it snapped.
  const [placed, setPlaced] = useState(false);
  const onPlaced = useCallback(() => setPlaced(true), []);

  // Starts closed: the point of the bare "H" is that the scene is
  // unobstructed until the visitor asks otherwise.
  const [uiHidden, setUiHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  // Mirrors `focused` for the key handler. Reading state inside a setState
  // updater and firing another setState from there is not allowed — updaters
  // must be pure, and React invokes them twice under StrictMode, which made the
  // panel toggle fire twice and cancel itself out.
  const focusedRef = useRef(false);
  const [hintShown, setHintShown] = useState(!hintRetired);

  const retireHint = useCallback(() => {
    hintRetired = true;
    setHintShown(false);
  }, []);

  // The on-screen "H" has to do exactly what the H key does, including backing
  // out of the close-up — otherwise clicking it while focused looked broken.
  const toggleUi = useCallback(() => {
    if (focusedRef.current) {
      focusedRef.current = false;
      setFocused(false);
      return;
    }
    setUiHidden((v) => !v);
  }, []);

  const onScreenFrame = useCallback((f: ScreenFrame) => {
    screenRef.current = f;
  }, []);

  // New track: MilkDrop's own smoky title overlay, plus a fresh preset.
  //
  // On the FIRST track the preset is deliberately left alone. The visualiser
  // already picked one when it was built, and starting a 2.7s crossfade at the
  // same moment as the title animation washes the title out — which matters
  // because the title is the only thing on screen while the audio is still
  // loading, and that load can take a while off R2.
  const trackIndex = player.current;
  const track = player.track;
  const lastTrack = useRef<number>(-1);
  useEffect(() => {
    if (!milkdrop.running) return;
    if (lastTrack.current === trackIndex) return;
    const first = lastTrack.current === -1;
    lastTrack.current = trackIndex;
    if (!first) milkdrop.nextPreset();
    if (track) milkdrop.announce(track.artist ? `${track.title} - ${track.artist}` : track.title);
  }, [trackIndex, track, milkdrop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "BUTTON" || el.isContentEditable)) return;

      if (e.code === "Space") {
        e.preventDefault();
        retireHint();
        player.toggle();
      } else if (e.key === "f" || e.key === "F") {
        // F both enters and leaves, so the key that got you in gets you out.
        const next = !focusedRef.current;
        focusedRef.current = next;
        setFocused(next);
        // Only clear the window on the way in; on the way out leave it closed
        // and let H bring it back, so exiting doesn't fill the screen with UI.
        if (next) setUiHidden(true);
      } else if (e.key === "Escape") {
        if (focusedRef.current) {
          focusedRef.current = false;
          setFocused(false);
        }
      } else if (e.key === "h" || e.key === "H") {
        // While focused, H is the way back out rather than a panel toggle —
        // otherwise the window would open over a close-up the visitor is still
        // pulling out of.
        if (focusedRef.current) {
          focusedRef.current = false;
          setFocused(false);
        } else {
          setUiHidden((v) => !v);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, retireHint]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        // Dark at the edges, lifting toward the middle where the set sits, so
        // the room reads as a space with the television in a pool of light
        // rather than as a flat black field. Painted in CSS behind a
        // transparent canvas: a scene.background colour is flat by definition,
        // and a gradient backdrop mesh would have to be lit and would drift as
        // the camera orbits. This stays put, which is what a backdrop does.
        background: "#0b0b0c",
      }}
    >
      {/* The lit pool arrives from the edges inward on load. Animating the
          gradient's own stops would need @property, which is not universal, so
          this scales an oversized copy down into place instead — the bright
          centre sweeps in from outside rather than fading up in situ. */}
      <div
        aria-hidden
        className="crt-backdrop"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 60% at 50% 52%, #26262b 0%, #171719 45%, #0b0b0c 100%)",
          pointerEvents: "none",
        }}
      />
      <style>{`
        @keyframes crt-backdrop-in {
          from { transform: scale(2.2); opacity: 0; }
          60%  { opacity: 1; }
          to   { transform: scale(1); opacity: 1; }
        }
        .crt-backdrop {
          animation: crt-backdrop-in 1900ms cubic-bezier(0.16, 0.84, 0.24, 1) both;
          will-change: transform, opacity;
        }
        @media (prefers-reduced-motion: reduce) {
          .crt-backdrop { animation: none; }
        }
      `}</style>
      <Canvas
        dpr={[1, 2]}
        // Transparent so the CSS backdrop gradient shows through.
        //
        // Khronos PBR Neutral rather than ACES: ACES is a film-look curve that
        // desaturates and darkens as it rolls off, which turned the housing's
        // blue-grey plastic into flat grey. Neutral is built to leave albedo
        // alone, and matches how the model reads on its own Sketchfab page.
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
        camera={{ fov: 32, near: 0.05, far: 100 }}
      >
        <StudioLighting />
        <DynamicKeyLight engineRef={player.engineRef} boundsRef={boundsRef} />
        <Suspense fallback={null}>
          {/* Hidden until the rig has placed the camera. Wrapping rather than
              putting `visible` on CrtModel directly, because CrtModel renders
              the cached glTF scene and toggling visibility on that would leak
              into every later mount. */}
          <group ref={modelGroupRef} visible={placed}>
            <CrtModel
            canvas={milkdrop.canvas}
            dampRef={milkdrop.dampRef}
            active={milkdrop.running}
            onScreenFrame={onScreenFrame}
            video={takeover.video}
            activeRef={takeover.activeRef}
            staticRef={takeover.staticRef}
            />
          </group>
          <Measure screenRef={screenRef} boundsRef={boundsRef} groupRef={modelGroupRef} />
        </Suspense>
        <CameraRig
          screenRef={screenRef}
          boundsRef={boundsRef}
          focused={focused}
          onReady={onPlaced}
        />
      </Canvas>

      <SceneGrain />

      <CrtOverlay
        player={player}
        hintShown={hintShown}
        hidden={uiHidden}
        onToggleHide={toggleUi}
        focused={focused}
        visualiserReady={milkdrop.running}
        visualiserFailed={milkdrop.failed}
      />
    </div>
  );
}
