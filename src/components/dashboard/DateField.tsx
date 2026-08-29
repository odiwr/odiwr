"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/icons";

/**
 * A month grid, in place of the browser's date control.
 *
 * The native one is drawn by the operating system and takes none of the page's
 * colours, so on a dark page it arrives as a white box. This is the same value
 * — an ISO date in a hidden field — with a calendar we can style.
 */

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Monday-first offset for the 1st of the month. */
function leadingBlanks(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export default function DateField({ name, value: initial }: { name: string; value: string }) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  /**
   * Dismiss on Escape or a click outside.
   *
   * A popup that only closes by clicking the button that opened it traps
   * anything underneath it, which is how this got noticed.
   */
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const [y, m] = value.split("-").map(Number);
  const [view, setView] = useState({ year: y || 2026, month: (m || 1) - 1 });

  const days = new Date(view.year, view.month + 1, 0).getDate();
  const blanks = leadingBlanks(view.year, view.month);

  const shift = (delta: number) => {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };

  return (
    <div className="relative w-max" ref={root}>
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="field flex w-max items-center gap-3"
      >
        {value || "Pick a date"}
        <Icon name="material-symbols:calendar-month-rounded" size="1.15em" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-10 mt-1 w-64 rounded-[2px] bg-[#242424] p-3 shadow-lg shadow-black/40">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label="Previous month"
              className="flex text-foreground/50 transition-colors hover:text-accent"
            >
              <Icon name="material-symbols:chevron-right-rounded" size="1.2em" className="rotate-180" />
            </button>
            <span>
              {MONTHS[view.month]} {view.year}
            </span>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label="Next month"
              className="flex text-foreground/50 transition-colors hover:text-accent"
            >
              <Icon name="material-symbols:chevron-right-rounded" size="1.2em" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {DAYS.map((day, i) => (
              <span key={i} className="text-foreground/30">
                {day}
              </span>
            ))}

            {Array.from({ length: blanks }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}

            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const date = iso(view.year, view.month, day);
              const chosen = date === value;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setValue(date);
                    setOpen(false);
                  }}
                  className={`rounded-[2px] py-0.5 transition-colors ${
                    chosen ? "bg-accent text-background" : "hover:text-accent"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
