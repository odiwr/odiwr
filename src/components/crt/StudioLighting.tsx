"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Sketchfab-style studio lighting.
 *
 * Matched to how the model is lit on its own Sketchfab page: soft neutral light
 * arriving from every direction, no visible hotspot, the plastic housing
 * reading as mid-tone blue-grey with the stickers and graffiti legible, against
 * a dark backdrop. That look is image-based lighting, not lamps — which is why
 * the previous single point light was wrong twice over. It picked out one flank
 * of the set with a hard falloff, and because it sat on +Z while the tube faces
 * +X, the flank it picked was the side panel.
 *
 * The environment is generated procedurally by RoomEnvironment, which ships
 * inside three and is baked here through PMREMGenerator. Nothing is fetched: an
 * HDRI file would mean a CDN request from the visitor's browser and another
 * megabyte on a page that already carries a 4.8MB model.
 *
 * Only scene.environment is set, never scene.background — the room stays dark
 * so the tube is still the brightest thing in frame.
 */

type Props = {
  /** Strength of the image-based light on the model's PBR materials. */
  intensity?: number;
  /** Renderer exposure. Raises the whole image, textures included. */
  exposure?: number;
};

/* eslint-disable react-hooks/immutability --
   Configuring the renderer and the scene means assigning to them. They are
   long-lived Three objects owned by the canvas, not React state, and there is
   no declarative route to environment/exposure that doesn't rebuild the
   renderer. */
export default function StudioLighting({ intensity = 0.92, exposure = 1.22 }: Props) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    // A little blur on the source keeps the room's panel edges from showing up
    // as banded reflections in the set's glossy plastic.
    const target = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = target.texture;

    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useEffect(() => {
    scene.environmentIntensity = intensity;
  }, [scene, intensity]);

  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);

  return null;
}
