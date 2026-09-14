"use server";

import { requireAdmin } from "@/lib/auth";
import { imagePixels, type ImagePixels } from "@/lib/image-background";

/**
 * A small copy of an image's pixels, for the editor's eyedropper in browsers
 * that have no screen eyedropper of their own (Firefox and its forks).
 *
 * Admin only, like every action: this fetches whatever URL it is given.
 */
export async function sampleImage(src: string): Promise<ImagePixels | null> {
  await requireAdmin();
  if (!/^https?:\/\//i.test(src)) return null;
  return (await imagePixels(src)) ?? null;
}
