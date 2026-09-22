import { notFound } from "next/navigation";
import PostComposer, { type ComposerSlide } from "@/components/dashboard/PostComposer";
import { getContent } from "@/lib/content";
import { clipSlides, readable } from "@/lib/cinema";

export const dynamic = "force-dynamic";

/**
 * One post in the composer: /dashboard/cinema/new for a new one, or its id.
 *
 * Every slide is handed over with an address the browser can play it from and
 * read back (readable()), so a changed trim can have its cover recorded again.
 */
export default async function CinemaPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "new") return <PostComposer />;

  const clip = (await getContent()).clips.find((c) => c.id === id);
  if (!clip) notFound();

  const slides: ComposerSlide[] = clipSlides(clip).map((s) => ({
    ...s,
    source: readable(s.video),
    loopOnly: s.video ? undefined : (s.cover ?? s.poster),
  }));

  return (
    <PostComposer
      post={{
        id: clip.id,
        title: clip.title,
        show: clip.show,
        caption: clip.caption,
        embed: clip.embed,
        slides: slides.filter((s) => s.video || s.loopOnly),
      }}
    />
  );
}
