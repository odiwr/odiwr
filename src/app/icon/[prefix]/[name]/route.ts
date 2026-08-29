import { icons as simpleIcons } from "@iconify-json/simple-icons";
import { icons as materialIcons } from "@iconify-json/material-symbols";
import { icons as devicon } from "@iconify-json/devicon";
import { icons as logos } from "@iconify-json/logos";
import { icons as skillIcons } from "@iconify-json/skill-icons";

/**
 * One icon, as an SVG file.
 *
 * The stack vocabulary is three and a half thousand brands. Bundling their
 * artwork would be megabytes to draw two marks on a page, so the marks are
 * served individually and referenced as CSS masks — which is also what lets them
 * take currentColor despite being an external file.
 *
 * Immutable caching: an icon's artwork never changes under the same name.
 */

const COLLECTIONS: Record<string, typeof simpleIcons> = {
  "simple-icons": simpleIcons,
  "material-symbols": materialIcons,
  devicon,
  logos,
  "skill-icons": skillIcons,
};

export const dynamicParams = true;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ prefix: string; name: string }> }
) {
  const { prefix, name } = await params;
  const collection = COLLECTIONS[prefix];
  const icon = collection?.icons[name.replace(/\.svg$/, "")];
  if (!icon) return new Response("Not found", { status: 404 });

  const width = icon.width ?? collection.width ?? 24;
  const height = icon.height ?? collection.height ?? 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
