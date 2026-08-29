"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
import type { Section, Work } from "@/lib/content";
import { reorderWork, togglePin } from "@/app/dashboard/(app)/actions";

/**
 * One section of the work list: drag to reorder, hover to pin.
 *
 * Order and pin state are held locally and applied straight away, with the
 * server action running behind it. A drag that waited for a round trip before
 * moving the row would feel broken.
 */

function Row({ item, onPin }: { item: Work; onPin: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-3 py-2 ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.title}`}
        className="flex cursor-grab text-foreground/20 transition-colors group-hover:text-foreground/50 active:cursor-grabbing"
      >
        <Icon name="material-symbols:drag-indicator" size="1.25em" />
      </button>

      <Link
        href={`/dashboard/work/${item.id}`}
        className="truncate transition-colors hover:text-accent"
      >
        {item.title}
      </Link>

      <button
        type="button"
        onClick={() => onPin(item.id)}
        aria-pressed={Boolean(item.pinned)}
        aria-label={item.pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
        // A pinned row keeps its mark on show; an unpinned one only offers it
        // when the pointer is on the row.
        className={`mr-auto flex transition-[color,opacity] ${
          item.pinned
            ? "text-accent opacity-100"
            : "text-foreground/40 opacity-0 group-hover:opacity-100 hover:text-accent focus-visible:opacity-100"
        }`}
      >
        <Icon
          name={item.pinned ? "material-symbols:keep" : "material-symbols:keep-outline"}
          size="1.25em"
        />
      </button>
    </li>
  );
}

export default function WorkSection({
  section,
  items: initial,
}: {
  section: Section;
  items: Work[];
}) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicking the handle or the
    // pin never registers as one.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      items,
      items.findIndex((i) => i.id === active.id),
      items.findIndex((i) => i.id === over.id)
    );
    setItems(next);
    startTransition(() => {
      reorderWork(section, next.map((i) => i.id));
    });
  };

  const pin = (id: string) => {
    setItems((current) =>
      current.map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i))
    );
    startTransition(() => {
      togglePin(id);
    });
  };

  if (items.length === 0) return <p className="text-foreground/30">Nothing yet.</p>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col">
          {items.map((item) => (
            <Row key={item.id} item={item} onPin={pin} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
