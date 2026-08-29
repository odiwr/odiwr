import type { Metadata } from "next";
import CrtSceneClient from "@/components/crt/CrtSceneClient";
import { SITE } from "@/lib/site";

/**
 * projects.odiwr.com/mp3 — a CRT television playing MilkDrop, wired to a
 * jukebox.
 *
 * Full-bleed and dark: the scene owns the whole viewport, so nothing from the
 * site's own layout belongs here.
 *
 * Its heavy assets — the model and the takeover clips — come from R2 rather than
 * the repo. Around 36MB of binaries has no business in git, and the bucket is
 * already where everything else lives.
 */
export const metadata: Metadata = {
  description: "A CRT television playing MilkDrop, wired to a jukebox.",
  alternates: { canonical: `${SITE.projectsUrl}/mp3` },
  openGraph: { title: SITE.name, url: `${SITE.projectsUrl}/mp3` },
};

export default function Mp3Page() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#141414",
      }}
    >
      <CrtSceneClient />
    </main>
  );
}
