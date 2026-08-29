import Icon from "@/components/icons";
import BackLink from "./BackLink";

/**
 * The bar at the top of a section or a write-up: the way back on the left, what
 * you are looking at on the right.
 *
 * Given an href the title becomes the way OUT to the thing itself — the
 * repository, the video, wherever it actually lives — since a write-up page
 * otherwise has no link to its own subject.
 */
export default function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <header className="flex items-baseline justify-between gap-4">
      <BackLink />

      {href ? (
        <h1 className="font-medium">
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 underline decoration-foreground/30 decoration-1 underline-offset-[2.5px] transition-colors hover:text-accent hover:decoration-accent"
          >
            {title}
            <Icon name="material-symbols:arrow-outward-rounded" />
          </a>
        </h1>
      ) : (
        <h1 className="font-medium">{title}</h1>
      )}
    </header>
  );
}
