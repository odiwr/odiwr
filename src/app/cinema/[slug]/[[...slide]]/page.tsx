import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CinemaGallery from "@/components/cinema/CinemaGallery";
import { getContent, publicClips, type Clip } from "@/lib/content";
import { clipSlides, isVideoFile, slidePath, viewClip } from "@/lib/cinema";
import { SITE } from "@/lib/site";

/**
 * One post, or one slide of it: cinema.odiwr.com/slug, /slug/2 and on.
 *
 * The same gallery as the grid, opened on this post and slide already — the
 * page a tile opens into, so arriving from a link looks the same as clicking
 * through. Closing it lands on the grid underneath.
 *
 * Every slide has its own preview card (app/og/cinema) and carries its loop as
 * og:video, so a shared link unfurls as that slide.
 *
 * Hidden posts, and slides that are not there, 404.
 */

/** Posts are made from the dashboard between deploys; a new slug must resolve. */
export const dynamicParams = true;
export const revalidate = 60;

export async function generateStaticParams() {
  return publicClips(await getContent()).map((c) => ({ slug: c.slug, slide: [] }));
}

type Params = Promise<{ slug: string; slide?: string[] }>;

/** The post and the slide (from 0) an address names, or null for one that names nothing. */
async function resolve(params: Params): Promise<{ clips: Clip[]; clip: Clip; slide: number } | null> {
  const { slug, slide } = await params;
  const clips = publicClips(await getContent());
  const clip = clips.find((c) => c.slug === slug);
  if (!clip) return null;
  if (!slide?.length) return { clips, clip, slide: 0 };
  // /slug/1 is the post itself; only its own address is.
  const n = Number(slide[0]);
  if (slide.length > 1 || !Number.isInteger(n) || n < 2 || n > clipSlides(clip).length) return null;
  return { clips, clip, slide: n - 1 };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const { clip, slide } = found;

  const firstLine = clip.caption?.split(/\n/)[0]?.trim();
  const description =
    [clip.title, clip.show].filter(Boolean).join(" — ") + (firstLine ? `. ${firstLine}` : "");
  const url = `${SITE.cinemaUrl}/${slidePath(clip.slug, slide)}`;
  const card = `${SITE.url}/og/cinema/${clip.slug}${slide ? `?s=${slide + 1}` : ""}`;
  const s = clipSlides(clip)[slide];
  // The loop, for the apps that play a video in a preview. Absolute, as every
  // og: URL has to be.
  const loop = s.cover ?? (isVideoFile(s.poster) ? s.poster : undefined);
  const video = loop ? new URL(loop, SITE.url).toString() : undefined;

  return {
    description,
    alternates: { canonical: url },
    openGraph: {
      title: SITE.name,
      description,
      url,
      type: video ? "video.other" : "website",
      images: [{ url: card, width: 1200, height: 630 }],
      ...(video ? { videos: [{ url: video, type: "video/mp4", width: 640 }] } : {}),
    },
    twitter: { card: "summary_large_image", title: SITE.name, description, images: [card] },
  };
}

export default async function ClipPage({ params }: { params: Params }) {
  const found = await resolve(params);
  if (!found) notFound();
  const { clips, clip, slide } = found;

  return (
    <main className="page page-full">
      <h1 className="sr-only">{clip.title}</h1>
      <CinemaGallery clips={clips.map(viewClip)} initialSlug={clip.slug} initialSlide={slide} />
    </main>
  );
}
