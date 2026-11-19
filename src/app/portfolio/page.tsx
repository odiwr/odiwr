import type { Metadata } from "next";
import PortfolioGallery from "@/components/portfolio/PortfolioGallery";
import { getContent } from "@/lib/content";
import { portfolioMetadata, viewPortfolio } from "@/lib/portfolio";

/**
 * portfolio.odiwr.com. Photographs and video, laid out the way a Pixieset
 * gallery is: a cover, then everything in justified rows at its own shape.
 *
 * Reached by the host rewrite in proxy.ts, and at /portfolio until DNS points
 * the subdomain here. Each set is a page of its own as well ([set]/page.tsx).
 */

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return portfolioMetadata(viewPortfolio((await getContent()).portfolio));
}

export default async function PortfolioPage() {
  const view = viewPortfolio((await getContent()).portfolio);
  return <PortfolioGallery portfolio={view} initialSet={null} />;
}
