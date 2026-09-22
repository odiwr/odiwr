import { ImageResponse } from "next/og";
import { getContent, publicClips } from "@/lib/content";
import { clipSlides, embedFor, stillFor } from "@/lib/cinema";

/**
 * The link-preview card for a post, or one slide of it (?s=2 and on): what
 * iMessage, Discord, X and the rest show when a cinema link is pasted.
 *
 * Drawn like a tile of the grid, larger: the picture letterboxed in the cinema
 * frame, all on black (so the frame's bars and the card are one), and the gold line under it — what it is from on
 * the left, the date on the right. No address: the app shows the link's own
 * domain with the card anyway. The loop itself rides along as og:video for
 * the apps that play one (the page's metadata); this is the still.
 *
 * At a path of its own on the apex rather than beside the page, since the
 * cinema's pages are also served from its subdomain and a card URL has to be
 * absolute anyway.
 */

export const revalidate = 3600;

const WIDTH = 1200;
const HEIGHT = 630;
const GOLD = "#ffd994";

/** YYYY-MM-DD -> MM/DD/YY. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y.slice(2)}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clip = publicClips(await getContent()).find((c) => c.slug === slug);
  if (!clip) return new Response("Not found", { status: 404 });

  const slides = clipSlides(clip);
  const n = Number(new URL(request.url).searchParams.get("s") ?? "1");
  const slide = slides[Number.isInteger(n) && n >= 1 && n <= slides.length ? n - 1 : 0];

  const picture =
    stillFor(slide.poster) ??
    stillFor(slide.cover) ??
    (slide === slides[0] ? embedFor(clip.embed)?.thumb : undefined);
  // Relative in local development, where uploads are served from the project.
  const src = picture ? new URL(picture, request.url).toString() : undefined;

  // The frame, 2.39:1, as wide as the card allows with room for the line below.
  const frameW = 1104;
  const frameH = Math.round(frameW / 2.39);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#000",
          padding: 48,
        }}
      >
        <div
          style={{
            width: frameW,
            height: frameH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : null}
        </div>
        <div
          style={{
            width: frameW,
            display: "flex",
            justifyContent: "space-between",
            marginTop: 20,
            fontSize: 34,
            color: GOLD,
          }}
        >
          <span>{clip.show || clip.title}</span>
          <span>{shortDate(clip.date)}</span>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );
}
