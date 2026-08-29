import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE, googleAuthUrl, googleConfigured, newState } from "@/lib/auth";

/** Starts the Google sign-in. */
export async function GET(request: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/dashboard/login?error=config", request.url));
  }

  const origin = request.nextUrl.origin;
  const state = newState();

  const response = NextResponse.redirect(googleAuthUrl(origin, state));
  // Round-trips with the request so the callback can prove the response belongs
  // to a sign-in this browser actually started.
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/dashboard",
    maxAge: 600,
  });
  return response;
}
