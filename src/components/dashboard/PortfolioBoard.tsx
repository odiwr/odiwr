"use client";

import { useRef, useState, useTransition } from "react";
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
import Select from "./Select";
import { ACCEPT, gate, prepare, refusal, type Step } from "./portfolio-media";
import { clock } from "@/lib/portfolio";
import {
  addPortfolioItem,
  deletePortfolioItem,
  reorderPortfolio,
  setPortfolioCover,
  setPortfolioHidden,
  updatePortfolioItem,
} from "@/app/dashboard/(app)/portfolio-actions";

/**
 * The portfolio's pictures and videos, in the order the site shows them.
 *
 * Drop any number of files on the box (or choose them): each is read, copied
 * and uploaded in the browser (portfolio-media.ts), three at a time, and saved
 * in the order chosen, at the front of the grid. Nothing has to be cropped or
 * sized first — the site fits every shape as it comes.
 *
 * Every tile: drag to move it; over it, hide (off the site, kept here), cover,
 * and delete; under it, its set and caption, saved as they change.
 *
 * Changes are applied here first and saved behind them, as CinemaBoard does.
 */

export type BoardItem = {
  id: string;
  kind: "image" | "video";
  thumb: string;
  full: string;
  width: number;
  height: number;
  duration?: number;
  caption?: string;
  set?: string;
  hidden?: boolean;
};

type Pending = {
  key: string;
  name: string;
  /** A local look at a picture while it uploads. */
  preview?: string;
  state: Step | "waiting" | "saving" | "saved" | "failed";
  error?: string;
  /** Set once saved, so the tile can give way to the real one when it arrives. */
  id?: string;
};

const SAYS: Record<Pending["state"], string> = {
  waiting: "Waiting",
  reading: "Reading",
  uploading: "Uploading",
  saving: "Saving",
  saved: "Saved",
  failed: "Failed",
};

const NO_SET = "";

function Tile({
  item,
  sets,
  isCover,
  onChange,
  onHide,
  onCover,
  onDelete,
}: {
  item: BoardItem;
  sets: string[];
  isCover: boolean;
  onChange: (patch: { caption?: string; set?: string }) => void;
  onHide: () => void;
  onCover: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const label = item.caption || (item.kind === "video" ? "Video" : "Picture");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-1.5 ${isDragging ? "relative z-10" : ""}`}
    >
      <div className="group relative">
        <div
          {...attributes}
          {...listeners}
          aria-label={`Move ${label}`}
          className={`relative aspect-square cursor-grab overflow-hidden rounded-[2px] bg-[#111] active:cursor-grabbing ${
            isDragging ? "opacity-60 shadow-2xl" : ""
          } ${item.hidden ? "opacity-40 grayscale" : ""}`}
        >
          {item.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumb}
              alt=""
              loading="lazy"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <video
              src={`${item.full}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
          )}
          <span className="pointer-events-none absolute bottom-1.5 left-2 flex items-center gap-1 text-xs text-white/80 [text-shadow:0_1px_2px_rgb(0_0_0/0.8)]">
            {item.kind === "video" && <Icon name="material-symbols:play-arrow-rounded" size="1.2em" />}
            {item.kind === "video" && item.duration ? clock(item.duration) : null}
          </span>
        </div>

        {/* Over the picture, not inside the drag handle, so they are never a drag. */}
        <button
          type="button"
          onClick={onHide}
          aria-label={item.hidden ? `Show ${label}` : `Hide ${label}`}
          title={item.hidden ? "Show: back on the site" : "Hide: off the site, kept here"}
          className="absolute top-1.5 left-1.5 flex rounded-full bg-black/60 p-1 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:text-accent focus-visible:opacity-100"
          style={item.hidden ? { opacity: 1 } : undefined}
        >
          <Icon
            name={
              item.hidden
                ? "material-symbols:visibility-off-outline-rounded"
                : "material-symbols:visibility-outline-rounded"
            }
            size="1.1em"
          />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${label}`}
          title="Delete"
          className="absolute top-1.5 right-1.5 flex rounded-full bg-black/60 p-1 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:text-[#ff6b6b] focus-visible:opacity-100"
        >
          <Icon name="material-symbols:close-rounded" size="1.1em" />
        </button>
        <button
          type="button"
          onClick={onCover}
          aria-label={isCover ? `${label} is the cover` : `Make ${label} the cover`}
          title={isCover ? "The cover" : "Make this the cover"}
          className={`absolute right-1.5 bottom-1.5 flex rounded-full bg-black/60 p-1 transition-opacity hover:text-accent focus-visible:opacity-100 ${
            isCover ? "text-accent opacity-100" : "text-white/80 opacity-0 group-hover:opacity-100"
          }`}
        >
          <Icon
            name={isCover ? "material-symbols:star-rounded" : "material-symbols:star-outline-rounded"}
            size="1.1em"
          />
        </button>
      </div>

      {sets.length > 0 && (
        <Select
          name={`set-${item.id}`}
          label={`Set for ${label}`}
          className="text-sm"
          value={item.set ?? NO_SET}
          onChange={(set) => onChange({ set })}
          options={[
            { value: NO_SET, label: "No set", muted: true },
            ...sets.map((s) => ({ value: s, label: s })),
          ]}
        />
      )}
      <input
        // Re-keyed by the saved caption, so a save from elsewhere shows here.
        key={item.caption ?? ""}
        className="field text-sm"
        placeholder="Caption"
        aria-label={`Caption for ${label}`}
        defaultValue={item.caption ?? ""}
        onBlur={(e) => {
          const caption = e.currentTarget.value.trim();
          if (caption !== (item.caption ?? "")) onChange({ caption });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </li>
  );
}

export default function PortfolioBoard({
  items: initial,
  sets,
  cover,
}: {
  items: BoardItem[];
  sets: string[];
  /** The item on the cover: chosen, or the site's default (the first picture). */
  cover?: string;
}) {
  const [items, setItems] = useState(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [target, setTarget] = useState(NO_SET);
  const [over, setOver] = useState(false);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  /** Saves run one after another, so two can never write the document at once. */
  const chain = useRef<Promise<void>>(Promise.resolve());

  // Follow the server's copy when it actually changes (a save, or another
  // tab), and let go of uploads whose real tile has now arrived.
  const signature = JSON.stringify(initial);
  const [seen, setSeen] = useState(signature);
  if (signature !== seen) {
    setSeen(signature);
    setItems(initial);
    const arrived = new Set(initial.map((i) => i.id));
    setPending((all) =>
      all.filter((p) => {
        if (!p.id || !arrived.has(p.id)) return true;
        if (p.preview) URL.revokeObjectURL(p.preview);
        return false;
      })
    );
  }
  // A set taken off the list in the settings: the chosen one for uploads goes too.
  const into = sets.includes(target) ? target : NO_SET;

  const sensors = useSensors(
    // A few pixels of movement before it is a drag, so the buttons still click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const save = (work: () => Promise<unknown>) =>
    startTransition(async () => {
      await work();
      router.refresh();
    });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      items,
      items.findIndex((p) => p.id === active.id),
      items.findIndex((p) => p.id === over.id)
    );
    setItems(next);
    save(() => reorderPortfolio(next.map((p) => p.id)));
  };

  const patch = (key: string, change: Partial<Pending>) =>
    setPending((all) => all.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const add = (files: File[]) => {
    if (!files.length) return;
    const set = into || undefined;
    const batch: Pending[] = files.map((file) => {
      const why = refusal(file);
      return {
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        preview: !why && file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        state: why ? "failed" : "waiting",
        error: why ?? undefined,
      };
    });
    // The newest batch shows first, as it will be on the site.
    setPending((all) => [...batch, ...all]);

    const limit = gate(3);
    const jobs = files.map((file, i) =>
      batch[i].state === "failed"
        ? null
        : limit(() => prepare(file, (step) => patch(batch[i].key, { state: step })))
    );
    // Swallowed here and reported in the loop below, which waits on each in turn.
    for (const job of jobs) job?.catch(() => {});

    chain.current = chain.current.then(async () => {
      let after: string | undefined;
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        if (!job) continue;
        const key = batch[i].key;
        try {
          const item = await job;
          patch(key, { state: "saving" });
          after = await addPortfolioItem({ ...item, set }, after);
          patch(key, { state: "saved", id: after });
          router.refresh();
        } catch (error) {
          patch(key, {
            state: "failed",
            error: error instanceof Error ? error.message : "Something went wrong",
          });
        }
      }
    });
  };

  const drop = {
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      setOver(false);
      add([...e.dataTransfer.files]);
    },
  };

  const change = (item: BoardItem, next: { caption?: string; set?: string }) => {
    setItems((all) =>
      all.map((i) =>
        i.id === item.id
          ? {
              ...i,
              ...(next.caption !== undefined ? { caption: next.caption || undefined } : {}),
              ...(next.set !== undefined ? { set: next.set || undefined } : {}),
            }
          : i
      )
    );
    save(() =>
      updatePortfolioItem(item.id, {
        ...(next.caption !== undefined ? { caption: next.caption } : {}),
        ...(next.set !== undefined ? { set: next.set || null } : {}),
      })
    );
  };

  const hide = (item: BoardItem) => {
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, hidden: !item.hidden } : i)));
    save(() => setPortfolioHidden(item.id, !item.hidden));
  };

  const remove = (item: BoardItem) => {
    if (!window.confirm("Delete this from the portfolio? Its files are deleted too. This can't be undone.")) return;
    setItems((all) => all.filter((i) => i.id !== item.id));
    save(() => deletePortfolioItem(item.id));
  };

  const clearFailed = () =>
    setPending((all) =>
      all.filter((p) => {
        if (p.state !== "failed") return true;
        if (p.preview) URL.revokeObjectURL(p.preview);
        return false;
      })
    );

  const working = pending.some((p) => p.state !== "failed" && p.state !== "saved");

  return (
    <div className="flex flex-col gap-6" {...drop}>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          add([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-[2px] bg-[#242424] px-4 py-10 transition-colors ${
            over ? "text-accent outline outline-1 outline-accent" : "text-foreground/50 hover:text-accent"
          }`}
        >
          <Icon name="material-symbols:upload-rounded" size="1.8em" />
          Drop photos and videos here, or choose them
          <span className="text-foreground/30">
            Any shape, any number · JPEG, PNG, WebP, GIF, AVIF, MP4, WebM
          </span>
        </button>
        {sets.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-foreground/40">Add to</span>
            <Select
              name="upload-set"
              label="Set for new uploads"
              className="sm:w-64"
              value={into}
              onChange={setTarget}
              options={[
                { value: NO_SET, label: "No set", muted: true },
                ...sets.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4 text-foreground/40">
            <span>{working ? "Uploading — keep this tab open" : "Uploads"}</span>
            {pending.some((p) => p.state === "failed") && (
              <button type="button" onClick={clearFailed} className="transition-colors hover:text-accent">
                Clear failed
              </button>
            )}
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {pending.map((p) => (
              <li
                key={p.key}
                className="relative aspect-square overflow-hidden rounded-[2px] bg-[#111]"
                title={p.error ?? p.name}
              >
                {p.preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.preview} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                )}
                <span className="absolute inset-0 flex flex-col justify-end gap-0.5 p-2 text-xs leading-4">
                  <span className="truncate text-foreground/70">{p.name}</span>
                  <span className={p.state === "failed" ? "text-[#ff6b6b]" : "text-accent"}>
                    {p.state === "failed" ? p.error : SAYS[p.state]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 ? (
        !pending.length && <p className="text-foreground/30">Nothing yet.</p>
      ) : (
        <DndContext
          id="portfolio-board"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <ul
              className={`grid grid-cols-2 gap-x-3 gap-y-6 transition-opacity sm:grid-cols-3 md:grid-cols-4 ${
                busy ? "opacity-80" : ""
              }`}
            >
              {items.map((item) => (
                <Tile
                  key={item.id}
                  item={item}
                  sets={sets}
                  isCover={item.id === cover}
                  onChange={(next) => change(item, next)}
                  onHide={() => hide(item)}
                  onCover={() => save(() => setPortfolioCover(item.id === cover ? null : item.id))}
                  onDelete={() => remove(item)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
