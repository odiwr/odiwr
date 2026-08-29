import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SectionHeader from "@/components/work/SectionHeader";
import StackIcons from "@/components/work/StackIcons";
import { getContent, findWork, slugWork } from "@/lib/content";
import { renderInline } from "@/lib/richtext";
import { SITE } from "@/lib/site";

/**
 * A single piece of work, at the root: /memory-mission, /mp3, and so on.
 *
 * Its own page, opened in its own tab — which is why the header's "Back" returns
 * to the tab it came from and closes this one rather than pushing history.
 *
 * Params come from the registry, so only declared slugs build. Anything else
 * 404s rather than rendering an empty shell.
 */

/**
 * True, unlike the sections: entries are published from the dashboard between
 * deploys, and a slug added after the last build must still resolve. Unknown
 * slugs still 404 — the page checks the document itself.
 */
export const dynamicParams = true;

/** Re-read the content document at most this often. */
export const revalidate = 60;

/** Shown only while an entry has no description of its own. */
const PLACEHOLDER = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum, sed ut perspiciatis unde omnis iste natus error sit voluptatem.",
];

export async function generateStaticParams() {
  const content = await getContent();
  return slugWork(content).map((w) => ({ slug: w.slug as string }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const work = findWork(await getContent(), slug);
  if (!work) return {};
  // The tab still says "odiwr" everywhere, by request — only the description
  // and the canonical URL are per-page.
  // A custom card if the entry has one, otherwise the site-wide image resolved
  // by app/opengraph-image.tsx. Setting `images` here overrides that file for
  // this route only.
  const images = work.ogImage ? [{ url: work.ogImage, width: 1200, height: 630 }] : undefined;

  return {
    description: work.blurb,
    alternates: { canonical: `/${work.slug}` },
    openGraph: {
      title: SITE.name,
      description: work.blurb,
      url: `${SITE.url}/${work.slug}`,
      ...(images ? { images } : {}),
    },
    twitter: {
      title: SITE.name,
      description: work.blurb,
      ...(images ? { images } : {}),
    },
  };
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = findWork(await getContent(), slug);
  if (!work) notFound();

  const isVideo = work.media && /\.(mp4|webm)$/i.test(work.media);

  return (
    <main className="page">
      <div className="page-grid">
        <article className="prose enter">
          <SectionHeader title={work.title} />

          {/* The clip floats and the blurb runs around it, so both have to sit
              inside one block — a float only affects the text that follows it in
              the same flow. */}
          <div>
            <div className="work-media">
              {work.media ? (
                isVideo ? (
                  // Never autoplayed: these may carry audio, so starting one is
                  // the visitor's call.
                  <video src={work.media} controls loop playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={work.media} alt="" />
                )
              ) : (
                // Holds the shape while there is no clip yet, so the wrap is
                // visible. It goes away on its own once `media` is set.
                <div className="aspect-video w-full bg-[#242424]" aria-hidden="true" />
              )}
            </div>

            {(work.description
              ? work.description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
              : PLACEHOLDER
            ).map((text, i) => (
              <p key={i} className={i ? "mt-7 text-foreground/80" : "text-foreground/80"}>
                {renderInline(text, `b${i}`)}
              </p>
            ))}
          </div>

          {work.stack?.length ? (
            <div className="flex justify-end">
              <StackIcons stack={work.stack} />
            </div>
          ) : null}

        </article>

        <aside className="side" aria-hidden="true" />
      </div>
    </main>
  );
}
