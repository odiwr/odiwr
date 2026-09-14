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
 * - The eyedropper uses the browser's own EyeDropper where there is one
 *   (Chrome, Edge): the cursor becomes a loupe that previews the colour under
 *   it anywhere on the screen, and a click picks it.
 *
 * Firefox, and forks of it such as Waterfox, have no EyeDropper, and no page can
 * read colours off the screen there. For those the parent can pass
 * `onEyedrop`, a picker of its own (the wishlist editor picks from the product
 * image); without one, the button opens the colour picker instead. Either way
 * the button is always there.
 */

type EyeDropperResult = { sRGBHex: string };
type EyeDropperConstructor = new () => { open: () => Promise<EyeDropperResult> };

const noSubscribe = () => () => {};

export default function ColorField({
  value,
  onChange,
  onEyedrop,
  eyedropping = false,
  eyedropLabel = "Pick a colour",
  placeholder = "auto",
}: {
  /** "#rrggbb", or "" for none. */
  value: string;
  onChange: (hex: string) => void;
  /** The eyedropper to use where the browser has none of its own. */
  onEyedrop?: () => void;
  /** Whether that eyedropper is currently picking, to light the button. */
  eyedropping?: boolean;
  /** What that eyedropper does, for its tooltip. */
  eyedropLabel?: string;
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

  // Known only in the browser; false while rendering on the server, and
  // settled after hydration without a mismatch.
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
    if (!Dropper) {
      setOpen(false);
      if (onEyedrop) onEyedrop();
      else setOpen(true);
      return;
    }
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

  const tooltip = canEyedrop
    ? "Eyedropper"
    : onEyedrop
      ? eyedropLabel
      : "This browser has no eyedropper. Opens the colour picker instead.";

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

      {/* Always here. shrink-0 so a narrow column squeezes the hex box, never
          this. */}
      <button
        type="button"
        onClick={eyedrop}
        aria-label={tooltip}
        aria-pressed={picking || eyedropping}
        title={tooltip}
        className={`ml-auto flex shrink-0 transition-colors hover:text-accent ${
          picking || eyedropping ? "text-accent" : "text-foreground/50"
        }`}
      >
        <Icon name="material-symbols:colorize-outline-rounded" size="1.15em" />
      </button>

      {open && (
        <div className="color-popover select-list absolute top-full right-0 z-20 mt-2 rounded-[2px] bg-[#242424] p-2 shadow-lg shadow-black/40">
          <HexColorPicker color={value || "#242424"} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
