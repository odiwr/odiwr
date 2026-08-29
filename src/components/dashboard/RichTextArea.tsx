"use client";

import { useRef, useState } from "react";

/**
 * The blog body, with a formatting bar that appears while text is selected.
 *
 * The bar sits above the field rather than floating over the caret: a textarea
 * gives no geometry for its selection, and the mirror-element trick needed to
 * fake it is a lot of machinery to place a strip of five buttons.
 *
 * Every button wraps the selection in the same markers you could type by hand,
 * so nothing here is required to write a post.
 */

const TOOLS = [
  { label: "B", title: "Bold", wrap: "**", className: "font-medium" },
  { label: "I", title: "Italic", wrap: "*", className: "italic" },
  { label: "U", title: "Underline", wrap: "_", className: "underline underline-offset-2" },
  { label: "C", title: "Cursive", wrap: "~", className: "font-cursive" },
];

export default function RichTextArea({ name, defaultValue }: { name: string; defaultValue: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [selected, setSelected] = useState(false);

  const check = () => {
    const el = ref.current;
    setSelected(Boolean(el && el.selectionEnd > el.selectionStart));
  };

  /** Wraps the selection, then re-selects the text inside the markers. */
  const apply = (before: string, after: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const chosen = value.slice(start, end);

    el.value = value.slice(0, start) + before + chosen + after + value.slice(end);
    el.focus();
    el.setSelectionRange(start + before.length, start + before.length + chosen.length);
    // A programmatic value change does not fire input, and the form reads the
    // DOM value directly, but this keeps anything listening in step.
    el.dispatchEvent(new Event("input", { bubbles: true }));
    check();
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex items-center gap-1 transition-opacity duration-150 ${
          selected ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {TOOLS.map((tool) => (
          <button
            key={tool.title}
            type="button"
            title={tool.title}
            aria-label={tool.title}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => apply(tool.wrap, tool.wrap)}
            className={`h-7 w-7 rounded-[2px] bg-[#242424] transition-colors hover:text-accent ${tool.className}`}
          >
            {tool.label}
          </button>
        ))}
        <button
          type="button"
          title="Link"
          aria-label="Link"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply("[", "](https://)")}
          className="h-7 rounded-[2px] bg-[#242424] px-2 transition-colors hover:text-accent"
        >
          Link
        </button>
      </div>

      <textarea
        ref={ref}
        name={name}
        defaultValue={defaultValue}
        className="field"
        onSelect={check}
        onKeyUp={check}
        onMouseUp={check}
        onBlur={() => setSelected(false)}
      />
    </div>
  );
}
