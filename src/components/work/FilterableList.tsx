"use client";

import { useState } from "react";
import Icon from "@/components/icons";
import { isExternal, workHref, type Work } from "@/lib/content";
import Brand from "@/components/icons/Brand";
import { stackTitle } from "@/lib/stack-index";

/**
 * The project listing, filterable by tech stack.
 *
 * Clicking a stack mark narrows the list to the work using it; clicking the same
 * mark again clears it. The mark does not stay orange afterwards — what is being
 * shown is legible from the list itself, and a highlight stuck on a control the
 * pointer has left reads as a bug. The button is blurred on click for the same
 * reason, or the browser's own focus ring would keep it lit.
 *
 * Rows that drop out are not unmounted, they collapse (see .filter-row), so the
 * ones that stay slide up into the space rather than snapping into place.
 */
export default function FilterableList({ items }: { items: Work[] }) {
  const [active, setActive] = useState<string | null>(null);

  const toggle = (key: string, event: React.MouseEvent<HTMLButtonElement>) => {
    setActive((current) => (current === key ? null : key));
    event.currentTarget.blur();
  };

  return (
    <ul>
      {items.map((item) => {
        const hidden = active !== null && !item.stack?.includes(active);

        return (
          <li key={item.id} className="filter-row" data-hidden={hidden} aria-hidden={hidden}>
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <a
                  href={workHref(item)}
                  tabIndex={hidden ? -1 : undefined}
                  {...(isExternal(item) ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                  className="inline-flex items-center gap-1.5 underline decoration-foreground/30 decoration-1 underline-offset-[2.5px] transition-colors hover:text-accent hover:decoration-accent"
                >
                  {item.title}
                  <Icon name="material-symbols:arrow-outward-rounded" />
                </a>

                {/* Pushed to the end of the row rather than sitting against the
                    title, so the marks line up down the right edge. */}
                {item.stack?.length ? (
                  <span className="flex shrink-0 items-center gap-3">
                    {item.stack.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className="stack-filter"
                        tabIndex={hidden ? -1 : undefined}
                        aria-label={
                          active === key ? "Show everything again" : `Show only ${stackTitle(key)}`
                        }
                        aria-pressed={active === key}
                        onClick={(event) => toggle(key, event)}
                      >
                        <Brand slug={key} />
                      </button>
                    ))}
                  </span>
                ) : null}
              </div>

              {item.blurb && <p className="mt-0.5 text-foreground/50">{item.blurb}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
