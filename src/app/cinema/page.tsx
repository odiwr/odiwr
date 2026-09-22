import type { Metadata } from "next";
import CinemaGallery from "@/components/cinema/CinemaGallery";
import { SITE } from "@/lib/site";
import { getContent, publicClips } from "@/lib/content";
import { viewClip } from "@/lib/cinema";

/**
 * cinema.odiwr.com. Favourite moments from films and shows.
 *
 * Edge to edge with a small margin (.page-full): a grid of cinema-shaped tiles,
 * each a muted loop letterboxed into 2.39:1, with what it is from and the date
 * under it. A tile opens into the clip at its own shape, at its own address —
 * all of which lives in CinemaGallery.
 *
 * Reached by the host rewrite in proxy.ts, and at /cinema until DNS points the
 * subdomain here.
 */
export const metadata: Metadata = {
  description: "@odiwr's favourite moments from film and TV.",
  alternates: { canonical: SITE.cinemaUrl },
  openGraph: { title: SITE.name, url: SITE.cinemaUrl },
};

export const revalidate = 60;

export default async function CinemaPage() {
  const clips = publicClips(await getContent()).map(viewClip);

  return (
    <main className="page page-full">
      <h1 className="sr-only">Cinema</h1>
      <CinemaGallery clips={clips} />
    </main>
  );
}
