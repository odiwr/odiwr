import type { Metadata } from "next";
import PortfolioGallery from "@/components/portfolio/PortfolioGallery";
import { getContent } from "@/lib/content";
import { portfolioMetadata, publicItems, shuffle } from "@/lib/portfolio";

/**
 * portfolio.odiwr.com. Pictures and video, and nothing else: no words on the
 * page at all.
 *
 * In a new order on every visit, so the page is rendered per request rather
 * than cached — the shuffle has to happen on the server, where the rows are cut
 * for it, or the grid would jump once the browser reordered it. The content
 * read behind it is still cached (lib/content.ts), so a visit costs no more
 * than the render.
 *
 * Same frame as the home page (.page), with its fade along the top edge.
 * Reached by the host rewrite in proxy.ts, and at /portfolio until DNS points
 * the subdomain here.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return portfolioMetadata(publicItems((await getContent()).portfolio));
}

export default async function PortfolioPage() {
  const items = shuffle(publicItems((await getContent()).portfolio));

  return (
    <main className="page">
      <h1 className="sr-only">Portfolio</h1>
      {/* The strip the page scrolls under, as on the home page. */}
      <div className="top-fade" aria-hidden="true" />
      <PortfolioGallery items={items} />
    </main>
  );
}
