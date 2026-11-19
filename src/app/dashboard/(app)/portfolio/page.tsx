import Icon from "@/components/icons";
import PortfolioBoard from "@/components/dashboard/PortfolioBoard";
import { getContent } from "@/lib/content";
import { viewItem } from "@/lib/portfolio";
import { SUBDOMAIN_LINKS } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The portfolio: every picture and video, where new ones are dropped in. */
export default async function PortfolioDashboard() {
  const { portfolio } = await getContent();

  const items = portfolio.items.map((item) => {
    const v = viewItem(item);
    return {
      id: item.id,
      kind: item.kind,
      thumb: v.thumb,
      loop: v.loop,
      width: item.width,
      height: item.height,
      alt: item.alt,
      hidden: item.hidden,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-4">
        <a
          href={SUBDOMAIN_LINKS.portfolio}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-foreground/50 transition-colors hover:text-accent"
        >
          portfolio.odiwr.com
          <Icon name="material-symbols:arrow-outward-rounded" />
        </a>
        <span className="text-foreground/30">Shuffled on every visit</span>
      </div>

      <PortfolioBoard items={items} />
    </div>
  );
}
