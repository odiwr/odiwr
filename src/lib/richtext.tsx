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
          href={/^[a-z][a-z0-9+.-]*:|^\//i.test(href) ? href : `https://${href}`}
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
