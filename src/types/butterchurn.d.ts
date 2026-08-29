/**
 * Minimal typings for butterchurn — the MilkDrop engine Webamp uses.
 *
 * The package ships UMD builds with no types and touches `window` at module
 * scope, so it can only ever be reached through a dynamic import inside an
 * effect. These declarations cover the surface the visualiser actually calls.
 */

declare module "butterchurn" {
  export type MilkdropPreset = Record<string, unknown>;

  export type MilkdropVisualizerInstance = {
    connectAudio(node: AudioNode): void;
    loadPreset(preset: MilkdropPreset, blendTimeSeconds: number): void;
    /** MilkDrop's smoky song-title overlay, the same one Winamp shows. */
    launchSongTitleAnim(title: string): void;
    setRendererSize(width: number, height: number): void;
    render(): void;
  };

  const butterchurn: {
    createVisualizer(
      context: AudioContext,
      canvas: HTMLCanvasElement,
      options: {
        width: number;
        height: number;
        pixelRatio?: number;
        textureRatio?: number;
      }
    ): MilkdropVisualizerInstance;
  };

  export default butterchurn;
}

declare module "butterchurn-presets" {
  import type { MilkdropPreset } from "butterchurn";
  const presets: {
    getPresets(): Record<string, MilkdropPreset>;
  };
  export default presets;
}
