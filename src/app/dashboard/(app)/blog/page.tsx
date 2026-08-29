import Icon from "@/components/icons";
import DateField from "@/components/dashboard/DateField";
import RichTextArea from "@/components/dashboard/RichTextArea";
import { getContent, displayDate } from "@/lib/content";
import { savePost, archivePost, deleteArchived } from "../actions";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const content = await getContent();
  const post = content.post;

  return (
    <div className="flex flex-col gap-10">
      <form action={savePost} className="flex flex-col gap-5">
        <div className="label">
          Date
          <DateField name="date" value={post?.date ?? new Date().toISOString().slice(0, 10)} />
        </div>

        <div className="label">
          Body
          <RichTextArea name="body" defaultValue={(post?.paragraphs ?? []).join("\n\n")} />
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn w-max">
            Save
          </button>
          {post && (
            <button type="submit" formAction={archivePost} className="btn w-max">
              Archive
            </button>
          )}
        </div>
      </form>

      {content.archive.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground/40">Archive</h2>
          {content.archive.map((entry) => (
            <div key={entry.id} className="row">
              <span className="truncate text-foreground/70">{entry.paragraphs[0]}</span>
              <span className="flex shrink-0 items-center gap-4 text-foreground/40">
                {displayDate(entry.date)}
                <form action={deleteArchived}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button
                    type="submit"
                    className="flex transition-colors hover:text-accent"
                    aria-label="Delete"
                  >
                    <Icon name="material-symbols:close-rounded" size="1.35em" />
                  </button>
                </form>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
