import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { getContent, sectionWork } from "@/lib/content";
import WorkList from "@/components/work/WorkList";

/**
 * projects.odiwr.com.
 *
 * Reached by the host rewrite in proxy.ts, and directly at /projects until DNS
 * points the subdomain here. The canonical URL is the subdomain either way, so
 * the two paths are never treated as two pages.
 */
export const metadata: Metadata = {
  description: SITE.description,
  alternates: { canonical: SITE.projectsUrl },
  openGraph: { title: SITE.name, url: SITE.projectsUrl },
};

export default async function ProjectsPage() {
  const content = await getContent();
  return <WorkList heading="Projects" items={sectionWork(content, "projects")} />;
}
