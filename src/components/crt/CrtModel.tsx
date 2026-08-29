"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createCrtMaterial, type CrtUniforms } from "./crtShader";
import { findGlassMesh, findScreenMesh, getScreenFrame, type ScreenFrame } from "./screen";

// Served from R2 rather than the repo: a 4.6MB binary does not belong in git,
// and the bucket is already where every other heavy asset lives.
export const CRT_MODEL_URL = "/media?key=mp3/crt.glb";

/**
 * The tube's aspect, measured off the mesh: 2.6927 x 2.0197 model units, which
 * is exactly 4:3. Used to crop 16:9 footage to fill rather than stretch it.
 */
const SCREEN_ASPECT = 4 / 3;

/**
 * The television, with MilkDrop bound to its tube.
 *
 * FINDING THE SCREEN. The model's names are unusable — Sketchfab exported the
 * materials as ".015" / ".008" / ".010" and the node names as mojibake
 * ("���.001_1"), so matching on any of them would be guesswork
 * that breaks the moment the file is re-exported. The screen is identified
 * structurally instead, by the one property that actually defines it: the
 * picture layer is the mesh whose material carries an emissive texture over a
 * black base colour. There is exactly one such mesh here.
 *
 * The model stacks two coincident faces about 0.01 units apart — the emissive
 * picture behind, and a translucent glass sheet (alpha 0.63) in front. Only the
 * first is replaced; the glass is left alone, because it is what sells the
 * reflection and dust sitting over the image.
 */

type Props = {
  /** The offscreen canvas MilkDrop paints into. */
  canvas: HTMLCanvasElement | null;
  /** Photosensitivity damping, 0..1, read every frame. */
  dampRef: React.RefObject<number>;
  /** Fades the tube up once the visualiser is actually running. */
  active: boolean;
  /** Reports where the screen is and which way it faces, for the camera rig. */
  onScreenFrame: (frame: ScreenFrame) => void;
  /** How strongly the glass sheet in front of the picture prints, 0..1. */
  glassOpacity?: number;
  /** The takeover clip, when the current track has one. */
  video?: HTMLVideoElement | null;
  /** True while the clip should be on screen instead of the visualiser. */
  activeRef?: React.RefObject<boolean>;
  /** 0..1 static burst, read every frame. */
  staticRef?: React.RefObject<number>;
};

export default function CrtModel({
  canvas,
  dampRef,
  active,
  onScreenFrame,
  glassOpacity = 0.16,
  video = null,
  activeRef,
  staticRef,
}: Props) {
  const { scene } = useGLTF(CRT_MODEL_URL);
  const uniformsRef = useRef<CrtUniforms | null>(null);
  const screenRef = useRef<THREE.Mesh | null>(null);

  /** Canvas → texture. glTF UVs are top-left origin, as is a canvas, so the
   *  usual flipY that three applies to loose textures must be turned off. */
  const texture = useMemo(() => {
    if (!canvas) return null;
    const t = new THREE.CanvasTexture(canvas);
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, [canvas]);

  useEffect(() => {
    if (!texture) return;
    return () => void texture.dispose();
  }, [texture]);

  /**
   * The clip, as a texture. VideoTexture uploads a new frame on its own each
   * render, so unlike the MilkDrop canvas it needs no manual needsUpdate.
   */
  const videoTexture = useMemo(() => {
    if (!video) return null;
    const t = new THREE.VideoTexture(video);
    // Same convention as the canvas: glTF UVs are top-left origin.
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, [video]);

  useEffect(() => {
    if (!videoTexture) return;
    return () => void videoTexture.dispose();
  }, [videoTexture]);

  useEffect(() => {
    const mesh = findScreenMesh(scene);

    if (!mesh) {
      // Loud rather than silent: a re-export that drops the emissive map would
      // otherwise just show the model with a dead tube and no explanation.
      console.warn(
        "[CrtModel] No emissive screen mesh found in the model - the visualiser has nowhere to go."
      );
      return;
    }

    // Measure BEFORE swapping the material: the structural test that finds the
    // screen keys off the emissive map, which the shader below does not have,
    // so nothing can locate it again afterwards.
    const frame = getScreenFrame(mesh);
    if (frame) onScreenFrame(frame);

    // useGLTF caches the parsed scene process-wide, so this mesh is shared with
    // every future mount. Swapping its material without putting the original
    // back leaves the cached model permanently altered: the next mount finds a
    // ShaderMaterial with no emissive map, the structural search matches
    // nothing, and the tube stays dead with only a warning to show for it.
    // Hot reload hits this on every save.
    const original = mesh.material;

    const { material, uniforms } = createCrtMaterial(texture);
    mesh.material = material;
    // Draw before the translucent glass sheet sitting in front of it.
    mesh.renderOrder = 0;

    uniformsRef.current = uniforms;
    screenRef.current = mesh;

    // The glass sheet in front of the picture ships at 0.63 alpha, which reads
    // as a dirty window over the visualiser rather than as glass. Dropped well
    // back so the scratches and dust are a hint, not a layer. Cloned first: the
    // material is shared through useGLTF's process-wide cache, so editing it in
    // place would leak the change into every later mount.
    const glass = findGlassMesh(scene, mesh);
    let glassOriginal: THREE.Material | THREE.Material[] | null = null;
    let glassClone: THREE.Material | null = null;
    if (glass) {
      const gm = glass.material as THREE.MeshStandardMaterial;
      glassOriginal = glass.material;
      glassClone = gm.clone();
      (glassClone as THREE.MeshStandardMaterial).opacity = gm.opacity * glassOpacity;
      glass.material = glassClone;
    }

    return () => {
      mesh.material = original;
      if (glass && glassOriginal) glass.material = glassOriginal;
      glassClone?.dispose();
      material.dispose();
      uniformsRef.current = null;
      screenRef.current = null;
    };
  }, [scene, texture, onScreenFrame, glassOpacity]);

  // react-hooks/immutability fires on everything below. It is right in general
  // and wrong here: react-three-fiber's frame loop exists to mutate scene
  // objects sixty times a second, entirely outside React's render cycle.
  // Routing uniform writes through state would re-render the tree every frame,
  // which is the thing this whole design is built to avoid.
  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    const u = uniformsRef.current;
    if (!u) return;
    u.uTime.value += delta;
    u.uDamp.value = dampRef.current ?? 0;
    u.uStatic.value = staticRef?.current ?? 0;
    u.uVideo.value = videoTexture;
    // A hard switch, not an ease. Easing only ever ASYMPTOTES toward 1, so a
    // percent or two of the frozen visualiser frame stayed composited over the
    // clip forever, which read as the paused background showing through. The
    // static burst is what hides the cut; the mix itself is binary.
    u.uMix.value = activeRef?.current && videoTexture ? 1 : 0;

    // Cover-fit the clip to the 4:3 tube. Recomputed rather than cached because
    // videoWidth is 0 until metadata arrives.
    if (video && video.videoWidth > 0) {
      const videoAspect = video.videoWidth / video.videoHeight;
      if (videoAspect > SCREEN_ASPECT) {
        u.uVideoUv.value.set(SCREEN_ASPECT / videoAspect, 1);
      } else {
        u.uVideoUv.value.set(1, videoAspect / SCREEN_ASPECT);
      }
    }
    // Warm up from black rather than snapping on, the way a tube actually does.
    // Just under 1: the scanline and mask passes each take a bite out of the
    // picture, but the halation adds back on top, and the net was reading hot.
    const target = active ? 0.92 : 0;
    u.uGain.value += (target - u.uGain.value) * Math.min(1, delta * 1.6);
    if (texture) texture.needsUpdate = true;
  });

  /* eslint-enable react-hooks/immutability */

  // Lighting lives in StudioLighting, as image-based light on the whole scene.
  // There is deliberately no lamp here: the point light this used to carry lit
  // one flank of the housing with a hard falloff, and sat on the wrong axis to
  // boot, so it grazed the side panel rather than spilling from the tube.
  return <primitive object={scene} />;
}

useGLTF.preload(CRT_MODEL_URL);
