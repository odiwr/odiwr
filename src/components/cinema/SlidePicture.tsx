import type { ViewSlide } from "@/lib/cinema";

/**
 * A slide's picture, for the dashboard: its loop playing (a video, or a GIF
 * as an image), else its still, else the clip's own first frame.
 *
 * The site's grid has its own (CinemaGallery's TileMedia), which also pauses
 * off screen; a dashboard list is short enough not to need that.
 */
export default function SlidePicture({
  slide,
  className,
}: {
  slide: ViewSlide;
  className?: string;
}) {
  const loop = slide.loop;
  if (loop && /\.(mp4|webm)(?:[?#]|$)/i.test(loop)) {
    return (
      <video
        src={loop}
        poster={slide.still}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className={className}
      />
    );
  }
  const picture = loop ?? slide.still;
  if (picture) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={picture} alt="" loading="lazy" className={className} />;
  }
  if (slide.video) {
    return <video src={`${slide.video}#t=0.1`} muted playsInline preload="metadata" className={className} />;
  }
  return null;
}
