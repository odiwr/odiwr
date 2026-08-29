import { SITE } from "@/lib/site";
import { getContent, sectionWork, type Section } from "@/lib/content";

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
 */

const ORIGINS: Record<string, { origin: string; section: Section }> = {
  projects: { origin: SITE.projectsUrl, section: "projects" },
  creative: { origin: SITE.creativeUrl, section: "creative" },
};

export function generateStaticParams() {
  return Object.keys(ORIGINS).map((section) => ({ section }));
}

export const dynamicParams = false;

export async function GET(_request: Request, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const config = ORIGINS[section];
  if (!config) return new Response("Not found", { status: 404 });

  const items = sectionWork(await getContent(), config.section);

  const now = new Date().toISOString();
  const urls = [
    config.origin,
    ...items.filter((w) => w.slug).map((w) => `${config.origin}/${w.slug}`),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc><lastmod>${now}</lastmod></url>`).join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
