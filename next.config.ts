import type { NextConfig } from "next";

/**
 * Response headers for every page and route.
 *
 * No full Content-Security-Policy yet: Next's inline scripts would need a nonce
 * on every request, which turns every page dynamic. These are the directives
 * that cost nothing and break nothing:
 *
 *   frame-ancestors  no other site can put a page of this one in a frame, so
 *                    the dashboard cannot be clickjacked
 *   base-uri         an injected <base> cannot redirect relative URLs
 *   object-src       no plugins, ever
 *
 * HSTS covers the subdomains too (media., projects., the rest), all of which
 * are HTTPS-only already. Not preloaded: that is a one-way door.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests",
  },
  // For browsers too old to read frame-ancestors.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // No "x-powered-by: Next.js": it only tells a scanner what to try.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
