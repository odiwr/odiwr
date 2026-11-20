import { SITE } from "@/lib/site";
import { getContent, allPosts } from "@/lib/content";
import { postHtml, postTitle, postUrl } from "@/lib/posts";

/**
 * RSS feed, at /feed.xml.
 *
 * Built from the same post list the site renders, so publishing from the
 * dashboard puts a post in the feed with nothing else to do.
 *
 * Each item is a post as a reader expects one: a title (lib/posts.ts), a link
 * to where it can be read on the site (/blog#id), and the body as HTML rather
 * than the dashboard's ~markers~.
 */

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** HTML inside CDATA; the one sequence that would end it early is split. */
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

export async function GET() {
  const content = await getContent();
  const items = allPosts(content)
    .map((post) => {
      // RSS wants RFC 822; midday UTC avoids a date-only value landing on the
      // previous day for readers west of Greenwich.
      const date = new Date(`${post.date}T12:00:00Z`).toUTCString();
      return `    <item>
      <title>${escape(postTitle(post))}</title>
      <link>${postUrl(post)}</link>
      <guid isPermaLink="false">${escape(post.id)}</guid>
      <pubDate>${date}</pubDate>
      <description>${cdata(postHtml(post))}</description>
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(SITE.name)}</title>
    <link>${SITE.url}/blog</link>
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
