import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SITE } from "@/lib/site";

/**
 * Host-based routing for the subdomains.
 *
 * projects.odiwr.com and creative.odiwr.com are served by THIS app: the request
 * is rewritten onto /projects or /creative so each subdomain has its own pages
 * without a second deployment. A rewrite, not a redirect — the visitor stays on
 * the subdomain and never sees the internal path.
 *
 * ONLY the root of each subdomain is rewritten. Everything below it falls
 * through to the same routes the apex serves, so a write-up at /proj1 resolves
 * on every host — otherwise the index on projects.odiwr.com would link to
 * /proj1 and the rewrite would turn it into /projects/proj1, which is nothing.
 * Those pages declare a canonical URL on the apex, so serving them from more
 * than one host does not split them in search results.
 *
 * DNS still has to point both names at this deployment; nothing here can do
 * that. Until it does, the routes are reachable at /projects and /creative.
 */

/** The one host each name should end up on. Derived, so it follows SITE.url. */
const CANONICAL_HOST = new URL(SITE.url).host;

/**
 * Collapse every spelling of an address onto one.
 *
 * Two 301s at most: http -> https, and www.<host> -> <host>. Anything that stops
 * a page being reachable at more than one URL is worth doing — duplicate hosts
 * split search ranking, and scrapers like Facebook's cache each spelling
 * separately, so a link shared as http:// gets a different preview record from
 * the same link shared as https://.
 *
 * To make www canonical instead, put the www host in SITE.url and flip the
 * condition below; everything else follows, because the canonical tags, the
 * sitemaps and the OG URLs are all built from the same constant.
 *
 * Skipped entirely for local hosts, which have no TLS and no www.
 */
function canonicalRedirect(request: NextRequest): NextResponse | null {
  const host = (request.headers.get("host") ?? "").split(":")[0];
  if (!host.includes(".") || host.endsWith(".localhost") || host === "127.0.0.1") return null;

  // Behind a proxy the real scheme is only in this header; nextUrl.protocol is
  // whatever the internal hop used.
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const wantsHost =
    host === `www.${CANONICAL_HOST}`
      ? CANONICAL_HOST
      : host.startsWith("www.")
        ? host.slice(4)
        : host;
  const wantsHttps = proto !== "https";

  if (wantsHost === host && !wantsHttps) return null;

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = wantsHost;
  url.port = "";
  return NextResponse.redirect(url, 301);
}

/** Leftmost label of the host -> the path it is served from. */
const SUBDOMAINS: Record<string, string> = {
  projects: "/projects",
  creative: "/creative",
};

export function proxy(request: NextRequest) {
  // One canonical spelling first, so everything below only ever sees it.
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;

  // Strip the port before reading the label, or "projects.localhost:3100" would
  // never match.
  const host = (request.headers.get("host") ?? "").split(":")[0];
  const base = SUBDOMAINS[host.split(".")[0]];

  // Not a subdomain we serve — the apex and www fall through untouched.
  if (!base) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();
  const section = base.slice(1);

  // These two have to describe the host they are served from, and the app-level
  // sitemap.ts / robots.ts only know about the apex.
  if (pathname === "/sitemap.xml") {
    url.pathname = `/sitemaps/${section}`;
    return NextResponse.rewrite(url);
  }
  if (pathname === "/robots.txt") {
    url.pathname = `/robots-txt/${section}`;
    return NextResponse.rewrite(url);
  }

  // Only the root otherwise. See the note above.
  if (pathname !== "/") return NextResponse.next();

  url.pathname = base;
  return NextResponse.rewrite(url);
}

export const config = {
  // Everything except Next's own assets and the files that must resolve at the
  // root of whichever host asks for them.
  // robots.txt and sitemap.xml are deliberately NOT excluded: on a subdomain
  // they need redirecting to that host's own versions.
  matcher: [
    "/((?!_next/|favicon.ico|icon.png|icon.svg|apple-icon.png|manifest.webmanifest|brand/|icons/).*)",
  ],
};
