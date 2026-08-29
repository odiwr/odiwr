import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_EMAILS,
  OAUTH_STATE_COOKIE,
  exchangeCode,
  setSessionCookie,
} from "@/lib/auth";

/**
 * Where Google sends the browser back.
 *
 * The allow-list is enforced here as well as on every session read: someone can
 * authenticate with Google perfectly well and still have no business being in
 * this dashboard.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  const fail = (error: string) =>
    NextResponse.redirect(new URL(`/dashboard/login?error=${error}`, request.url));

  if (!code || !state || !expected || state !== expected) return fail("state");

  const profile = await exchangeCode(code, url.origin);
  if (!profile) return fail("exchange");
  if (!ADMIN_EMAILS.includes(profile.email.toLowerCase())) return fail("denied");

  await setSessionCookie(profile);

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
