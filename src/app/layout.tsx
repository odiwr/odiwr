import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { fontVariables } from "./fonts";
import { SITE, PROFILE_URLS } from "@/lib/site";

/**
 * Every page is titled "odiwr", by request.
 *
 * Stated as a plain string rather than a template, so a page that sets its own
 * title still cannot change what the tab says — `title.absolute` in a child
 * would override a template, but there is no template to override. Child pages
 * set only their description and canonical URL.
 */
export const metadata: Metadata = {
  // Open Graph and X both require ABSOLUTE image URLs. metadataBase is what
  // lets the relative paths below resolve, and without it Next warns at build
  // and the preview arrives with no image.
  metadataBase: new URL(SITE.url),
  title: SITE.name,
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.fullName, url: SITE.url }],
  creator: SITE.fullName,
  publisher: SITE.fullName,
  // iOS turns anything that looks like a phone number into a link, which
  // mangles dates like 8.28.2026.
  formatDetection: { telephone: false, date: false, address: false, email: false },
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/feed.xml", title: SITE.name }] },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
    url: SITE.url,
    // Resolved by the opengraph-image route beside this file.
  },
  twitter: {
    // Kept despite there being no X account: these tags describe the page, not
    // an account, and "summary_large_image" is what makes a shared link unfurl
    // as a full-width banner instead of a small square. `twitter:site` and
    // `twitter:creator` are the account-attribution tags, and those are omitted.
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.description,
  },
  // Paste the token from Search Console into GOOGLE_SITE_VERIFICATION and the
  // meta tag appears; leave it unset and no tag is emitted.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

/** The GA4 web stream's measurement ID, "G-…". Public by nature: it is in the page. */
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const viewport: Viewport = {
  themeColor: SITE.themeColor,
  colorScheme: "dark",
};

/**
 * Structured data.
 *
 * The meta tags above tell a crawler what this PAGE is; this tells it who the
 * site belongs to and which accounts are the same person. `sameAs` is the only
 * standard way to state that, now that there is no X handle to put in a card
 * tag.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  author: {
    "@type": "Person",
    // The person is the full name; "odiwr" is what the site is called.
    name: SITE.fullName,
    alternateName: SITE.name,
    url: SITE.url,
    // Straight from the role line — nothing here is claimed that the page does
    // not already say in words.
    description: SITE.role,
    affiliation: { "@type": "CollegeOrUniversity", name: "Rutgers University" },
    ...(PROFILE_URLS.length ? { sameAs: PROFILE_URLS } : {}),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <head>
        {/* The cursors are on this origin and are wanted immediately; opening
            the connection early saves the DNS and TLS round trips. */}
        <link rel="preconnect" href="https://media.odiwr.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
        {/* Google Analytics. Without this tag nothing ever reaches GA, and the
            dashboard's Analytics tab reads zeros however well the reporting
            side is set up. Unset, no script is emitted. */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(GA_ID)});`}
            </Script>
          </>
        )}
        <script
          type="application/ld+json"
          // The object is ours and contains no user input, so there is nothing
          // to escape; this is the documented way to emit JSON-LD in Next.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
