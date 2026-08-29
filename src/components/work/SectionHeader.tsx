import BackLink from "./BackLink";

/**
 * The bar at the top of a section or a write-up: the way back on the left, the
 * name of whatever you are looking at on the right.
 */
export default function SectionHeader({ title }: { title: string }) {
  return (
    <header className="flex items-baseline justify-between gap-4">
      <BackLink />
      <h1 className="font-medium">{title}</h1>
    </header>
  );
}
