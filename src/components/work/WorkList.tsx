import SectionHeader from "./SectionHeader";
import FilterableList from "./FilterableList";
import type { Work } from "@/lib/content";
import { stackTitle } from "@/lib/stack-index";

/**
 * The listing on projects.odiwr.com.
 *
 * Same grid and same 640px column as the home page, so moving between the hosts
 * does not feel like moving between sites.
 */
export default function WorkList({ heading, items }: { heading: string; items: Work[] }) {
  // Only the names this list uses go to the browser, not the whole index.
  const titles = Object.fromEntries(
    items.flatMap((item) => item.stack ?? []).map((slug) => [slug, stackTitle(slug)])
  );

  return (
    <main className="page">
      <div className="page-grid">
        <article className="prose enter">
          <SectionHeader title={heading} />

          {items.length === 0 ? (
            <p className="text-foreground/50">Nothing here yet.</p>
          ) : (
            <FilterableList items={items} titles={titles} />
          )}
        </article>

        <aside className="side" aria-hidden="true" />
      </div>
    </main>
  );
}
