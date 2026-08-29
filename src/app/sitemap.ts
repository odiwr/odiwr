import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getContent, slugWork } from "@/lib/content";

/**
 * Built from the project registry rather than a hand-written list, so a new
 * project appears here the moment it is declared and there is nothing to
 * remember to update.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getContent();
  const now = new Date();

  // Only this site. projects.odiwr.com and creative.odiwr.com are separate
  // origins and carry their own sitemaps.
  const fixed: MetadataRoute.Sitemap = [
    { url: SITE.url, lastModified: now, changeFrequency: "monthly", priority: 1 },
  ];

  const work: MetadataRoute.Sitemap = slugWork(content).map((p) => ({
    url: `${SITE.url}/${p.slug}`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.7,
  }));

  return [...fixed, ...work];
}
