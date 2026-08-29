/**
 * Single source of truth for anything that describes the site to the outside
 * world: search results, link previews, the web manifest, robots and sitemap.
 *
 * Kept in one file because these strings otherwise get copied into five places
 * and drift apart, and because the domain has to be resolvable at build time —
 * Open Graph image URLs must be absolute, so a relative path silently produces
 * a preview with no image on every platform that unfurls links.
 */

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

  /** The two subdomains linked from the home page. */
  projectsUrl: "https://projects.odiwr.com",
  creativeUrl: "https://creative.odiwr.com",

  /**
   * The meta description, the Open Graph description and the X card
   * description, all from here.
   */
  description:
    "@odiwr's personal portfolio featuring embedded systems design, backend architecture, and C++ firmware projects. Studying ECE at Rutgers University.",

  /** The one handle, per "anywhere online with @odiwr". */
  handle: "@odiwr",

  email: "o@odiwr.com",

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
    { label: "Gmail", href: "mailto:o@odiwr.com", icon: "simple-icons:gmail" },
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
 * Where the two subdomain links actually point.
 *
 * The real hosts in production; in development the paths proxy.ts rewrites them
 * to, so they can be opened without DNS pointing anywhere yet. The label shown
 * to the visitor is the domain either way.
 */
export const SUBDOMAIN_LINKS = {
  projects: process.env.NODE_ENV === "production" ? SITE.projectsUrl : "/projects",
  creative: process.env.NODE_ENV === "production" ? SITE.creativeUrl : "/creative",
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
