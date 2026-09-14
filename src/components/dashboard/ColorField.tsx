"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HexColorPicker } from "react-colorful";
import Icon from "@/components/icons";
import { normalizeHex } from "@/lib/wish";

/**
 * A colour: swatch, hex, eyedropper.
 *
 * - The swatch opens a picker (react-colorful) in the dashboard's popup style.
 * - The hex can be typed; it applies as soon as it is six digits, and clearing
 *   it hands the colour back to whatever is automatic (`onChange("")`).
 * - The eyedropper is the browser's own EyeDropper: the cursor becomes a loupe
 *   that previews the colour under it anywhere on the screen, and a click
 *   picks it. That native tool is the only way a page may read colours off
 *   the screen, so it is also why the value updates on the click rather than
 *   continuously while hovering. Browsers without it (Firefox and Safari, as
 *   of writing) do not show the button.
 */

type EyeDropperResult = { sRGBHex: string };
type EyeDropperConstructor = new () => { open: () => Promise<EyeDropperResult> };

const noSubscribe = () => () => {};

export default function ColorField({
  value,
  onChange,
  placeholder = "auto",
}: {
  /** "#rrggbb", or "" for none. */
  value: string;
  onChange: (hex: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // What is in the text box. Follows the value unless the box is mid-edit.
  const [draft, setDraft] = useState(value.replace("#", ""));
  const [editing, setEditing] = useState(false);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (!editing) setDraft(value.replace("#", ""));
  }

  // Known only in the browser; false while rendering on the server, so the
  // button appears after hydration instead of causing a mismatch.
  const canEyedrop = useSyncExternalStore(
    noSubscribe,
    () => "EyeDropper" in window,
    () => false
  );

  // Dismiss the picker on Escape or a click outside it.
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

  const eyedrop = async () => {
    const Dropper = (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;
    if (!Dropper) return;
    setOpen(false);
    setPicking(true);
    try {
      const { sRGBHex } = await new Dropper().open();
      const hex = normalizeHex(sRGBHex);
      if (hex) onChange(hex);
    } catch {
      // Escape, or a click the browser did not count. Nothing changes.
    } finally {
      setPicking(false);
    }
  };

  return (
    <div ref={root} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Choose a colour"
        aria-expanded={open}
        className="color-swatch"
        data-empty={value ? undefined : ""}
        style={value ? { backgroundColor: value } : undefined}
      />

      <span className="text-foreground/40" aria-hidden="true">
        #
      </span>
      <input
        value={draft}
        placeholder={placeholder}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        aria-label="Hex colour"
        className="color-hex"
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          setDraft(value.replace("#", ""));
        }}
        onChange={(event) => {
          const next = event.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 6);
          setDraft(next);
          if (!next) onChange("");
          else if (next.length === 6) onChange(`#${next.toLowerCase()}`);
        }}
        onKeyDown={(event) => {
          // Enter here would submit the whole form.
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />

      {canEyedrop && (
        <button
          type="button"
          onClick={eyedrop}
          aria-label="Pick a colour from the screen"
          title="Eyedropper"
          className={`ml-auto flex transition-colors hover:text-accent ${
            picking ? "text-accent" : "text-foreground/50"
          }`}
        >
          <Icon name="material-symbols:colorize-outline-rounded" size="1.15em" />
        </button>
      )}

      {open && (
        <div className="color-popover select-list absolute top-full right-0 z-20 mt-2 rounded-[2px] bg-[#242424] p-2 shadow-lg shadow-black/40">
          <HexColorPicker color={value || "#242424"} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
