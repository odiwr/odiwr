import Brand from "@/components/icons/Brand";
import { stackTitle } from "@/lib/stack-index";

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
 */
export default function StackMark({ slug }: { slug: string }) {
  return (
    <span className="stack-mark">
      <Brand slug={slug} />
      <span className="stack-tip" aria-hidden="true">
        {stackTitle(slug)}
      </span>
    </span>
  );
}
