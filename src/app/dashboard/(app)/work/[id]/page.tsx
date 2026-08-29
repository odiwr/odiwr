import Link from "next/link";
import { notFound } from "next/navigation";
import StackPicker from "@/components/dashboard/StackPicker";
import TitleSlug from "@/components/dashboard/TitleSlug";
import FilePicker from "@/components/dashboard/FilePicker";
import { getContent, sectionWork, SECTIONS, type Section, type Work } from "@/lib/content";
import { slotAspect } from "@/lib/mosaic";
import { list, fileTree, r2Configured } from "@/lib/r2";
import { saveWork, deleteWork } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * One entry.
 *
 * The section is fixed — you get here from a section's own New link, or from an
 * entry that already belongs to one — so it is a hidden field rather than a
 * dropdown asking you to repeat what the page already knows.
 *
 * Fields follow from that. Only CURRENT work has a page here, so only it can
 * have a slug or a clip; a poster only means anything in the creative mosaic.
 */
export default async function WorkEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const { section } = await searchParams;
  const isNew = id === "new";

  const content = await getContent();
  const entry: Partial<Work> = isNew
    ? { section: (SECTIONS.includes(section as Section) ? section : "projects") as Section }
    : (content.work.find((w) => w.id === id) ?? {});

  if (!isNew && !entry.id) notFound();

  const isCurrent = entry.section === "current";
  const isCreative = entry.section === "creative";
  const tree = (isCurrent || isCreative) && r2Configured() ? fileTree(await list("")) : [];

  /**
   * The shape this entry's poster has to be cut to.
   *
   * The mosaic's cut depends on how many posters there are, so the ratio quoted
   * is for the layout INCLUDING this one — the slot it will occupy once saved,
   * not a slot in the puzzle as it stands today.
   */
  let posterRatio: string | null = null;
  if (isCreative) {
    const creative = sectionWork(content, "creative");
    const slots = creative.filter((w) => w.poster || w.id === entry.id);
    // A new entry has no id yet and no place in the list, so it lands last.
    const index = isNew ? slots.length : slots.findIndex((w) => w.id === entry.id);
    posterRatio = slotAspect(isNew ? slots.length + 1 : slots.length, index);
  }

  return (
    <form action={saveWork} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={entry.id ?? ""} />
      <input type="hidden" name="section" value={entry.section} />

      <TitleSlug title={entry.title ?? ""} slug={entry.slug ?? ""} showSlug={isCurrent} />

      {/* Ten words or so, and the only text projects and creative entries get:
          they are listed, never opened. */}
      <label className="label">
        Blurb
        <textarea name="blurb" className="field blurb" rows={2} defaultValue={entry.blurb ?? ""} />
      </label>

      {isCurrent && (
        <label className="label">
          Description
          <textarea
            name="description"
            className="field min-h-40"
            defaultValue={entry.description ?? ""}
          />
        </label>
      )}

      <label className="label">
        Link
        <input
          name="href"
          className="field"
          inputMode="url"
          placeholder="github.com/…"
          defaultValue={entry.href ?? ""}
        />
      </label>

      <div className="label">
        Stack
        <StackPicker name="stack" initial={entry.stack ?? []} />
      </div>

      {isCreative && (
        <div className="label">
          <span>
            Poster{posterRatio && <span className="text-accent"> ({posterRatio})</span>}
          </span>
          <FilePicker name="poster" tree={tree} initial={entry.poster ?? ""} />
        </div>
      )}

      {isCurrent && (
        <div className="label">
          Media
          <FilePicker name="media" tree={tree} initial={entry.media ?? ""} required />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary">
          Save
        </button>

        {/* Always here. On a new entry there is nothing to delete, so it simply
            abandons the draft — same gesture, same place. */}
        {isNew ? (
          <Link href="/dashboard/work" className="btn btn-danger ml-auto">
            Discard
          </Link>
        ) : (
          <button type="submit" formAction={deleteWork} className="btn btn-danger ml-auto">
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
