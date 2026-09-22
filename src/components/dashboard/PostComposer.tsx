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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Icon from "@/components/icons";
import { captureFrame, captureLoop } from "./capture";
import { cutToTrim } from "./cut";
import { deletePost, saveCinemaPost, type SlideInput } from "@/app/dashboard/(app)/actions";

/**
 * Making a post, or changing one: the same screen either way.
 *
 * Clips go in a strip of slides — drag to reorder, × to take one out, + for
 * more; past five they wrap onto the next row. The one selected plays large
 * above it, looping just its trim, with the trim bar under it: drag either end,
 * or click and drag along the line to scrub. Holding the end handle loops the
 * last moments before it, so the cut can be seen and heard. Trims never cut
 * the file; the site plays the trimmed part, so a post can be re-trimmed any
 * time.
 *
 * The post's name is the movie or show; nothing else is asked for.
 *
 * Posting publishes at once. Before that, for every clip that is new or whose
 * trim changed, the browser cuts a still and records the cover loop from the
 * trimmed part (capture.ts), and uploads what is new. Then the whole post is
 * saved in one go (saveCinemaPost), so it never exists half made. Recording is
 * real time and needs the tab in front: a few seconds a clip.
 */

/** Shortest trim allowed, in seconds. */
const MIN_LENGTH = 0.3;
/** While the end handle is held, the preview loops this much before it. */
const TAIL = 1.5;

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

/**
 * Uploads one file and answers with its address.
 *
 * Straight to the bucket, through a one-time address the server signs (so no
 * host's request limit applies to a big clip); or, on a dev server with no
 * bucket, to the server itself (api/cinema).
 */
async function upload(file: File | Blob, name: string): Promise<string> {
  const type = file.type.split(";")[0];
  const ask = await fetch("/dashboard/api/cinema", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, type, size: file.size }),
  });
  const plan = (await ask.json().catch(() => ({}))) as {
    upload?: string | null;
    url?: string;
    contentType?: string;
    error?: string;
  };
  if (!ask.ok) throw new Error(plan.error ?? `Upload refused (${ask.status})`);

  if (plan.upload && plan.url) {
    const put = await fetch(plan.upload, {
      method: "PUT",
      headers: { "content-type": plan.contentType ?? type },
      body: file,
    }).catch(() => null);
    // A network error here is nearly always the bucket's CORS: it has to allow
    // PUT from this site for the browser to send the file.
    if (!put) throw new Error("Storage refused the upload — check the bucket allows PUT from this site (CORS)");
    if (!put.ok) throw new Error(`Storage refused the upload (${put.status})`);
    return plan.url;
  }

  const body = new FormData();
  body.set("file", file instanceof File ? file : new File([file], name, { type }));
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
  onSeek,
  onHold,
}: {
  duration: number;
  start: number;
  end: number;
  playhead: number;
  /** `edge` is the end being dragged, so the preview can show that part. */
  onChange: (start: number, end: number, edge: "start" | "end") => void;
  /** Clicked or dragged along the line: play from there. */
  onSeek: (t: number) => void;
  /** A handle pressed, or let go (null). */
  onHold: (edge: "start" | "end" | null) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const pct = (t: number) => `${(t / duration) * 100}%`;

  /** The time under the pointer, to the tenth. */
  const at = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.round(Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * duration * 10) / 10;
  };

  /** Follows the pointer from press to release, wherever it goes. */
  const follow = (e: React.PointerEvent<HTMLElement>, move: (t: number) => void, done?: () => void) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => move(at(ev.clientX));
    const up = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      done?.();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const drag = (edge: "start" | "end", e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onHold(edge);
    follow(
      e,
      (t) => {
        if (edge === "start") onChange(Math.min(t, end - MIN_LENGTH), end, "start");
        else onChange(start, Math.max(t, start + MIN_LENGTH), "end");
      },
      () => onHold(null)
    );
  };

  // Anywhere else on the line scrubs: within the trim, since only that plays.
  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const seek = (t: number) => onSeek(Math.min(Math.max(t, start), end - 0.05));
    seek(at(e.clientX));
    follow(e, seek);
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
    "absolute top-0 bottom-0 w-3 -translate-x-1/2 cursor-ew-resize rounded-[2px] bg-accent outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={track}
        onPointerDown={scrub}
        className="relative h-10 cursor-pointer touch-none rounded-[2px] bg-[#242424]"
      >
        {/* What plays, framed; what does not, dimmed either side. */}
        <div className="absolute inset-y-0 left-0 bg-black/50" style={{ width: pct(start) }} />
        <div className="absolute inset-y-0 right-0 bg-black/50" style={{ left: pct(end) }} />
        <div
          className="absolute inset-y-0 border-y-2 border-accent"
          style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white"
          style={{ left: pct(playhead) }}
        />
        <button
          type="button"
          aria-label="Trim start"
          className={handle}
          style={{ left: pct(start) }}
          onPointerDown={(e) => drag("start", e)}
          onKeyDown={key("start")}
        />
        <button
          type="button"
          aria-label="Trim end"
          className={handle}
          style={{ left: pct(end) }}
          onPointerDown={(e) => drag("end", e)}
          onKeyDown={key("end")}
        />
      </div>
      <div className="flex justify-between text-sm text-foreground/50 tabular-nums">
        <span>{fmt(start)}</span>
        <span className="text-accent">{fmt(end - start)} long</span>
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
      className={`relative ${isDragging ? "z-10" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        aria-label={`Slide ${index + 1}`}
        aria-pressed={selected}
        className={`relative block aspect-video w-full cursor-grab overflow-hidden rounded-[2px] bg-black active:cursor-grabbing ${
          selected ? "outline-2 outline-offset-2 outline-accent" : "opacity-70 hover:opacity-100"
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
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playhead, setPlayhead] = useState(0);

  const input = useRef<HTMLInputElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  // Which trim handle is held, if any: the end one loops the last moments.
  const holding = useRef<"start" | "end" | null>(null);
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

  // The selected clip loops its trim: back to the start whenever it passes the
  // end — or, while the end handle is held, back to just before the end.
  useEffect(() => {
    const video = player.current;
    if (!video || !current?.source) return;
    let frame = 0;
    const watch = () => {
      const stop = current.end ?? video.duration;
      const from =
        holding.current === "end" ? Math.max(current.start ?? 0, stop - TAIL) : (current.start ?? 0);
      if (stop && video.currentTime >= stop) video.currentTime = from;
      setPlayhead(video.currentTime);
      frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
    return () => cancelAnimationFrame(frame);
  }, [current?.key, current?.source, current?.start, current?.end]);

  const trim = (s: number, e: number, edge: "start" | "end") => {
    if (!current) return;
    update(current.key, { start: s, end: e });
    // Play from the edge being moved: the start from itself, the end from the
    // last moments before it (and round again, for as long as it is held).
    const video = player.current;
    if (video) {
      video.currentTime = edge === "start" ? s : Math.max(s, e - TAIL);
      video.play().catch(() => {});
    }
  };

  const seek = (t: number) => {
    const video = player.current;
    if (!video) return;
    video.currentTime = t;
    video.play().catch(() => {});
  };

  const hold = (edge: "start" | "end" | null) => {
    const released = holding.current;
    holding.current = edge;
    // Letting go of the end: back to playing the whole trim from its start.
    if (!edge && released === "end" && player.current) player.current.currentTime = start;
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
    if (!items.length && !post?.embed) return setError("Add a clip first.");
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

        // The trim as saved: in the uploaded file's own time, which is the
        // original's unless the file was cut down to it below.
        let savedStart = s;
        let savedEnd = e;

        if (item.file) {
          // Only the trimmed part (and a little either side) goes up, when that
          // is much less than the whole file.
          const cut =
            item.duration && (s > 0 || e !== undefined)
              ? await cutToTrim(item.file, s, e ?? item.duration, item.duration, (t) =>
                  setStatus(`${t.replace(/…$/, "")}${label}…`)
                )
              : null;
          if (cut) {
            savedStart = cut.start;
            savedEnd = cut.end;
          }
          setStatus(`Uploading clip${label}…`);
          video = await upload(cut?.file ?? item.file, item.file.name);
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
        slides.push({ video, poster, cover, width, height, start: savedStart, end: savedEnd });
      }

      setStatus("Posting…");
      // The name is the show's. A post made before that keeps its own title,
      // caption and link (no longer asked for here) as they were.
      await saveCinemaPost({
        id: post?.id,
        title: show.trim() || post?.title || "",
        show,
        caption: post?.caption,
        embed: post?.embed,
        slides,
      });
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
            <TrimBar
              duration={current.duration!}
              start={start}
              end={end}
              playhead={playhead}
              onChange={trim}
              onSeek={seek}
              onHold={hold}
            />
          ) : (
            current?.loopOnly && (
              <p className="text-foreground/40">This slide is a loop without a clip, so it has nothing to trim.</p>
            )
          )}

          <DndContext id="composer-strip" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.key)} strategy={rectSortingStrategy}>
              {/* Five to a row, sized to fill it exactly; more wrap onto the next. */}
              <ul className="grid grid-cols-3 gap-2 p-1 sm:grid-cols-5">
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
                <li>
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
