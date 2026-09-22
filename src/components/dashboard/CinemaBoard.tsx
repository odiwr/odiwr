"use client";

import { useRef, useState, useTransition } from "react";
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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Icon from "@/components/icons";
import SlidePicture from "@/components/cinema/SlidePicture";
import type { ViewSlide } from "@/lib/cinema";
import { deletePost, reorderClips, setArchived } from "@/app/dashboard/(app)/actions";

/**
 * Every post, in the order the site shows them: drag a tile to move it.
 *
 * Each tile opens its post in the composer. Over it, top left, archive: the
 * post greys out here and leaves the site, and the same button brings it back.
 * Top right, delete, after a confirmation — that one is for good, files and
 * all.
 *
 * Every change is applied here first and saved behind it, so a tile lands
 * where it was let go rather than waiting on the write. The local copy follows
 * the server's the same way WishSection's does.
 */

export type BoardPost = {
  id: string;
  title: string;
  show?: string;
  date: string;
  hidden?: boolean;
  first: ViewSlide;
  slides: number;
};

/** YYYY-MM-DD -> MM/DD/YY. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y.slice(2)}`;
}

function Tile({
  post,
  onArchive,
  onDelete,
  wasDragged,
}: {
  post: BoardPost;
  onArchive: () => void;
  onDelete: () => void;
  /** True for the click a drag ends with, which is not a click to open. */
  wasDragged: () => boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: post.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative ${isDragging ? "z-10" : ""}`}
    >
      <Link
        href={`/dashboard/cinema/${post.id}`}
        {...attributes}
        {...listeners}
        draggable={false}
        onClick={(e) => {
          if (wasDragged()) e.preventDefault();
        }}
        aria-label={`Edit ${post.title}`}
        className={`relative block aspect-[2.39/1] cursor-grab overflow-hidden rounded-[2px] bg-black active:cursor-grabbing ${
          isDragging ? "opacity-60 shadow-2xl" : ""
        } ${post.hidden ? "opacity-40 grayscale" : ""}`}
      >
        <SlidePicture
          slide={post.first}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        {post.slides > 1 && (
          <span className="absolute right-2 bottom-1.5 text-xs text-white/80 [text-shadow:0_1px_2px_rgb(0_0_0/0.8)]">
            1/{post.slides}
          </span>
        )}
      </Link>

      {/* Over the tile, not inside the link, so they are never a drag or a way into the editor. */}
      <button
        type="button"
        onClick={onArchive}
        aria-label={post.hidden ? `Unarchive ${post.title}` : `Archive ${post.title}`}
        title={post.hidden ? "Unarchive: back on the site" : "Archive: off the site, kept here"}
        className="absolute top-1.5 left-1.5 flex rounded-full bg-black/60 p-1 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:text-accent focus-visible:opacity-100"
        style={post.hidden ? { opacity: 1 } : undefined}
      >
        <Icon
          name={post.hidden ? "material-symbols:unarchive-outline-rounded" : "material-symbols:archive-outline-rounded"}
          size="1.1em"
        />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${post.title}`}
        title="Delete"
        className="absolute top-1.5 right-1.5 flex rounded-full bg-black/60 p-1 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:text-[#ff6b6b] focus-visible:opacity-100"
      >
        <Icon name="material-symbols:close-rounded" size="1.1em" />
      </button>

      <p className={`cinema-meta ${post.hidden ? "opacity-40" : ""}`}>
        <span>{post.hidden ? `Archived · ${post.show || post.title}` : post.show || post.title}</span>
        <time dateTime={post.date}>{shortDate(post.date)}</time>
      </p>
    </li>
  );
}

export default function CinemaBoard({ posts: initial }: { posts: BoardPost[] }) {
  const [posts, setPosts] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Follow the server's copy when it actually changes (an edit, or another tab).
  const signature = JSON.stringify(initial);
  const [seen, setSeen] = useState(signature);
  if (signature !== seen) {
    setSeen(signature);
    setPosts(initial);
  }

  const sensors = useSensors(
    // A few pixels of movement before it is a drag, so a click still opens the post.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const save = (work: () => Promise<unknown>) =>
    startTransition(async () => {
      await work();
      router.refresh();
    });

  // Letting go of a drag also fires a click on the tile, which would open it.
  // Set when a drag starts; the click that follows sees it and is dropped.
  const dragging = useRef(false);
  const wasDragged = () => dragging.current;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    // Cleared after the click that ends the drag has been and gone.
    window.setTimeout(() => (dragging.current = false));
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      posts,
      posts.findIndex((p) => p.id === active.id),
      posts.findIndex((p) => p.id === over.id)
    );
    setPosts(next);
    save(() => reorderClips(next.map((p) => p.id)));
  };

  const archive = (post: BoardPost) => {
    setPosts((all) => all.map((p) => (p.id === post.id ? { ...p, hidden: !post.hidden } : p)));
    save(() => setArchived(post.id, !post.hidden));
  };

  const remove = (post: BoardPost) => {
    if (!window.confirm(`Delete "${post.title}"? Its clips are deleted too. This can't be undone.`)) return;
    setPosts((all) => all.filter((p) => p.id !== post.id));
    save(() => deletePost(post.id));
  };

  if (!posts.length) return <p className="text-foreground/30">Nothing yet.</p>;

  return (
    // A fixed id, so dnd-kit's accessibility ids match between server and browser.
    <DndContext
      id="cinema-board"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => (dragging.current = true)}
      onDragCancel={() => window.setTimeout(() => (dragging.current = false))}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={posts.map((p) => p.id)} strategy={rectSortingStrategy}>
        <ul
          className={`grid grid-cols-2 gap-x-2 gap-y-4 transition-opacity sm:grid-cols-3 ${
            pending ? "opacity-80" : ""
          }`}
        >
          {posts.map((post) => (
            <Tile
              key={post.id}
              post={post}
              onArchive={() => archive(post)}
              onDelete={() => remove(post)}
              wasDragged={wasDragged}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
