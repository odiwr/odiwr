import Link from "next/link";
import Icon from "@/components/icons";
import ClipUploader from "@/components/dashboard/ClipUploader";
import { getContent, sortedClips } from "@/lib/content";
import { clipThumb } from "@/lib/cinema";
import { SUBDOMAIN_LINKS } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * The cinema: drop clips in, then open any of them to title and caption it.
 *
 * The grid is the site's own order, newest first, with hidden posts dimmed.
 * "From a link" makes a post that embeds a clip where it is officially
 * published instead of hosting a file.
 */
export default async function CinemaDashboard() {
  const clips = sortedClips(await getContent());

  return (
    <div className="flex flex-col gap-10">
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
        <Link
          href="/dashboard/cinema/new"
          className="inline-flex items-center gap-1.5 text-foreground/50 transition-colors hover:text-accent"
        >
          From a link
          <Icon name="material-symbols:arrow-right-alt-rounded" />
        </Link>
      </div>

      <ClipUploader />

      {clips.length === 0 ? (
        <p className="text-foreground/30">Nothing yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {clips.map((clip) => {
            const thumb = clipThumb(clip);
            return (
              <li key={clip.id}>
                <Link
                  href={`/dashboard/cinema/${clip.id}`}
                  title={clip.title}
                  className={`group relative block aspect-[2.39/1] overflow-hidden rounded-[2px] bg-[#242424] ${
                    clip.hidden ? "opacity-40" : ""
                  }`}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-end p-2 text-foreground/50">{clip.title}</span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pt-6 pb-1 text-sm opacity-0 transition-opacity group-hover:opacity-100">
                    {clip.hidden ? "Hidden · " : ""}
                    {clip.title}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
