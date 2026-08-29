import SectionHeader from "./SectionHeader";
import FilterableList from "./FilterableList";
import type { Work } from "@/lib/content";

/**
 * The listing on projects.odiwr.com.
 *
 * Same grid and same 640px column as the home page, so moving between the hosts
 * does not feel like moving between sites.
 */
export default function WorkList({ heading, items }: { heading: string; items: Work[] }) {
  return (
    <main className="page">
      <div className="page-grid">
        <article className="prose enter">
          <SectionHeader title={heading} />

          {items.length === 0 ? (
            <p className="text-foreground/50">Nothing here yet.</p>
          ) : (
            <FilterableList items={items} />
          )}
        </article>

        <aside className="side" aria-hidden="true" />
      </div>
    </main>
  );
}
