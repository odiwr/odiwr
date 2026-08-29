"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Icon from "@/components/icons";
import Brand from "@/components/icons/Brand";
import { STACK_INDEX, stackTitle } from "@/lib/stack-index";

/**
 * The tech stack, in order of prominence.
 *
 * Order is the whole point — leftmost is what the project is most about — so
 * the chosen list is dragged, not nudged. The value reaches the server action
 * through one hidden comma-separated field.
 *
 * The search runs over every brand Simple Icons ships, not a curated shortlist,
 * so niche tools are there without anyone having to add them first.
 */

const RESULTS = 8;

function Row({ slug, onRemove }: { slug: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slug,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 py-1 ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${stackTitle(slug)}`}
        className="flex cursor-grab text-foreground/25 transition-colors hover:text-foreground/60 active:cursor-grabbing"
      >
        <Icon name="material-symbols:drag-indicator" size="1.25em" />
      </button>

      <Brand slug={slug} />
      <span className="mr-auto">{stackTitle(slug)}</span>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${stackTitle(slug)}`}
        className="flex text-foreground/40 transition-colors hover:text-accent"
      >
        <Icon name="material-symbols:close-rounded" size="1.35em" />
      </button>
    </li>
  );
}

export default function StackPicker({ name, initial }: { name: string; initial: string[] }) {
  const [keys, setKeys] = useState<string[]>(initial);
  const [query, setQuery] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const chosen = new Set(keys);
    const starts: string[] = [];
    const contains: string[] = [];
    for (const [slug, title] of STACK_INDEX) {
      if (chosen.has(slug)) continue;
      const t = title.toLowerCase();
      // Prefix matches first: typing "rust" should not bury Rust under
      // everything that merely contains the letters.
      if (t.startsWith(q) || slug.startsWith(q)) starts.push(slug);
      else if (t.includes(q) || slug.includes(q)) contains.push(slug);
      if (starts.length >= RESULTS) break;
    }
    return [...starts, ...contains].slice(0, RESULTS);
  }, [query, keys]);

  const add = (slug: string) => {
    setKeys((current) => (current.includes(slug) ? current : [...current, slug]));
    setQuery("");
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setKeys((current) =>
      arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id)))
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={keys.join(",")} />

      {keys.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={keys} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col">
              {keys.map((slug) => (
                <Row
                  key={slug}
                  slug={slug}
                  onRemove={() => setKeys(keys.filter((k) => k !== slug))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <div className="relative">
        <input
          className="field"
          value={query}
          placeholder="Search technologies"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches.length) {
              // Otherwise Enter in a search box submits the whole form.
              event.preventDefault();
              add(matches[0]);
            }
            if (event.key === "Escape") setQuery("");
          }}
        />

        {matches.length > 0 && (
          <ul className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-[2px] bg-[#242424] py-1 shadow-lg shadow-black/40">
            {matches.map((slug) => (
              <li key={slug}>
                <button
                  type="button"
                  onClick={() => add(slug)}
                  className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors hover:text-accent"
                >
                  <Brand slug={slug} />
                  {stackTitle(slug)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
