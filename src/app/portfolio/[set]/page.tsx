import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PortfolioGallery from "@/components/portfolio/PortfolioGallery";
import { getContent } from "@/lib/content";
import { portfolioMetadata, viewPortfolio } from "@/lib/portfolio";

/**
 * One set of the portfolio: portfolio.odiwr.com/film.
 *
 * The same page as the whole gallery, with that set's tab chosen. Switching
 * tabs on the page does not come back here — it filters in place and changes
 * the address — so this is what a shared or reloaded set address renders.
 *
 * A set with nothing visible in it 404s.
 */

/** Sets are made from the dashboard between deploys; a new one must resolve. */
export const dynamicParams = true;
export const revalidate = 60;

export async function generateStaticParams() {
  return viewPortfolio((await getContent()).portfolio).sets.map((s) => ({ set: s.slug }));
}

type Params = Promise<{ set: string }>;

async function resolve(params: Params) {
  const { set } = await params;
  const view = viewPortfolio((await getContent()).portfolio);
  const found = view.sets.find((s) => s.slug === set);
  return found ? { view, set: found } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await resolve(params);
  return found ? portfolioMetadata(found.view, found.set) : {};
}

export default async function PortfolioSetPage({ params }: { params: Params }) {
  const found = await resolve(params);
  if (!found) notFound();
  return <PortfolioGallery portfolio={found.view} initialSet={found.set.slug} />;
}
