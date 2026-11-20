import Brand from "@/components/icons/Brand";

/**
 * A stack mark with its name on hover.
 *
 * The browser's own tooltip is a pale yellow box in the system font that takes a
 * second to appear and cannot be styled, which is the one thing it needed to be.
 * This is the same information, in the page's own colours, immediately.
 *
 * No JavaScript: hover and focus-visible both reveal it, so it is reachable by
 * keyboard. It is aria-hidden because the mark already carries the same name as
 * its label — a screen reader should hear it once, not twice.
 *
 * The name is passed in (stackTitle in lib/stack-index.ts, called on the
 * server) so this can sit inside a client component without the index.
 */
export default function StackMark({ slug, title }: { slug: string; title: string }) {
  return (
    <span className="stack-mark">
      <Brand slug={slug} title={title} />
      <span className="stack-tip" aria-hidden="true">
        {title}
      </span>
    </span>
  );
}
