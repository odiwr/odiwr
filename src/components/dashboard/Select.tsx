"use client";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/icons";

/**
 * A dropdown, in place of the browser's <select>.
 *
 * The native list is drawn by the operating system: white on most of them,
 * whatever the page looks like. This is the same thing in the dashboard's
 * material — the field, and a list below it in the popup style DateField and
 * StackPicker already use — with the value in a hidden input so forms read it
 * exactly as they read a select.
 *
 * Keyboard works the way a select does: arrows move (and open it), Enter or
 * Space picks, Escape closes, Tab leaves. Focus stays on the button throughout,
 * and the highlighted option is announced through aria-activedescendant.
 */

export type SelectOption = {
  value: string;
  label: string;
  /** Dimmed, for an entry that is an action rather than a value ("New…"). */
  muted?: boolean;
};

export default function Select({
  name,
  options,
  value,
  onChange,
  label,
  className,
}: {
  name: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name, when there is no visible <label> tying it to the button. */
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const selected = options[selectedIndex];

  // Dismiss on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) return show();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((a) => (a + step + options.length) % options.length);
        return;
      }
      case "Home":
      case "End":
        if (!open) return;
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : options.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(active);
        else show();
        return;
      case "Escape":
        if (!open) return;
        event.preventDefault();
        setOpen(false);
        return;
      case "Tab":
        setOpen(false);
        return;
    }
  };

  return (
    <div ref={root} className={`relative ${className ?? ""}`}>
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className="field flex items-center justify-between gap-3 text-left"
      >
        <span className={`truncate ${selected?.muted ? "text-foreground/50" : ""}`}>
          {selected?.label}
        </span>
        <Icon
          name="material-symbols:chevron-right-rounded"
          size="1.2em"
          className={`shrink-0 text-foreground/50 transition-transform duration-150 ${
            open ? "-rotate-90" : "rotate-90"
          }`}
        />
      </button>

      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="select-list absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-[2px] bg-[#242424] py-1 shadow-lg shadow-black/40"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={isSelected}
                // Keeps focus on the button, where the keyboard handling is.
                onPointerDown={(event) => event.preventDefault()}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
                style={{ cursor: "var(--cur-pointer), pointer" }}
                className={`flex items-center justify-between gap-3 px-3 py-1.5 transition-colors ${
                  index === active
                    ? "text-accent"
                    : option.muted
                      ? "text-foreground/50"
                      : ""
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Icon name="material-symbols:check-rounded" size="1.1em" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
