import type { Work } from "./content";

/**
 * Where a work entry points. Safe to import from a client component: nothing
 * here reaches storage, unlike lib/content.ts, which re-exports these.
 */

/**
 * The entry's address: its page here, or wherever it lives.
 *
 * Null when it has neither. A blank or "#" link counts as none, so an entry
 * waiting on its link is shown as plain text rather than as a link that goes
 * nowhere (or, from a list that opens new tabs, to a second copy of the page).
 */
export function workHref(item: Pick<Work, "slug" | "href">): string | null {
  if (item.slug) return `/${item.slug}`;
  const href = item.href?.trim();
  return href && href !== "#" ? href : null;
}

/** Off-site entries open in a new tab; write-ups hosted here do not. */
export function isExternal(item: Pick<Work, "slug" | "href">): boolean {
  return !item.slug && workHref(item) !== null;
}
