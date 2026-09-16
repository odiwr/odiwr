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
import type { WishItem } from "@/lib/content";
import { reorderWishItems } from "@/app/dashboard/(app)/actions";
import { backgroundStyle, hostOf, wishBackground, wishImage } from "@/lib/wish";

/**
 * One category of the wishlist: drag the handle to reorder.
 *
 * Each drop is saved straight away, and the order is applied locally first so
 * the row lands where it was let go rather than waiting on the write. This order
 * is the one the site shows when no price sort is chosen.
 *
 * The local copy follows the server's the same way WorkSection's does.
 */

function Row({ item }: { item: WishItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const src = wishImage(item);
  const background = wishBackground(item);
  // Bought or kept off the site: the whole row steps back, picture and all.
  const muted = item.purchased || item.hidden;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-3 py-2 ${isDragging ? "relative z-10" : ""}`}
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

      <span
        className={`wish-thumb transition-opacity ${muted || isDragging ? "opacity-40" : ""}`}
        style={backgroundStyle(background)}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- remote shop images
          <img
            src={src}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            draggable={false}
            style={
              item.imageScale && item.imageScale !== 100
                ? { transform: `scale(${item.imageScale / 100})` }
                : undefined
            }
          />
        )}
      </span>

      <Link
        href={`/dashboard/wishlist/${item.id}`}
        className={`truncate transition-colors hover:text-accent ${
          muted || isDragging ? "text-foreground/40" : ""
        }`}
      >
        {item.title}
      </Link>

      <span
        className={`ml-auto shrink-0 ${muted || isDragging ? "text-foreground/20" : "text-foreground/40"}`}
      >
        {hostOf(item.href)}
      </span>
    </li>
  );
}

export default function WishSection({
  category,
  items: initial,
}: {
  category: string;
  items: WishItem[];
}) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Follow the server's copy when it actually changes (an edit, or another tab).
  const signature = JSON.stringify(initial);
  const [seen, setSeen] = useState(signature);
  if (signature !== seen) {
    setSeen(signature);
    setItems(initial);
  }

  const sensors = useSensors(
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
      await reorderWishItems(category, next.map((i) => i.id));
      router.refresh();
    });
  };

  return (
    // A fixed id, so dnd-kit's accessibility ids match between server and browser.
    <DndContext
      id={`wish-${category}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={`flex flex-col transition-opacity ${pending ? "opacity-60" : ""}`}>
          {items.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
