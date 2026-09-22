import Link from "next/link";
import { notFound } from "next/navigation";
import Checkbox from "@/components/dashboard/Checkbox";
import ClipUploader from "@/components/dashboard/ClipUploader";
import DateField from "@/components/dashboard/DateField";
import FilePicker from "@/components/dashboard/FilePicker";
import { getContent, type Clip } from "@/lib/content";
import { clipHref, clipThumb } from "@/lib/cinema";
import { fileTree, list, r2Configured } from "@/lib/r2";
import { deleteClip, removeSlide, saveClip } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * One post.
 *
 * Uploads arrive titled after their file; this is where they get a real title,
 * the show, and the caption. "new" makes a post from a link to embed, with no
 * upload.
 *
 * The fields below are the post's first slide. Its other slides are listed
 * under them, each removable on its own, with a drop zone to add more; both
 * act at once rather than waiting for Save.
 */
export default async function ClipEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";

  const content = await getContent();
  const clip: Partial<Clip> = isNew ? {} : (content.clips.find((c) => c.id === id) ?? {});
  if (!isNew && !clip.id) notFound();

  const tree = r2Configured() ? fileTree(await list("cinema/").catch(() => [])) : [];
  const thumb = clipThumb({ poster: clip.poster, embed: clip.embed });

  return (
    <form action={saveClip} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={clip.id ?? ""} />

      {(clip.video || thumb) && (
        <div className="flex items-start gap-4">
          {clip.video ? (
            <video
              src={clip.video}
              poster={clip.poster}
              controls
              playsInline
              preload="metadata"
              className="max-h-80 w-auto max-w-full rounded-[2px] bg-black"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="max-h-80 w-auto rounded-[2px]" />
          )}
          {clip.slug && !clip.hidden && (
            <a
              href={clipHref(clip.slug)}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground/50 transition-colors hover:text-accent"
            >
              View post
            </a>
          )}
        </div>
      )}

      {!isNew && (
        <div className="label">
          Slides
          <p className="text-foreground/30">
            The first slide is the one above. Changes here happen straight away.
          </p>
          {clip.slides?.length ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {clip.slides.map((slide, i) => (
                <li key={i} className="flex flex-col gap-1">
                  <div className="relative aspect-[2.39/1] overflow-hidden rounded-[2px] bg-black">
                    {slide.cover || slide.video ? (
                      <video
                        src={slide.cover ?? slide.video}
                        poster={slide.poster}
                        muted
                        loop
                        autoPlay
                        playsInline
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    ) : null}
                  </div>
                  <div className="flex items-baseline justify-between text-foreground/50">
                    Slide {i + 2}
                    <button
                      type="submit"
                      formAction={removeSlide}
                      formNoValidate
                      name="slide"
                      value={i}
                      className="transition-colors hover:text-[#ff6b6b]"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <ClipUploader post={clip.id} />
        </div>
      )}

      <label className="label">
        Title
        <input name="title" className="field" required defaultValue={clip.title ?? ""} />
      </label>

      <label className="label">
        Movie or show
        <input name="show" className="field" placeholder="Beef" defaultValue={clip.show ?? ""} />
      </label>

      {/* Made from the name and the date, e.g. beef-260922-01, and remade from
          them on save for as long as it is left generated. Type one to keep it. */}
      <label className="label">
        Slug
        <input
          name="slug"
          className="field"
          placeholder="Generated from the name and date"
          defaultValue={clip.slug ?? ""}
        />
      </label>

      <label className="label">
        Caption
        <textarea name="caption" className="field" defaultValue={clip.caption ?? ""} />
      </label>

      <div className="label">
        Video
        <FilePicker name="video" tree={tree} initial={clip.video ?? ""} />
      </div>

      <div className="label">
        Poster
        <FilePicker name="poster" tree={tree} initial={clip.poster ?? ""} />
      </div>

      {/* Made on upload. Any GIF or short MP4/WebM loop can stand in. */}
      <div className="label">
        Cover loop
        <FilePicker name="cover" tree={tree} initial={clip.cover ?? ""} />
      </div>

      {/* Played in place of a video when there is none; credited as the source
          when there is. */}
      <label className="label">
        Official link
        <input
          name="embed"
          className="field"
          inputMode="url"
          placeholder="YouTube, TikTok, Instagram or Vimeo"
          defaultValue={clip.embed ?? ""}
        />
      </label>

      <div className="label">
        Date
        <DateField name="date" value={clip.date ?? new Date().toISOString().slice(0, 10)} />
      </div>

      <Checkbox name="visible" label="Show on site" defaultChecked={!clip.hidden} />

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary">
          Save
        </button>

        {isNew ? (
          <Link href="/dashboard/cinema" className="btn btn-danger ml-auto">
            Discard
          </Link>
        ) : (
          <button type="submit" formAction={deleteClip} className="btn btn-danger ml-auto">
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
