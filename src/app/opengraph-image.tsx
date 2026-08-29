import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE } from "@/lib/site";

/**
 * The card people see when a link to this site is pasted into a message.
 *
 * Generated rather than committed as a flat file so it tracks the brand
 * automatically — change the mark or the background and the preview follows,
 * with no stale PNG to remember to re-export.
 *
 * 1200x630 is the size every platform crops from. Anything important stays away
 * from the edges, because the crop differs per platform and some take a square
 * out of the middle.
 *
 * Deliberately carries no tagline. There is no approved copy yet, and an
 * invented line here would be the most public place possible for it.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = SITE.name;
// Reading the mark off disk needs Node, not the edge runtime.
export const runtime = "nodejs";

export default async function OpengraphImage() {
  const svg = await readFile(join(process.cwd(), "public/brand/catguy.svg"), "utf8");
  const mark = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          background: "#1a1a1a",
          color: "#f2f2f2",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mark} width={280} height={224} alt="" />
        <div style={{ fontSize: 96, letterSpacing: "-0.03em", display: "flex" }}>{SITE.name}</div>
      </div>
    ),
    size
  );
}
