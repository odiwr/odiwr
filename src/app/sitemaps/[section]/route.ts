import { SITE } from "@/lib/site";
import { getContent, publicClips, sectionWork, type Section } from "@/lib/content";
import { clipSlides, slidePath } from "@/lib/cinema";

/**
 * Per-subdomain sitemaps.
 *
 * app/sitemap.ts can only describe one host, and it is the apex's. Left alone,
 * projects.odiwr.com/sitemap.xml would serve that same file — a sitemap on one
 * host listing another host's URLs, which crawlers discard. proxy.ts rewrites
 * each subdomain's /sitemap.xml here instead.
 *
 * Only entries with a slug appear: most work links straight out to GitHub or
 * YouTube, and those are not ours to list.
 *
 * The wishlist is deliberately absent. It is unlisted, and a sitemap is a list
 * handed to search engines.
 */

const ORIGINS: Record<string, { origin: string; section: Section }> = {
  projects: { origin: SITE.projectsUrl, section: "projects" },
  creative: { origin: SITE.creativeUrl, section: "creative" },
};

export function generateStaticParams() {
  return [...Object.keys(ORIGINS), "cinema"].map((section) => ({ section }));
}

export const dynamicParams = false;

export async function GET(_request: Request, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const content = await getContent();
  const config = ORIGINS[section];

  let urls: string[];
  if (section === "cinema") {
    // Every visible post is a page of its own there, and so is each of its slides.
    urls = [
      SITE.cinemaUrl,
      ...publicClips(content).flatMap((c) =>
        clipSlides(c).map((_, i) => `${SITE.cinemaUrl}/${slidePath(c.slug, i)}`)
      ),
    ];
  } else if (config) {
    const items = sectionWork(content, config.section);
    urls = [config.origin, ...items.filter((w) => w.slug).map((w) => `${config.origin}/${w.slug}`)];
  } else {
    return new Response("Not found", { status: 404 });
  }

  const now = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc><lastmod>${now}</lastmod></url>`).join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
