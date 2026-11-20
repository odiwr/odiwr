import type { Post } from "./content";
import { plainText } from "./richtext";
import { SITE } from "./site";

/**
 * What the outside world needs to know about a blog post: its name, its
 * address, and its body as HTML for a feed reader.
 */

/** Longest a made-up title runs before it is cut at a word. */
const TITLE_MAX = 70;

/** A run the writer marked at the very start: ~cursive~, **bold**, *italic*, _underline_. */
const OPENING_MARK = /^(?:~([^~]+)~|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_)/;

/**
 * The post's title: the one typed in the dashboard, else the phrase the post
 * opens on when it is marked out (the way "~The 2012 death theory~" opens one),
 * else its first sentence, cut at a word if it runs long.
 */
export function postTitle(post: Post): string {
  if (post.title?.trim()) return post.title.trim();

  const first = post.paragraphs[0]?.trim() ?? "";
  const marked = OPENING_MARK.exec(first);
  if (marked) return plainText(marked.slice(1).find(Boolean) ?? "");

  const sentence = plainText(first).split(/(?<=[.!?])\s/)[0] ?? "";
  if (sentence.length <= TITLE_MAX) return sentence;
  const cut = sentence.slice(0, TITLE_MAX);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

/** Where the post can be read: its place on the blog page. */
export function postUrl(post: Post): string {
  return `${SITE.url}/blog#${post.id}`;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const INLINE =
  /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|~([^~]+)~/g;

/** One paragraph's markers turned into HTML, everything else escaped. */
function inlineHtml(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    out += escapeHtml(text.slice(last, m.index));
    const [, linkText, href, bold, italic, underline, cursive] = m;
    if (linkText && href) {
      // Web and mail links only; anything with another scheme stays plain text.
      const url = /^(https?:|mailto:)/i.test(href)
        ? href
        : /^[a-z][a-z0-9+.-]*:/i.test(href)
          ? null
          : `https://${href.replace(/^\/\//, "")}`;
      out += url ? `<a href="${escapeHtml(url)}">${escapeHtml(linkText)}</a>` : escapeHtml(linkText);
    } else if (bold) out += `<strong>${escapeHtml(bold)}</strong>`;
    else if (underline) out += `<u>${escapeHtml(underline)}</u>`;
    else out += `<em>${escapeHtml(italic ?? cursive ?? "")}</em>`;
    last = (m.index ?? 0) + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

/** The whole post as HTML, for a feed reader. Lines starting "- " become a list. */
export function postHtml(post: Post): string {
  return post.paragraphs
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      const items = lines.filter((l) => /^\s*[-•]\s+/.test(l));
      if (items.length && items.length === lines.length) {
        return `<ul>${items.map((l) => `<li>${inlineHtml(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${inlineHtml(lines.join(" "))}</p>`;
    })
    .join("\n");
}
