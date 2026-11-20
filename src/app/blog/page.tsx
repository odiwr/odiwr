import type { Metadata } from "next";
import SectionHeader from "@/components/work/SectionHeader";
import { getContent, allPosts, displayDate } from "@/lib/content";
import { renderInline } from "@/lib/richtext";
import { SITE } from "@/lib/site";

/**
 * Every post, the live one first, then the archive.
 *
 * The home page only ever shows the live post, so until this page an archived
 * one could be read nowhere but the feed. Each post sits at #its-id, which is
 * where the feed's links land.
 */

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog",
  description: `Posts by ${SITE.handle}.`,
  alternates: { canonical: "/blog" },
  openGraph: { title: SITE.name, url: `${SITE.url}/blog` },
};

export default async function BlogPage() {
  const posts = allPosts(await getContent());

  return (
    <main className="page">
      <div className="page-grid">
        <div className="top-fade" aria-hidden="true" />

        <article className="prose enter">
          <SectionHeader title="Blog" />

          {posts.length === 0 ? (
            <p className="text-foreground/50">Nothing here yet.</p>
          ) : (
            posts.map((post) => (
              // Clear of the fixed fade at the top when a link lands here.
              <section key={post.id} id={post.id} style={{ scrollMarginTop: "var(--page-top)" }}>
                <a
                  href={`#${post.id}`}
                  className="text-foreground/50 transition-colors hover:text-accent"
                >
                  {displayDate(post.date)}
                </a>
                {post.paragraphs.map((text, i) => (
                  <p key={i} className="mt-3 text-foreground/80">
                    {renderInline(text, `${post.id}-${i}`)}
                  </p>
                ))}
              </section>
            ))
          )}
        </article>

        <aside className="side" aria-hidden="true" />
      </div>
    </main>
  );
}
