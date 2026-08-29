import StackMark from "./StackMark";

/**
 * The tech stack beside a project title.
 *
 * Rendered in the order given, which is the order of prominence — leftmost is
 * the one the project is most about. The dashboard's drag list writes that
 * order; nothing here sorts it.
 */
export default function StackIcons({ stack }: { stack?: string[] }) {
  if (!stack?.length) return null;
  return (
    <span className="inline-flex items-center gap-2 text-foreground/40">
      {stack.map((slug) => (
        <StackMark key={slug} slug={slug} />
      ))}
    </span>
  );
}
