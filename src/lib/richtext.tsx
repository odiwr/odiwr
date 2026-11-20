import type { ReactNode } from "react";
import Icon from "@/components/icons";

/**
 * The small inline syntax the blog body is written in.
 *
 *   **bold**      *italic*      _underline_      ~cursive~      [text](url)
 *
 * Markers stay visible while writing and disappear on the site, which is the
 * point: the textarea holds plain text that is still readable if every bit of
 * this is ever thrown away.
 *
 * Chinese runs are detected and set in the Chinese face without being marked up
 * at all — the characters themselves are the signal.
 */

const INLINE =
  /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|~([^~]+)~/g;

/** Han characters, including the extension blocks used by traditional text. */
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3000-\u303F]+/g;

const LINK =
  "underline decoration-foreground/30 decoration-1 underline-offset-[2.5px] transition-colors hover:text-accent hover:decoration-accent";

/**
 * A link's address as written, made safe to put in an href.
 *
 * Web and mail addresses and site paths pass; a bare "example.com" gets
 * https://. Any other scheme (javascript:, data:) is dropped for "#": nothing
 * typed into a post should be able to run script on the page.
 */
function safeHref(href: string): string {
  if (/^(https?:|mailto:)/i.test(href) || /^\/(?!\/)/.test(href)) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return "#";
  return `https://${href.replace(/^\/\//, "")}`;
}

/** A line that starts a list item: "- thing" or "• thing". */
const BULLET = /^\s*[-•]\s+/;

/**
 * A block of text, as typed in the dashboard, rendered as paragraphs and lists.
 *
 * Blank lines separate blocks. Inside a block, lines that start with "- " (or
 * "• ") become a list; the lines around them stay paragraphs. Without this a
 * list typed one item per line arrived as one paragraph with " - " between the
 * items, since HTML folds line breaks into spaces.
 *
 * `className` goes on every paragraph and list; the first block gets no top
 * margin, the rest `gap`.
 */
export function renderBlocks(
  text: string,
  { key = "b", className = "", gap = "mt-7" }: { key?: string; className?: string; gap?: string } = {}
): ReactNode[] {
  const out: ReactNode[] = [];
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  blocks.forEach((block, b) => {
    // Runs of the same kind: [isList, lines].
    const runs: [boolean, string[]][] = [];
    for (const line of block.split("\n")) {
      const isItem = BULLET.test(line);
      const last = runs[runs.length - 1];
      if (last && last[0] === isItem) last[1].push(line);
      else runs.push([isItem, [line]]);
    }

    runs.forEach(([isList, lines], r) => {
      const id = `${key}${b}-${r}`;
      // A new block gets the full gap; a list and the line introducing it stay close.
      const spacing = out.length === 0 ? "" : r === 0 ? gap : "mt-3";
      const cls = [spacing, className].filter(Boolean).join(" ");
      if (isList) {
        out.push(
          <ul key={id} className={`rich-list ${cls}`}>
            {lines.map((line, i) => (
              <li key={i}>{renderInline(line.replace(BULLET, ""), `${id}-${i}`)}</li>
            ))}
          </ul>
        );
      } else {
        out.push(
          <p key={id} className={cls || undefined}>
            {renderInline(lines.map((l) => l.trim()).join(" "), id)}
          </p>
        );
      }
    });
  });

  return out;
}

/**
 * The text with the markers taken out: what a feed reader, a link preview or a
 * page title should show.
 */
export function plainText(text: string): string {
  return text
    .replace(INLINE, (_m, linkText, _href, bold, italic, underline, cursive) =>
      linkText ?? bold ?? italic ?? underline ?? cursive ?? ""
    )
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Splits plain text so Chinese runs can carry their own font. */
function withCjk(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  CJK.lastIndex = 0;

  while ((match = CJK.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(
      <span key={`${key}-cjk-${match.index}`} className="font-chinese" lang="zh">
        {match[0]}
      </span>
    );
    last = match.index + match[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderInline(text: string, key = "t"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;

  while ((match = INLINE.exec(text))) {
    if (match.index > last) out.push(...withCjk(text.slice(last, match.index), `${key}-${last}`));
    const id = `${key}-${match.index}`;
    const [, linkText, href, bold, italic, underline, cursive] = match;

    if (linkText && href) {
      out.push(
        <a
          key={id}
          href={safeHref(href)}
          target="_blank"
          rel="noreferrer noopener"
          className={`inline-flex items-center gap-1 ${LINK}`}
        >
          {withCjk(linkText, id)}
          <Icon name="material-symbols:arrow-outward-rounded" />
        </a>
      );
    } else if (bold) {
      out.push(
        <strong key={id} className="font-medium">
          {withCjk(bold, id)}
        </strong>
      );
    } else if (italic) {
      out.push(<em key={id}>{withCjk(italic, id)}</em>);
    } else if (underline) {
      out.push(
        <span key={id} className="underline decoration-foreground/40 underline-offset-[2.5px]">
          {withCjk(underline, id)}
        </span>
      );
    } else if (cursive) {
      out.push(
        <span key={id} className="font-cursive">
          {withCjk(cursive, id)}
        </span>
      );
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) out.push(...withCjk(text.slice(last), `${key}-${last}`));
  return out;
}
