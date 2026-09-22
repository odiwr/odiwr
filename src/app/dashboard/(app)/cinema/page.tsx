import Link from "next/link";
import Icon from "@/components/icons";
import CinemaBoard from "@/components/dashboard/CinemaBoard";
import { getContent, sortedClips } from "@/lib/content";
import { viewClip } from "@/lib/cinema";
import { SUBDOMAIN_LINKS } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * The cinema: every post in the site's order (drag to change it), each one
 * opening in the composer; archive and delete over each tile. New post opens
 * the composer empty.
 */
export default async function CinemaDashboard() {
  const posts = sortedClips(await getContent()).map((clip) => {
    const view = viewClip(clip);
    return {
      id: clip.id,
      title: clip.title,
      show: clip.show,
      date: clip.date,
      hidden: clip.hidden,
      first: view.slides[0],
      slides: view.slides.length,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-4">
        <a
          href={SUBDOMAIN_LINKS.cinema}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-foreground/50 transition-colors hover:text-accent"
        >
          cinema.odiwr.com
          <Icon name="material-symbols:arrow-outward-rounded" />
        </a>
        <span className="text-foreground/30">Drag to reorder</span>
      </div>

      <Link
        href="/dashboard/cinema/new"
        className="flex items-center justify-center gap-2 rounded-[2px] bg-[#242424] px-4 py-6 text-foreground/60 transition-colors hover:text-accent"
      >
        <Icon name="material-symbols:add-rounded" size="1.3em" />
        New post
      </Link>

      <CinemaBoard posts={posts} />
    </div>
  );
}
