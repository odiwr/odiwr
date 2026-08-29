import { NextRequest, NextResponse } from "next/server";
import { media } from "@/lib/media";

// Same-origin passthrough for R2, so the browser will treat bucket files as
// ours.
//
// Why this exists: the EQ and spectrum analyser need a MediaElementSourceNode,
// and the browser only allows that on same-origin media (or cross-origin media
// served with CORS headers). media.odiwr.com currently sends none, so a direct
// <audio src="https://media.odiwr.com/..."> connected to an AudioContext plays
// **silence** — the graph is muted rather than erroring, which is a miserable
// thing to debug.
//
// The same missing header breaks the CRT scene: three.js fetches the model with
// XHR, which is a CORS request, so a direct CDN URL fails outright with "Could
// not load ... Failed to fetch". The video takeover has the same problem.
//
// Adding an `Access-Control-Allow-Origin` rule to the R2 bucket would let both
// point straight at the CDN and retire this route.
//
// Deliberately restricted to an allow-list: this fetches a URL derived from a
// query parameter, and without it this is an open proxy.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = ["legacy/music/", "mp3/"];

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") || "";

  // Traversal is a property of path SEGMENTS, not of the substring "..".
  // Matching the substring rejected real files: "legacy/music/Sunny - Boney M..mp3"
  // ends in a band name with a full stop, so the artist's dot and the extension
  // dot sit adjacent, and that track 403'd in every player. Comparing segments
  // still blocks "legacy/music/../secret" while leaving ordinary filenames alone.
  const traversal = key.split("/").some((segment) => segment === ".." || segment === ".");
  const allowed = ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix));
  if (!allowed || traversal || key.includes("//")) {
    return NextResponse.json({ error: "Not an allowed key" }, { status: 403 });
  }

  const range = req.headers.get("range");
  const upstream = await fetch(media(key), {
    headers: range ? { range } : undefined,
    cache: "no-store",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: upstream.status });
  }

  const headers = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    // Seeking depends on the browser knowing ranges are supported.
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=3600",
  });
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
