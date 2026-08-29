import { NextRequest, NextResponse } from "next/server";
import { list } from "@/lib/r2";

// Lists an allow-listed R2 prefix, so the client can be folder-driven: drop a
// file in the bucket and it appears. The allow-list is the point — this takes a
// prefix from a query parameter, and without it the bucket would be walkable.
const ALLOWED = new Set([
  "legacy/gifs/redirects/",
  "legacy/gifs/bullets/",
  "legacy/music/",
  "legacy/pdfs/",
]);

export async function GET(req: NextRequest) {
  const prefix = req.nextUrl.searchParams.get("prefix") || "";
  if (!ALLOWED.has(prefix)) {
    return NextResponse.json({ error: "prefix not allowed" }, { status: 403 });
  }
  const files = await list(prefix);
  return NextResponse.json(
    { files },
    { headers: { "cache-control": "public, max-age=300" } }
  );
}
