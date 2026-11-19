"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { ACCEPT, gate, prepare, refusal, type Step } from "./portfolio-media";
import {
  addPortfolioItem,
  deletePortfolioItem,
  setPortfolioAlt,
  setPortfolioHidden,
} from "@/app/dashboard/(app)/portfolio-actions";

/**
 * Every picture and video on the portfolio, newest first. The site shuffles
 * them on every visit, so there is no order to set here.
 *
 * Drop any number of files on the box (or choose them): each is read, copied
 * and uploaded in the browser (portfolio-media.ts), three at a time, and saved
 * in the order chosen. Nothing has to be cropped or sized first — the site fits
 * every shape as it comes.
 *
 * Over each tile, hide (off the site, kept here) and delete; under it, its alt
 * text, which screen readers read out and nobody sees. Changes are applied
 * here first and saved behind them, as CinemaBoard does.
 */

export type BoardItem = {
  id: string;
  kind: "image" | "video";
  thumb: string;
  loop?: string;
  width: number;
  height: number;
  alt?: string;
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

function Tile({
  item,
  onAlt,
  onHide,
  onDelete,
}: {
  item: BoardItem;
  onAlt: (alt: string) => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  const label = item.alt || (item.kind === "video" ? "Video" : "Picture");

  return (
    <li className="flex flex-col gap-1.5">
      <div className="group relative">
        <div
          className={`relative aspect-square overflow-hidden rounded-[2px] bg-[#111] ${
            item.hidden ? "opacity-40 grayscale" : ""
          }`}
        >
          {item.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <video
              src={`${item.loop}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-contain"
            />
          )}
          {item.kind === "video" && (
            <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex text-white/80 [filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.8))]">
              <Icon name="material-symbols:play-arrow-rounded" size="1.2em" />
            </span>
          )}
        </div>

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
      </div>

      <input
        // Re-keyed by the saved text, so a save from elsewhere shows here.
        key={item.alt ?? ""}
        className="field text-sm"
        placeholder="Alt text"
        title="Read out by screen readers. Never shown on the page."
        aria-label={`Alt text for ${label}`}
        defaultValue={item.alt ?? ""}
        onBlur={(e) => {
          const alt = e.currentTarget.value.trim();
          if (alt !== (item.alt ?? "")) onAlt(alt);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </li>
  );
}

export default function PortfolioBoard({ items: initial }: { items: BoardItem[] }) {
  const [items, setItems] = useState(initial);
  const [pending, setPending] = useState<Pending[]>([]);
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

  const save = (work: () => Promise<unknown>) =>
    startTransition(async () => {
      await work();
      router.refresh();
    });

  const patch = (key: string, change: Partial<Pending>) =>
    setPending((all) => all.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const add = (files: File[]) => {
    if (!files.length) return;
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
    // The newest batch shows first, as it will be in the list.
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
          after = await addPortfolioItem(item, after);
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

  const alt = (item: BoardItem, text: string) => {
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, alt: text || undefined } : i)));
    save(() => setPortfolioAlt(item.id, text));
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
        <ul
          className={`grid grid-cols-2 gap-x-3 gap-y-5 transition-opacity sm:grid-cols-3 md:grid-cols-4 ${
            busy ? "opacity-80" : ""
          }`}
        >
          {items.map((item) => (
            <Tile
              key={item.id}
              item={item}
              onAlt={(text) => alt(item, text)}
              onHide={() => hide(item)}
              onDelete={() => remove(item)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
