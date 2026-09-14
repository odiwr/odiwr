"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { reorderWork } from "@/app/dashboard/(app)/actions";

/**
 * One section of the work list: drag to reorder, hover to pin.
 *
 * A drag is saved straight away — order is applied locally first, since a row
 * that waited for a round trip before moving would feel broken. Pins are NOT
 * saved here: clicking one only marks it, and WorkBoard's Save button writes
 * every marked change at once. That is why pin state comes in as a prop rather
 * than living in this list.
 *
 * The local copy also has to follow the server's. useState only reads its
 * argument once, so without the sync below a refresh would fetch new data and
 * the list would keep showing the stale copy.
 */

function Row({
  item,
  pinned,
  onPin,
}: {
  item: Work;
  pinned: boolean;
  onPin: (id: string) => void;
}) {
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
        aria-pressed={pinned}
        aria-label={pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
        // A pinned row keeps its mark on show; an unpinned one only offers it
        // when the pointer is on the row.
        className={`mr-auto flex transition-[color,opacity] ${
          pinned
            ? "text-accent opacity-100"
            : "text-foreground/40 opacity-0 group-hover:opacity-100 hover:text-accent focus-visible:opacity-100"
        }`}
      >
        <Icon
          name={pinned ? "material-symbols:keep" : "material-symbols:keep-outline"}
          size="1.25em"
        />
      </button>
    </li>
  );
}

export default function WorkSection({
  section,
  items: initial,
  isPinned,
  onPin,
}: {
  section: Section;
  items: Work[];
  isPinned: (item: Work) => boolean;
  onPin: (id: string) => void;
}) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  /**
   * Re-sync when the server's copy actually differs.
   *
   * Adjusted during render rather than in an effect — React's own pattern for
   * derived state, and it avoids a second paint showing the stale list. The
   * signature is compared rather than the array, which is a new object every
   * render.
   */
  const signature = initial.map((i) => `${i.id}:${i.pinned ? 1 : 0}`).join(",");
  const [seen, setSeen] = useState(signature);
  if (signature !== seen) {
    setSeen(signature);
    setItems(initial);
  }

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
    startTransition(async () => {
      await reorderWork(section, next.map((i) => i.id));
      router.refresh();
    });
  };

  if (items.length === 0) return <p className="text-foreground/30">Nothing yet.</p>;

  return (
    // A fixed id per section. Without one dnd-kit numbers its accessibility ids
    // from a counter, which counts differently on the server and in the
    // browser, and hydration reports the mismatch.
    <DndContext
      id={`work-${section}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      {/* Dim while the write is in flight, so a save is visible rather than
          silent. */}
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={`flex flex-col transition-opacity ${pending ? "opacity-60" : ""}`}>
          {items.map((item) => (
            <Row key={item.id} item={item} pinned={isPinned(item)} onPin={onPin} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
