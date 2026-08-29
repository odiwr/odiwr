"use client";

import { useState } from "react";
import Icon from "@/components/icons";

/**
 * Pick a file out of the bucket, browsing it as a directory.
 *
 * The same tree as the media library's folder picker, except folders open to
 * reveal their files and choosing one writes its public URL. Typing a URL by
 * hand still works, for anything not in the bucket.
 */

export type PickerFile = { key: string; name: string; url: string };
export type PickerNode = { name: string; path: string; children: PickerNode[]; files: PickerFile[] };

function Branch({
  node,
  depth,
  onPick,
}: {
  node: PickerNode;
  depth: number;
  onPick: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 py-0.5 text-left text-foreground/70 transition-colors hover:text-accent"
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        <Icon
          name="material-symbols:chevron-right-rounded"
          size="1.2em"
          className={`text-foreground/30 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
        <Icon
          name={open ? "material-symbols:folder-open-rounded" : "material-symbols:folder-rounded"}
          size="1.1em"
        />
        {node.name}
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <ul className="min-h-0 overflow-hidden">
          {node.children.map((child) => (
            <Branch key={child.path} node={child} depth={depth + 1} onPick={onPick} />
          ))}
          {node.files.map((file) => (
            <li key={file.key}>
              <button
                type="button"
                onClick={() => onPick(file.url)}
                className="block w-full truncate py-0.5 text-left text-foreground/50 transition-colors hover:text-accent"
                style={{ paddingLeft: `${(depth + 1) * 14 + 20}px` }}
              >
                {file.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export default function FilePicker({
  name,
  tree,
  initial,
  required,
}: {
  name: string;
  tree: PickerNode[];
  initial: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Browse files"
          className="btn flex shrink-0 items-center px-3"
        >
          <Icon
            name={open ? "material-symbols:folder-open-rounded" : "material-symbols:folder-rounded"}
            size="1.25em"
          />
        </button>
        <input
          name={name}
          className="field"
          required={required}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="max-h-64 overflow-y-auto py-1">
            {tree.map((node) => (
              <Branch
                key={node.path}
                node={node}
                depth={0}
                onPick={(url) => {
                  setValue(url);
                  setOpen(false);
                }}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
