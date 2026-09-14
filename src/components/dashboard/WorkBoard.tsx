"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Icon from "@/components/icons";
import WorkSection from "./WorkSection";
import type { Section, Work } from "@/lib/content";
import { savePins } from "@/app/dashboard/(app)/actions";

/**
 * Every section of the work list, and the one Save that commits pins.
 *
 * Clicking a pin only marks the change. Nothing is written until Save, which
 * sends all of them together — so pinning three things is one write, not three
 * racing each other, and a stray click costs nothing.
 *
 * Unsaved changes are kept as id -> pinned OVER the server's copy rather than in
 * a copy of the list. A drag in any section refreshes the page's data, and a
 * copy would be replaced by that refresh along with every unsaved pin.
 */

/** A short hop, so each new change visibly lands on the button. */
const JUMP: Keyframe[] = [
  { transform: "translateY(0)" },
  { transform: "translateY(-8px)", offset: 0.4 },
  { transform: "translateY(0)" },
];

export default function WorkBoard({
  sections,
}: {
  sections: { section: Section; heading: string; items: Work[] }[];
}) {
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(false);
  const [saving, startSaving] = useTransition();
  const button = useRef<HTMLButtonElement>(null);

  const saved = new Map(sections.flatMap((s) => s.items).map((i) => [i.id, Boolean(i.pinned)]));

  // Only what still differs from the server counts. A change that has since
  // been saved, or undone by clicking again, or whose entry is gone, does not.
  const pending = Object.entries(changes).filter(
    ([id, pinned]) => saved.has(id) && saved.get(id) !== pinned
  );
  const dirty = pending.length > 0;

  /**
   * The button stays mounted after it is no longer needed, for as long as its
   * fade-out runs. Set during render, React's pattern for state that follows
   * other state, so it is on screen in the same paint that needs it.
   */
  const show = dirty || saving;
  const [mounted, setMounted] = useState(show);
  if (show && !mounted) setMounted(true);

  const isPinned = (item: Work) =>
    Object.hasOwn(changes, item.id) ? changes[item.id] : Boolean(item.pinned);

  const toggle = (id: string) => {
    setError(false);

    const next = { ...changes };
    const base = Boolean(saved.get(id));
    const was = Object.hasOwn(changes, id) ? changes[id] : base;
    if (!was === base) delete next[id];
    else next[id] = !was;
    setChanges(next);

    // Hop only when there is still something to save afterwards. Undoing the
    // last change sends the button away, and that exit is its fade alone. Not
    // on screen yet: its fade-in is the landing.
    const stillDirty = Object.entries(next).some(([key, pinned]) => saved.has(key) && saved.get(key) !== pinned);
    if (
      stillDirty &&
      button.current &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      button.current.animate(JUMP, { duration: 360, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" });
    }
  };

  const save = () =>
    startSaving(async () => {
      try {
        // The action revalidates this page, so the fresh list arrives with its
        // response and the marks do not flicker back before it does.
        await savePins(Object.fromEntries(pending));
        setChanges({});
      } catch {
        setError(true);
      }
    });

  // Take the button away once its fade-out has had time to run. animationend
  // alone is not enough: where animations are paused (a background tab, some
  // embedded views) it never fires, and an invisible Save would stay in place.
  useEffect(() => {
    if (show || !mounted) return;
    const timer = setTimeout(() => setMounted(false), 460);
    return () => clearTimeout(timer);
  }, [show, mounted]);

  // Leaving with unsaved pins asks first — they would otherwise just be gone.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div className="flex flex-col gap-10">
      {sections.map(({ section, heading, items }) => (
        <section key={section} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-foreground/40">{heading}</h2>
            <Link
              href={`/dashboard/work/new?section=${section}`}
              className="inline-flex items-center gap-1.5 text-foreground/50 transition-colors hover:text-accent"
            >
              New
              <Icon name="material-symbols:arrow-right-alt-rounded" />
            </Link>
          </div>

          <WorkSection section={section} items={items} isPinned={isPinned} onPin={toggle} />
        </section>
      ))}

      {mounted && (
        <div
          className={`save-float fixed right-6 bottom-6 z-20 flex items-center gap-4 ${
            show ? "" : "is-leaving"
          }`}
          onAnimationEnd={(event) => {
            if (!show && event.animationName === "save-leave") setMounted(false);
          }}
        >
          {error && <span className="text-accent">Pins did not save. Try again.</span>}
          <button
            ref={button}
            type="button"
            onClick={save}
            disabled={saving || !show}
            className="rounded-full bg-[#141414] px-5 py-2.5 font-medium text-white transition-colors hover:text-accent disabled:opacity-70"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
