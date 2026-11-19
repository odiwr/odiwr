"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons";
import { savePortfolioSettings } from "@/app/dashboard/(app)/portfolio-actions";

/**
 * The portfolio's title, the line under it, its sets, and where its cover is
 * held when cropped.
 *
 * Sets are renamed in place — their pictures go with them — and a set taken off
 * the list leaves its pictures in the grid under All. The cover is chosen on
 * the board (the star); here, a click on it sets the point that stays in view,
 * with how that crops on a wide screen and on a phone beside it.
 */

type Row = { name: string; /** The saved name, for a rename. */ was?: string };

export default function PortfolioSettings({
  title: savedTitle,
  subtitle: savedSubtitle,
  sets: savedSets,
  focus: savedFocus,
  cover,
}: {
  title: string;
  subtitle?: string;
  sets: string[];
  focus: { x: number; y: number };
  /** The cover's grid copy, to aim. */
  cover?: { src: string; width: number; height: number };
}) {
  const initial = () => ({
    title: savedTitle,
    subtitle: savedSubtitle ?? "",
    rows: savedSets.map((name) => ({ name, was: name })) as Row[],
    focus: savedFocus,
  });
  const [form, setForm] = useState(initial);
  const [fresh, setFresh] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  // Follow the server's copy when it changes (a new cover resets the focus).
  const signature = JSON.stringify([savedTitle, savedSubtitle, savedSets, savedFocus, cover?.src]);
  const [seen, setSeen] = useState(signature);
  if (signature !== seen) {
    setSeen(signature);
    setForm(initial());
  }

  const rows = form.rows;
  const setRows = (next: Row[]) => setForm((f) => ({ ...f, rows: next }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial());

  const addSet = () => {
    const name = fresh.trim();
    if (!name || rows.some((r) => r.name.toLowerCase() === name.toLowerCase())) return;
    setRows([...rows, { name }]);
    setFresh("");
  };

  const move = (i: number) => {
    if (i <= 0) return;
    const next = [...rows];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setRows(next);
  };

  const submit = () =>
    startTransition(async () => {
      try {
        const kept = rows.filter((r) => r.name.trim());
        await savePortfolioSettings({
          title: form.title,
          subtitle: form.subtitle,
          sets: kept.map((r) => r.name.trim()),
          renames: Object.fromEntries(
            kept.filter((r) => r.was && r.was !== r.name.trim()).map((r) => [r.was!, r.name.trim()])
          ),
          focus: form.focus,
        });
        setNote("Saved");
        router.refresh();
      } catch (error) {
        setNote(error instanceof Error ? error.message : "Could not save");
      }
    });

  const aim = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - box.left) / box.width) * 100);
    const y = Math.round(((e.clientY - box.top) / box.height) * 100);
    setForm((f) => ({ ...f, focus: { x, y } }));
  };

  const position = `${form.focus.x}% ${form.focus.y}%`;

  return (
    <section className="flex flex-col gap-5 rounded-[2px] bg-[#202020] p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label">
          Title
          <input
            className="field"
            value={form.title}
            placeholder="Portfolio"
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label className="label">
          Under it
          <input
            className="field"
            value={form.subtitle}
            placeholder="Bill Odiwuor Kawaka"
            onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-foreground/40">Sets</span>
        {rows.map((row, i) => (
          <div key={row.was ?? `new-${i}`} className="flex items-center gap-2">
            <input
              className="field"
              value={row.name}
              aria-label={`Set ${i + 1}`}
              onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
            />
            <button
              type="button"
              className="btn flex px-2.5 disabled:opacity-30"
              onClick={() => move(i)}
              disabled={i === 0}
              aria-label={`Move ${row.name} earlier`}
              title="Earlier"
            >
              <Icon name="material-symbols:arrow-upward-rounded" />
            </button>
            <button
              type="button"
              className="btn btn-danger flex px-2.5"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              aria-label={`Remove ${row.name}`}
              title="Remove: its pictures stay, under All"
            >
              <Icon name="material-symbols:close-rounded" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            className="field"
            value={fresh}
            placeholder={rows.length ? "Another set" : "Film, Portraits, Motion, …"}
            aria-label="New set name"
            onChange={(e) => setFresh(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSet();
              }
            }}
          />
          <button type="button" className="btn flex shrink-0 items-center gap-1" onClick={addSet}>
            <Icon name="material-symbols:add-rounded" />
            Add
          </button>
        </div>
      </div>

      {cover && (
        <div className="flex flex-col gap-2">
          <span className="text-foreground/40">Cover · click the part to keep in view</span>
          <div className="flex flex-wrap items-start gap-3">
            <div
              className="relative max-w-full cursor-crosshair overflow-hidden rounded-[2px] bg-black"
              style={{ aspectRatio: `${cover.width} / ${cover.height}`, height: 180 }}
              onClick={aim}
              role="presentation"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover.src} alt="" className="pointer-events-none h-full w-full object-contain" />
              <span
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"
                style={{ left: `${form.focus.x}%`, top: `${form.focus.y}%` }}
              />
            </div>
            {/* How it crops: a wide screen and a phone. */}
            <div className="overflow-hidden rounded-[2px] bg-black" style={{ aspectRatio: "16 / 9", height: 180 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover.src} alt="" className="h-full w-full object-cover" style={{ objectPosition: position }} />
            </div>
            <div className="overflow-hidden rounded-[2px] bg-black" style={{ aspectRatio: "9 / 19.5", height: 180 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover.src} alt="" className="h-full w-full object-cover" style={{ objectPosition: position }} />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={submit}>
          {busy ? "Saving…" : "Save"}
        </button>
        {note && !dirty && <span className="text-foreground/40">{note}</span>}
      </div>
    </section>
  );
}
