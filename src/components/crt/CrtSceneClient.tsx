"use client";

import dynamic from "next/dynamic";

/**
 * Loads the scene in the browser only.
 *
 * three.js and drei reach for browser globals while their modules evaluate, so
 * prerendering this on the server fails outright — the build hit
 * "ProgressEvent is not defined" from the GLTF loader. Nothing in a WebGL scene
 * has a meaningful server rendering anyway.
 */
const CrtScene = dynamic(() => import("./CrtScene"), {
  ssr: false,
  loading: () => null,
});

export default function CrtSceneClient() {
  return <CrtScene />;
}
