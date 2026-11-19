import Icon from "@/components/icons";
import PortfolioBoard from "@/components/dashboard/PortfolioBoard";
import PortfolioSettings from "@/components/dashboard/PortfolioSettings";
import { getContent } from "@/lib/content";
import { viewItem, viewPortfolio } from "@/lib/portfolio";
import { SUBDOMAIN_LINKS } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * The portfolio: its title, sets and cover (PortfolioSettings), then every
 * picture and video in the site's order (PortfolioBoard), where new ones are
 * dropped in.
 */
export default async function PortfolioDashboard() {
  const { portfolio } = await getContent();
  const view = viewPortfolio(portfolio);

  const items = portfolio.items.map((item) => {
    const v = viewItem(item);
    return {
      id: item.id,
      kind: item.kind,
      thumb: v.thumb,
      full: v.full,
      width: item.width,
      height: item.height,
      duration: item.duration,
      caption: item.caption,
      set: item.set,
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
        <span className="text-foreground/30">Drag to reorder</span>
      </div>

      <PortfolioSettings
        title={portfolio.title}
        subtitle={portfolio.subtitle}
        sets={portfolio.sets}
        focus={view.focus}
        cover={
          // A video's still; one with no still has nothing to aim at.
          view.cover?.thumb
            ? { src: view.cover.thumb, width: view.cover.width, height: view.cover.height }
            : undefined
        }
      />

      <PortfolioBoard items={items} sets={portfolio.sets} cover={view.cover?.id} />
    </div>
  );
}
