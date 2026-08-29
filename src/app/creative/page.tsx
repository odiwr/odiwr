import type { Metadata } from "next";
import SectionHeader from "@/components/work/SectionHeader";
import { SITE } from "@/lib/site";
import { getContent, isExternal, sectionWork, workHref, type Work } from "@/lib/content";
import { mosaic, CREATIVE_ASPECT, CREATIVE_SEED } from "@/lib/mosaic";

/**
 * creative.odiwr.com. Film and photography.
 *
 * A mosaic rather than a list: one fixed rectangle cut into slots of many
 * different aspect ratios, each holding an animated poster that links out —
 * usually to YouTube or wherever the piece actually lives.
 *
 * ONLY entries that have a poster are laid out. There are no placeholder slots:
 * an empty puzzle would be showing the scaffolding rather than the work. The
 * layout is cut for however many real posters there are, so the ratios come from
 * a seeded algorithm (src/lib/mosaic.ts) that the dashboard can run too — that
 * is how it quotes the exact aspect ratio a new poster must be cut to.
 */

/** Floating-point slack when asking whether a tile touches an edge. */
const EDGE = 0.001;

export const metadata: Metadata = {
  description: SITE.description,
  alternates: { canonical: SITE.creativeUrl },
  openGraph: { title: SITE.name, url: SITE.creativeUrl },
};

export const revalidate = 60;

export default async function CreativePage() {
  const content = await getContent();
  const posters = sectionWork(content, "creative").filter((item: Work) => item.poster);
  const tiles = mosaic(posters.length, CREATIVE_SEED, CREATIVE_ASPECT);
  const half = "calc(var(--mosaic-gap) / 2)";

  return (
    <main className="page">
      <div className="page-grid">
        <article className="prose enter">
          <SectionHeader title="Creative" />

          {posters.length === 0 ? (
            <p className="text-foreground/50">Nothing here yet.</p>
          ) : (
            <div className="mosaic">
              {posters.map((item: Work, i: number) => {
                const tile = tiles[i];
                const isVideo = /\.(mp4|webm)$/i.test(item.poster!);

                return (
                  <a
                    key={item.id}
                    href={workHref(item)}
                    {...(isExternal(item)
                      ? { target: "_blank", rel: "noreferrer noopener" }
                      : {})}
                    aria-label={
                      item.blurb ? `${item.title} — ${item.blurb}` : item.title
                    }
                    className="mosaic-tile"
                    style={{
                      left: `${tile.x * 100}%`,
                      top: `${tile.y * 100}%`,
                      width: `${tile.w * 100}%`,
                      height: `${tile.h * 100}%`,
                      // Half a gap on every inward-facing side and nothing on
                      // the ones against the frame, so the posters meet the
                      // edges of the rectangle cleanly.
                      paddingLeft: tile.x <= EDGE ? 0 : half,
                      paddingTop: tile.y <= EDGE ? 0 : half,
                      paddingRight: tile.x + tile.w >= 1 - EDGE ? 0 : half,
                      paddingBottom: tile.y + tile.h >= 1 - EDGE ? 0 : half,
                    }}
                  >
                    <span className="mosaic-inner">
                      {isVideo ? (
                        // Muted always, and playsInline so iOS does not take it
                        // fullscreen the moment it starts.
                        <video src={item.poster} autoPlay muted loop playsInline />
                      ) : (
                        // Deliberately not next/image: these are animated GIFs,
                        // and the optimiser flattens them to a still.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.poster} alt="" loading="lazy" />
                      )}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </article>

        <aside className="side" aria-hidden="true" />
      </div>
    </main>
  );
}
