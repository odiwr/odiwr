import { SITE } from "@/lib/site";

/**
 * Per-subdomain robots.txt.
 *
 * Same reason as the sitemaps: a robots.txt has to point at a sitemap on its own
 * host, and app/robots.ts only knows about the apex.
 */

const ORIGINS: Record<string, string> = {
  projects: SITE.projectsUrl,
  creative: SITE.creativeUrl,
};

export function generateStaticParams() {
  return Object.keys(ORIGINS).map((section) => ({ section }));
}

export const dynamicParams = false;

export async function GET(_request: Request, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const origin = ORIGINS[section];
  if (!origin) return new Response("Not found", { status: 404 });

  const body = `User-Agent: *\nAllow: /\n\nHost: ${origin}\nSitemap: ${origin}/sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
