import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * Whether whoever is asking is signed into the dashboard.
 *
 * The cinema's pages are the same for everyone and cached as such, so they
 * cannot look at the cookie themselves; the gallery asks here instead, and
 * shows its Share button only when the answer is yes.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { admin: Boolean(await getSession()) },
    { headers: { "cache-control": "no-store" } }
  );
}
