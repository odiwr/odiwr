import WorkBoard from "@/components/dashboard/WorkBoard";
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
    <WorkBoard
      sections={SECTIONS.map((section) => ({
        section,
        heading: HEADINGS[section],
        items: sectionWork(content, section),
      }))}
    />
  );
}
