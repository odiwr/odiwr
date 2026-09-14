"use client";

import { useState } from "react";
import Select from "./Select";

const NEW = "__new__";

/**
 * Pick a category, or make one.
 *
 * The last option in the dropdown is "New category…", which swaps in a text
 * field for the name. With no categories yet there is nothing to pick, so it
 * starts there.
 */
export default function CategoryPicker({
  categories,
  initial,
}: {
  categories: string[];
  initial: string;
}) {
  const [choice, setChoice] = useState(
    categories.includes(initial) ? initial : categories.length ? categories[0] : NEW
  );
  const creating = choice === NEW;

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select
        name="category"
        label="Category"
        className="sm:w-64 sm:shrink-0"
        value={choice}
        onChange={setChoice}
        options={[
          ...categories.map((category) => ({ value: category, label: category })),
          { value: NEW, label: "New category…", muted: true },
        ]}
      />

      {creating && (
        <input
          name="newCategory"
          className="field"
          placeholder="Tech, Clothes, …"
          aria-label="New category name"
          required
          // Only when it has just been chosen, not on a first visit with no
          // categories, where the link field should get the cursor.
          autoFocus={categories.length > 0}
          defaultValue={categories.includes(initial) ? "" : initial}
        />
      )}
    </div>
  );
}
