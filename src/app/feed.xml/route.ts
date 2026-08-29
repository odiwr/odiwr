import { SITE } from "@/lib/site";
import { getContent, allPosts, displayDate } from "@/lib/content";

/**
 * RSS feed, at /feed.xml.
 *
 * Built from the same post list the page renders, so publishing from the
 * dashboard puts a post in the feed with nothing else to do.
 */

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const content = await getContent();
  const items = allPosts(content).map((post) => {
    // RSS wants RFC 822; midday UTC avoids a date-only value landing on the
    // previous day for readers west of Greenwich.
    const date = new Date(`${post.date}T12:00:00Z`).toUTCString();
    const link = `${SITE.url}/#${post.id}`;
    return `    <item>
      <title>${escape(displayDate(post.date))}</title>
      <link>${link}</link>
      <guid isPermaLink="false">${escape(post.id)}</guid>
      <pubDate>${date}</pubDate>
      <description>${escape(post.paragraphs.join("\n\n"))}</description>
    </item>`;
  }).join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(SITE.name)}</title>
    <link>${SITE.url}</link>
    <description>${escape(SITE.description)}</description>
    <language>en</language>
    <atom:link href="${SITE.url}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
