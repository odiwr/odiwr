import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { getContent, wishGroups } from "@/lib/content";
import Wishlist from "@/components/wishlist/Wishlist";

/**
 * wishlist.odiwr.com.
 *
 * UNLISTED: seen only by people given the link. Nothing public links here, no
 * sitemap lists it, and the page asks search engines not to index it. The Open
 * Graph tags stay, so a shared link still unfurls properly.
 *
 * Reached by the host rewrite in proxy.ts, and directly at /wishlist until DNS
 * points the subdomain here. Same grid and column as the home page; the one
 * thing it adds is pictures, since the point of a wishlist is seeing the thing.
 */
export const metadata: Metadata = {
  description: "@odiwr's literature, tech, and apparel wishlist.",
  robots: { index: false, follow: false, nocache: true },
  openGraph: { title: SITE.name, url: SITE.wishlistUrl },
};

export default async function WishlistPage() {
  const content = await getContent();
  // Items switched off in the dashboard never leave the server.
  const groups = wishGroups(content)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.hidden) }))
    .filter((g) => g.items.length);

  return (
    <main className="page">
      <div className="page-grid">
        <div className="top-fade" aria-hidden="true" />

        <article className="prose enter">
          {/* The header, the intro and the list. The intro is handed in because
              opening Filter swaps it out for the filters. */}
          <Wishlist
            groups={groups}
            intro={
              <p className="text-foreground/80">
                Hello, friends and/or curious devs! Welcome to my{" "}
                <span className="font-cursive">literature</span>, tech, and apparel wishlist.
              </p>
            }
          />
        </article>

        <aside className="side" aria-hidden="true" />
      </div>
    </main>
  );
}
