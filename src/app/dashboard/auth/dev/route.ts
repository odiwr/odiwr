import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_EMAILS, devSignInAllowed, setSessionCookie } from "@/lib/auth";

/**
 * Local sign-in. See devSignInAllowed() in lib/auth.ts.
 *
 * A 404 anywhere it is not allowed, so in production it does not exist.
 */
export async function POST(request: NextRequest) {
  if (!devSignInAllowed() || !ADMIN_EMAILS[0]) {
    return new NextResponse("Not found", { status: 404 });
  }

  await setSessionCookie({ email: ADMIN_EMAILS[0] });
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
