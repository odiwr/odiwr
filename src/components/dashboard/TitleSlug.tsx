"use client";

import { useState } from "react";
import { slugify } from "@/lib/content";

/**
 * Title and slug together, because the slug follows the title until you say
 * otherwise.
 *
 * Typing in the slug marks it as yours and stops the syncing; clearing it hands
 * control back. An existing entry never re-syncs, or renaming something would
 * silently move its URL and break every link to it.
 */
export default function TitleSlug({
  title: initialTitle,
  slug: initialSlug,
  showSlug,
}: {
  title: string;
  slug: string;
  showSlug: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [locked, setLocked] = useState(Boolean(initialSlug));

  return (
    <>
      <label className="label">
        Title
        <input
          name="title"
          className="field"
          required
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (!locked) setSlug(slugify(event.target.value));
          }}
        />
      </label>

      {showSlug && (
        <label className="label">
          Slug
          <input
            name="slug"
            className="field"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              setLocked(event.target.value.length > 0);
            }}
          />
        </label>
      )}
    </>
  );
}
