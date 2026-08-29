"use client";

import { useState } from "react";
import Icon from "@/components/icons";
import type { FolderNode } from "@/lib/r2";

/**
 * Choose where an upload lands.
 *
 * A button that opens the bucket's folder tree, beside a field holding the
 * chosen path. The path stays editable by hand, because a new folder is just a
 * prefix that does not exist yet — there is nothing to create first.
 *
 * Folders open and close on the usual convention: a closed folder icon and a
 * collapsed row, an open one when expanded.
 */
function Branch({
  node,
  depth,
  onPick,
}: {
  node: FolderNode;
  depth: number;
  onPick: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 14}px` }}>
        <button
          type="button"
          onClick={() => hasChildren && setOpen(!open)}
          aria-label={hasChildren ? (open ? "Collapse" : "Expand") : undefined}
          className={`flex text-foreground/30 ${hasChildren ? "hover:text-accent" : "invisible"}`}
        >
          <Icon
            name="material-symbols:chevron-right-rounded"
            size="1.2em"
            className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
        </button>

        <button
          type="button"
          onClick={() => onPick(node.path)}
          className="flex items-center gap-2 py-0.5 text-foreground/70 transition-colors hover:text-accent"
        >
          <Icon
            name={
              open ? "material-symbols:folder-open-rounded" : "material-symbols:folder-rounded"
            }
            size="1.1em"
          />
          {node.name}
        </button>
      </div>

      {hasChildren && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <ul className="min-h-0 overflow-hidden">
            {node.children.map((child) => (
              <Branch key={child.path} node={child} depth={depth + 1} onPick={onPick} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export default function FolderPicker({
  name,
  tree,
  initial,
}: {
  name: string;
  tree: FolderNode[];
  initial: string;
}) {
  const [path, setPath] = useState(initial);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Browse folders"
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
          value={path}
          onChange={(event) => setPath(event.target.value)}
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
                onPick={(picked) => {
                  setPath(picked);
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
