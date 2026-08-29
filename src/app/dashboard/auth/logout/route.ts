import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { HOME_HREF } from "@/lib/site";

export async function POST(request: NextRequest) {
  await clearSessionCookie();
  // Back to the site, not to a login screen for the thing just left.
  return NextResponse.redirect(new URL(HOME_HREF, request.url), 303);
}
