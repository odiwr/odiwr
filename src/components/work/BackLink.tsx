"use client";

import Icon from "@/components/icons";
import { HOME_HREF } from "@/lib/site";

/**
 * "Back", for a page that was probably opened in its own tab.
 *
 * If this tab was opened by another page, that tab is still sitting there — so
 * the useful thing is to return to it and close this one, rather than leaving a
 * duplicate behind. Failing that, load the main page.
 *
 * window.close() only works on tabs a script opened, and a link with
 * rel="noopener" gets no opener at all, so both are checked and there is a
 * timeout fallback for the case where the browser simply refuses. The element
 * stays a real href, so middle-click and "open in new tab" still behave.
 */
export default function BackLink() {
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle modified clicks — those mean "somewhere else".
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

    const opener = window.opener as Window | null;
    if (!opener || opener.closed) return; // plain navigation to HOME_HREF

    event.preventDefault();
    try {
      opener.focus();
    } catch {
      // Cross-origin opener: focusing is not allowed, closing still is.
    }
    window.close();
    window.setTimeout(() => {
      if (!window.closed) window.location.href = HOME_HREF;
    }, 150);
  };

  return (
    <a
      href={HOME_HREF}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-foreground/50 transition-colors hover:text-accent"
    >
      <Icon name="material-symbols:arrow-left-alt-rounded" />
      Back
    </a>
  );
}
