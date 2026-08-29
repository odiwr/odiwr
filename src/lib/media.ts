/**
 * The public origin of the R2 bucket.
 *
 * Safe in client components, unlike lib/r2.ts, which holds the private keys —
 * this is only the base URL, and it is exposed deliberately.
 */
export const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? "https://media.odiwr.com").replace(
  /\/$/,
  ""
);

/** Public URL for a bucket key, with each path segment encoded. */
export function media(key: string): string {
  const clean = key.replace(/^\//, "");
  return `${MEDIA_BASE}/${clean.split("/").map(encodeURIComponent).join("/")}`;
}
