"use client";

import { useEffect, useRef, useState } from "react";
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
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Icon from "@/components/icons";
import { captureFrame, captureLoop } from "./capture";
import { deletePost, saveCinemaPost, type SlideInput } from "@/app/dashboard/(app)/actions";

/**
 * Making a post, or changing one: the same screen either way.
 *
 * Clips go in a strip of slides — drag to reorder, × to take one out, + for
 * more. The one selected plays large above it, looping just its trim, with the
 * trim bar under it: drag either end. Trims never cut the file; the site plays
 * the trimmed part, so a post can be re-trimmed any time.
 *
 * Posting publishes at once. Before that, for every clip that is new or whose
 * trim changed, the browser cuts a still and records the cover loop from the
 * trimmed part (capture.ts), and uploads what is new. Then the whole post is
 * saved in one go (saveCinemaPost), so it never exists half made. Recording is
 * real time and needs the tab in front: a few seconds a clip.
 */

/** Shortest trim allowed, in seconds. */
const MIN_LENGTH = 0.3;

/** A slide being composed: a file just added, or one already posted. */
export type ComposerSlide = SlideInput & {
  /** Where the editor can play it, and the browser can read it back to record a cover. */
  source?: string;
  /** For a slide that is only a loop (no clip): the loop to show. No trim then. */
  loopOnly?: string;
};

type Item = ComposerSlide & {
  key: string;
  file?: File;
  duration?: number;
  /** The trim it was saved with, to tell whether the cover needs recording again. */
  saved?: { start?: number; end?: number };
};

let keys = 0;
const nextKey = () => `s${++keys}`;

function fmt(t: number | undefined): string {
  if (t === undefined || !Number.isFinite(t)) return "–";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function isVideo(href: string): boolean {
  return /\.(mp4|webm)(?:[?#]|$)/i.test(href) || href.startsWith("blob:");
}

/** Uploads one file and answers with its address. */
async function upload(file: File | Blob, name: string): Promise<string> {
  const body = new FormData();
  body.set("file", file instanceof File ? file : new File([file], name, { type: file.type }));
  const res = await fetch("/dashboard/api/cinema", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data.url;
}

/* ------------------------------------------------------------------ */
/* The trim bar                                                        */
/* ------------------------------------------------------------------ */

function TrimBar({
  duration,
  start,
  end,
  playhead,
  onChange,
}: {
  duration: number;
  start: number;
  end: number;
  playhead: number;
  /** `edge` is the end being dragged, so the preview can show that frame. */
  onChange: (start: number, end: number, edge: "start" | "end") => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const pct = (t: number) => `${(t / duration) * 100}%`;

  const drag = (edge: "start" | "end") => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = track.current!.getBoundingClientRect();
      const t = Math.round(Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1) * duration * 10) / 10;
      if (edge === "start") onChange(Math.min(t, end - MIN_LENGTH), end, "start");
      else onChange(start, Math.max(t, start + MIN_LENGTH), "end");
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  // Arrow keys nudge a handle by a tenth of a second, shift for a whole one.
  const key = (edge: "start" | "end") => (e: React.KeyboardEvent) => {
    const step = (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0);
    if (!step) return;
    e.preventDefault();
    if (edge === "start") onChange(Math.min(Math.max(start + step, 0), end - MIN_LENGTH), end, "start");
    else onChange(start, Math.max(Math.min(end + step, duration), start + MIN_LENGTH), "end");
  };

  const handle =
    "absolute top-0 bottom-0 w-3 -translate-x-1/2 cursor-ew-resize rounded-[2px] bg-[#ffd994] outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <div className="flex flex-col gap-1.5">
      <div ref={track} className="relative h-10 touch-none rounded-[2px] bg-[#242424]">
        {/* What plays, framed; what does not, dimmed either side. */}
        <div className="absolute inset-y-0 left-0 bg-black/50" style={{ width: pct(start) }} />
        <div className="absolute inset-y-0 right-0 bg-black/50" style={{ left: pct(end) }} />
        <div
          className="absolute inset-y-0 border-y-2 border-[#ffd994]"
          style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }}
        />
        <div className="absolute inset-y-0 w-px bg-white/80" style={{ left: pct(playhead) }} />
        <button
          type="button"
          aria-label="Trim start"
          className={handle}
          style={{ left: pct(start) }}
          onPointerDown={drag("start")}
          onKeyDown={key("start")}
        />
        <button
          type="button"
          aria-label="Trim end"
          className={handle}
          style={{ left: pct(end) }}
          onPointerDown={drag("end")}
          onKeyDown={key("end")}
        />
      </div>
      <div className="flex justify-between text-sm text-foreground/50 tabular-nums">
        <span>{fmt(start)}</span>
        <span className="text-[#ffd994]">{fmt(end - start)} long</span>
        <span>{fmt(end)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The strip of slides                                                 */
/* ------------------------------------------------------------------ */

function Thumb({
  item,
  index,
  selected,
  onSelect,
  onRemove,
}: {
  item: Item;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });
  const src = item.source ?? item.loopOnly;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative w-36 shrink-0 ${isDragging ? "z-10" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        aria-label={`Slide ${index + 1}`}
        aria-pressed={selected}
        className={`relative block aspect-video w-full cursor-grab overflow-hidden rounded-[2px] bg-black active:cursor-grabbing ${
          selected ? "outline-2 outline-offset-2 outline-[#ffd994]" : "opacity-70 hover:opacity-100"
        }`}
      >
        {src &&
          (isVideo(src) ? (
            <video
              // A hair in: at 0 a paused video often shows nothing but black.
              src={item.source ? `${src}#t=${item.start || 0.1}` : src}
              muted
              playsInline
              preload="metadata"
              autoPlay={!item.source}
              loop={!item.source}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
          ))}
        <span className="absolute bottom-1 left-1.5 text-xs text-white/80 [text-shadow:0_1px_2px_rgb(0_0_0/0.8)]">
          {index + 1}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove slide ${index + 1}`}
        className="absolute top-1 right-1 flex rounded-full bg-black/70 p-0.5 text-white/80 hover:text-[#ff6b6b]"
      >
        <Icon name="material-symbols:close-rounded" size="0.95em" />
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* The composer                                                        */
/* ------------------------------------------------------------------ */

export default function PostComposer({
  post,
}: {
  /** An existing post to edit; absent for a new one. */
  post?: {
    id: string;
    title: string;
    show?: string;
    caption?: string;
    embed?: string;
    slides: ComposerSlide[];
  };
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(() =>
    (post?.slides ?? []).map((s) => ({ ...s, key: nextKey(), saved: { start: s.start, end: s.end } }))
  );
  const [selected, setSelected] = useState(0);
  const [show, setShow] = useState(post?.show ?? "");
  const [title, setTitle] = useState(post?.title ?? "");
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [embed, setEmbed] = useState(post?.embed ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playhead, setPlayhead] = useState(0);

  const input = useRef<HTMLInputElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  // Object URLs made for added files, let go when the composer is.
  const made = useRef<string[]>([]);

  useEffect(() => () => made.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const current = items[Math.min(selected, items.length - 1)];
  const canTrim = !!current?.source && !!current.duration;
  const start = current?.start ?? 0;
  const end = current?.end ?? current?.duration ?? 0;

  const update = (key: string, patch: Partial<Item>) =>
    setItems((all) => all.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const add = (files: File[]) => {
    const videos = files.filter((f) => /^video\/(mp4|webm)$/.test(f.type));
    if (videos.length < files.length) setError("Only MP4 or WebM clips — export a .mov as MP4 first.");
    if (!videos.length) return;
    const added: Item[] = videos.map((file) => {
      const source = URL.createObjectURL(file);
      made.current.push(source);
      return { key: nextKey(), file, source, start: 0 };
    });
    setItems((all) => [...all, ...added]);
    setSelected(items.length);
  };

  // The selected clip loops its trim: back to the start whenever it passes the end.
  useEffect(() => {
    const video = player.current;
    if (!video || !current?.source) return;
    let frame = 0;
    const watch = () => {
      const stop = current.end ?? video.duration;
      if (stop && video.currentTime >= stop) video.currentTime = current.start ?? 0;
      setPlayhead(video.currentTime);
      frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
    return () => cancelAnimationFrame(frame);
  }, [current?.key, current?.source, current?.start, current?.end]);

  const trim = (s: number, e: number, edge: "start" | "end") => {
    if (!current) return;
    update(current.key, { start: s, end: e });
    // Show the frame at the end being moved; playing resumes from the start.
    const video = player.current;
    if (video) {
      video.currentTime = edge === "start" ? s : Math.max(s, e - 0.05);
      if (edge === "end") window.setTimeout(() => video && (video.currentTime = s), 350);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = ({ active, over: target }: DragEndEvent) => {
    if (!target || active.id === target.id) return;
    const from = items.findIndex((i) => i.key === active.id);
    const to = items.findIndex((i) => i.key === target.id);
    const moving = items[Math.min(selected, items.length - 1)]?.key;
    const next = arrayMove(items, from, to);
    setItems(next);
    setSelected(Math.max(0, next.findIndex((i) => i.key === moving)));
  };

  const remove = (key: string) => {
    const at = items.findIndex((i) => i.key === key);
    setItems((all) => all.filter((i) => i.key !== key));
    if (selected >= at && selected > 0) setSelected(selected - 1);
  };

  /** Publishes: makes and uploads what is new, then saves the post whole. */
  const publish = async () => {
    if (busy) return;
    if (!items.length && !embed.trim()) return setError("Add a clip first.");
    setBusy(true);
    setError(null);
    try {
      const slides: SlideInput[] = [];
      for (const [n, item] of items.entries()) {
        const label = items.length > 1 ? ` ${n + 1} of ${items.length}` : "";
        const name = (item.file?.name ?? "clip").replace(/\.[^.]+$/, "");
        const s = item.start ?? 0;
        const e = item.end;
        const retrimmed = !item.file && ((item.saved?.start ?? 0) !== s || item.saved?.end !== e);
        let { video, poster, cover, width, height } = item;

        if (item.file) {
          setStatus(`Uploading clip${label}…`);
          video = await upload(item.file, item.file.name);
        }
        if ((item.file || retrimmed) && item.source) {
          setStatus(`Making the cover${label}…`);
          const frame = await captureFrame(item.source, s, e);
          const loop = await captureLoop(item.source, name, s, e);
          setStatus(`Uploading the cover${label}…`);
          if (frame.poster) poster = await upload(frame.poster, `${name}-poster.jpg`);
          if (loop) cover = await upload(loop, loop.name);
          // A clip whose cover could not be recorded plays itself on the grid.
          else if (item.file) cover = undefined;
          if (frame.width) {
            width = frame.width;
            height = frame.height;
          }
        }
        slides.push({ video, poster, cover, width, height, start: s, end: e });
      }

      setStatus("Posting…");
      await saveCinemaPost({ id: post?.id, title, show, caption, embed, slides });
      router.push("/dashboard/cinema");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus(null);
      setBusy(false);
    }
  };

  const destroy = async () => {
    if (!post || !window.confirm(`Delete "${post.title}"? Its clips are deleted too. This can't be undone.`)) return;
    setBusy(true);
    await deletePost(post.id);
    router.push("/dashboard/cinema");
    router.refresh();
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

  return (
    <div className="flex flex-col gap-6" {...drop}>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/webm"
        multiple
        hidden
        onChange={(e) => {
          add([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={`flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-[2px] bg-[#242424] transition-colors ${
            over ? "text-accent outline outline-1 outline-accent" : "text-foreground/50 hover:text-accent"
          }`}
        >
          <Icon name="material-symbols:upload-rounded" size="1.8em" />
          Drop clips here, or choose them
          <span className="text-foreground/30">MP4 or WebM, up to 64 MB each · several make a carousel</span>
        </button>
      ) : (
        <>
          {/* The selected slide, large, looping its trim. */}
          <div
            className={`relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[2px] bg-black ${
              over ? "outline outline-1 outline-accent" : ""
            }`}
          >
            {current?.source ? (
              <video
                key={current.key}
                ref={player}
                src={current.source}
                autoPlay
                muted={muted}
                playsInline
                className="h-full w-full object-contain"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  update(current.key, {
                    duration: v.duration,
                    width: current.width ?? v.videoWidth,
                    height: current.height ?? v.videoHeight,
                  });
                  v.currentTime = current.start ?? 0;
                }}
                onEnded={(e) => {
                  e.currentTarget.currentTime = current.start ?? 0;
                  e.currentTarget.play().catch(() => {});
                }}
                onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
              />
            ) : current?.loopOnly ? (
              isVideo(current.loopOnly) ? (
                <video src={current.loopOnly} autoPlay muted loop playsInline className="h-full w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.loopOnly} alt="" className="h-full w-full object-contain" />
              )
            ) : null}
            {current?.source && (
              <button
                type="button"
                onClick={() => setMuted(!muted)}
                className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white/80 hover:text-accent"
              >
                {muted ? "Sound off" : "Sound on"}
              </button>
            )}
          </div>

          {canTrim ? (
            <TrimBar duration={current.duration!} start={start} end={end} playhead={playhead} onChange={trim} />
          ) : (
            current?.loopOnly && (
              <p className="text-foreground/40">This slide is a loop without a clip, so it has nothing to trim.</p>
            )
          )}

          <DndContext id="composer-strip" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.key)} strategy={horizontalListSortingStrategy}>
              <ul className="flex gap-2 overflow-x-auto p-1">
                {items.map((item, i) => (
                  <Thumb
                    key={item.key}
                    item={item}
                    index={i}
                    selected={i === Math.min(selected, items.length - 1)}
                    onSelect={() => setSelected(i)}
                    onRemove={() => remove(item.key)}
                  />
                ))}
                <li className="w-36 shrink-0">
                  <button
                    type="button"
                    onClick={() => input.current?.click()}
                    aria-label="Add clips"
                    className="flex aspect-video w-full items-center justify-center rounded-[2px] bg-[#242424] text-foreground/50 transition-colors hover:text-accent"
                  >
                    <Icon name="material-symbols:add-rounded" size="1.6em" />
                  </button>
                </li>
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      <label className="label">
        Movie or show
        <input className="field" placeholder="Beef" value={show} onChange={(e) => setShow(e.target.value)} />
      </label>

      <label className="label">
        Title
        <input
          className="field"
          placeholder="The scene, in a few words — the show's name if left blank"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="label">
        Caption
        <textarea className="field" value={caption} onChange={(e) => setCaption(e.target.value)} />
      </label>

      <label className="label">
        Official link
        <input
          className="field"
          inputMode="url"
          placeholder="Where the scene is officially posted — credited, or played if there is no clip"
          value={embed}
          onChange={(e) => setEmbed(e.target.value)}
        />
      </label>

      {error && <p className="text-[#ff6b6b]">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={publish}>
          {post ? "Save" : "Post"}
        </button>
        {status && <span className="text-foreground/50">{status} Keep this tab open.</span>}

        {post ? (
          <button type="button" className="btn btn-danger ml-auto" disabled={busy} onClick={destroy}>
            Delete
          </button>
        ) : (
          <Link href="/dashboard/cinema" className="btn btn-danger ml-auto">
            Discard
          </Link>
        )}
      </div>
    </div>
  );
}
