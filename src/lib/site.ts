/**
 * Single source of truth for anything that describes the site to the outside
 * world: search results, link previews, the web manifest, robots and sitemap.
 *
 * Kept in one file because these strings otherwise get copied into five places
 * and drift apart, and because the domain has to be resolvable at build time —
 * Open Graph image URLs must be absolute, so a relative path silently produces
 * a preview with no image on every platform that unfurls links.
 */

const EMAIL = "o@odiwr.com";

/**
 * The email link, with a subject and a few lines already written, so a message
 * sent from the site says who it is from and what it is about instead of
 * arriving as "test / hello". The sender can still change all of it.
 *
 * Line breaks as CRLF, which is what mailto: asks for (RFC 6068); every part
 * percent-encoded, since a "+" or "&" left bare would cut the message short.
 */
const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent("Hey Bill (from odiwr.com)")}&body=${encodeURIComponent(
  [
    "Hey Bill,",
    "",
    "[what's on your mind]",
    "",
    "",
    "Name:",
    "Company / project:",
    "Best way to reach me:",
    "",
    "Sent from odiwr.com",
  ].join("\r\n")
)}`;

export const SITE = {
  /** Shown as the browser tab title on every page, by request. */
  name: "odiwr",

  /** Full name, as it reads at the top of the page. */
  fullName: "Bill Odiwuor Kawaka",

  /** The line under the name. */
  role: "Electrical & Computer Engineering @ Rutgers NB | Sophomore",

  /**
   * Canonical origin. Overridable so preview deployments describe themselves
   * rather than claiming to be production.
   */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://odiwr.com").replace(/\/$/, ""),

  /** The subdomains linked from the home page. */
  projectsUrl: "https://projects.odiwr.com",
  creativeUrl: "https://creative.odiwr.com",
  /** Clips from films and shows, each with its own page. */
  cinemaUrl: "https://cinema.odiwr.com",
  /** Photographs and video, in a gallery that fits every shape. */
  portfolioUrl: "https://portfolio.odiwr.com",
  /** Unlisted: not linked anywhere public, not in any sitemap, and noindex. */
  wishlistUrl: "https://wishlist.odiwr.com",

  /**
   * The meta description, the Open Graph description and the X card
   * description, all from here.
   */
  description:
    "@odiwr's personal portfolio featuring embedded systems design, backend architecture, and C++ firmware projects. Studying ECE at Rutgers University.",

  /** The one handle, per "anywhere online with @odiwr". */
  handle: "@odiwr",

  email: EMAIL,

  /** What every email link on the site opens: the address, a subject and a short template. */
  mailto: MAILTO,

  /**
   * The accounts behind the handle. Order is the order they appear in the
   * dropdown.
   *
   * Every URL here is the handle applied to that platform's usual profile path,
   * which is what "anywhere online with @odiwr" states. LinkedIn is the one to
   * double-check: its vanity URLs are chosen per account rather than derived
   * from a handle, so /in/odiwr is an assumption in a way the others are not.
   */
  profiles: [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/odiwr", icon: "simple-icons:linkedin" },
    { label: "GitHub", href: "https://github.com/odiwr", icon: "simple-icons:github" },
    { label: "Gmail", href: MAILTO, icon: "simple-icons:gmail" },
    { label: "Instagram", href: "https://www.instagram.com/odiwr", icon: "simple-icons:instagram" },
  ],

  /** Background, matching --color-background in globals.css. */
  themeColor: "#1a1a1a",
} as const;

/**
 * Every profile URL, for structured data.
 *
 * mailto: is dropped — `sameAs` takes web pages that identify the person, and a
 * mail link is not one.
 */
export const PROFILE_URLS = SITE.profiles
  .map((p) => p.href)
  .filter((href) => !href.startsWith("mailto:"));

/**
 * Where the subdomain links actually point.
 *
 * The real hosts in production; in development the paths proxy.ts rewrites them
 * to, so they can be opened without DNS pointing anywhere yet. The label shown
 * to the visitor is the domain either way.
 */
export const SUBDOMAIN_LINKS = {
  projects: process.env.NODE_ENV === "production" ? SITE.projectsUrl : "/projects",
  creative: process.env.NODE_ENV === "production" ? SITE.creativeUrl : "/creative",
  wishlist: process.env.NODE_ENV === "production" ? SITE.wishlistUrl : "/wishlist",
  cinema: process.env.NODE_ENV === "production" ? SITE.cinemaUrl : "/cinema",
  portfolio: process.env.NODE_ENV === "production" ? SITE.portfolioUrl : "/portfolio",
};

/** Profile URLs by label, for anything that needs one by name. */
export const PROFILE = Object.fromEntries(SITE.profiles.map((p) => [p.label, p.href])) as Record<
  string,
  string
>;

/**
 * Where "Back" goes when there is no tab to return to.
 *
 * The apex in production; a plain root path in development, where the real
 * domain is not what is being served.
 */
export const HOME_HREF = process.env.NODE_ENV === "production" ? SITE.url : "/";
