import Link from "next/link";
import Icon from "@/components/icons";
import WorkSection from "@/components/dashboard/WorkSection";
import { getContent, sectionWork, SECTIONS, type Section } from "@/lib/content";

export const dynamic = "force-dynamic";

const HEADINGS: Record<Section, string> = {
  current: "Current",
  projects: "Projects",
  creative: "Creative",
};

export default async function WorkPage() {
  const content = await getContent();

  return (
    <div className="flex flex-col gap-10">
      {SECTIONS.map((section) => (
        <section key={section} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-foreground/40">{HEADINGS[section]}</h2>
            <Link
              href={`/dashboard/work/new?section=${section}`}
              className="inline-flex items-center gap-1.5 text-foreground/50 transition-colors hover:text-accent"
            >
              New
              <Icon name="material-symbols:arrow-right-alt-rounded" />
            </Link>
          </div>

          <WorkSection section={section} items={sectionWork(content, section)} />
        </section>
      ))}
    </div>
  );
}
