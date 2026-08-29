import Icon from "@/components/icons";
import HandleMenu from "@/components/home/HandleMenu";
import SocialIcons from "@/components/home/SocialIcons";
import { SITE, SUBDOMAIN_LINKS } from "@/lib/site";
import { getContent, displayDate, workHref } from "@/lib/content";
import { renderInline } from "@/lib/richtext";
import { columnsFor } from "@/lib/filler";

/**
 * Home.
 *
 * Laid out on the grid defined in globals.css: a 640px column centred between
 * two 192px gutters, the right one reserved and currently empty.
 *
 * One type size throughout, by request — hierarchy is weight, colour and family
 * instead, which is why nothing here sets a text-size utility.
 *
 * The intro is the real copy. Everything else is still PLACEHOLDER — the blog
 * paragraphs and the entries are generic names with lorem ipsum, standing in for
 * what the backend will supply.
 */

const OUT = { target: "_blank", rel: "noreferrer noopener" } as const;

/** Underline treatment shared by every link in running text. */
const LINK =
  "underline decoration-foreground/30 underline-offset-[2.5px] decoration-1 transition-colors hover:text-accent hover:decoration-accent";

/**
 * The two subdomains.
 *
 * These open in the SAME tab, which is what the sideways arrow means here — the
 * outward arrow is reserved for links that leave for somewhere that is not mine.
 */
const DESTINATIONS = [
  { label: "projects.odiwr.com", href: SUBDOMAIN_LINKS.projects },
  { label: "creative.odiwr.com", href: SUBDOMAIN_LINKS.creative },
];

/**
 * The role line, with the separator drawn a little taller.
 *
 * Split here rather than stored as markup so the string in site.ts stays a
 * plain string that other things (metadata, structured data) can use as-is.
 */
function renderRole(role: string) {
  const parts = role.split("|");
  if (parts.length !== 2) return role;
  return (
    <>
      {parts[0]}
      <span className="pipe">|</span>
      {parts[1]}
    </>
  );
}

export default async function Home() {
  const content = await getContent();
  const columns = columnsFor(content);
  const latest = content.post;

  return (
    <main className="page">
      <div className="page-grid">
        {/* The strip the page scrolls under. Fixed, so it fades whatever passes
            beneath it per pixel rather than per block. */}
        <div className="top-fade" aria-hidden="true" />

        <article className="prose enter">
          <header>
            <h1 className="font-medium">{SITE.fullName}</h1>
            <p className="role">{renderRole(SITE.role)}</p>
          </header>

          <p className="text-foreground/80">
            <span className="font-cursive">I hate boring design.</span> Ironic right? But why
            bother creating a product just for the end result to be a vibe coded mediocre mess of
            ideas? That has been my mindset ever since I began freelance web developing in 2021.
            Creators (and honestly, clients) overlook the small details that make a product{" "}
            <span className="font-cursive">worth</span> buying, even if it&rsquo;s boring.
          </p>

          <p className="text-foreground/80">
            Thanks a lot{" "}
            <a
              href="https://grugbrain.dev"
              {...OUT}
              className={`inline-flex items-center gap-1.5 ${LINK}`}
            >
              grug brain
              <Icon name="material-symbols:arrow-outward-rounded" />
            </a>
          </p>

          <ul>
            {DESTINATIONS.map((d) => (
              <li key={d.href} className="pl-4">
                <a
                  href={d.href}
                  className="inline-flex items-center gap-1.5 text-foreground/80 transition-colors hover:text-accent"
                >
                  <Icon name="material-symbols:arrow-right-alt-rounded" />
                  {d.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="stack-wrap">
            <div className="stack">
              {columns.map((col) => (
                <section key={col.heading} className="column">
                  <h2 className="text-foreground/50">{col.heading}</h2>
                  <div className="items">
                    {col.items.map((item) => (
                      <div key={item.id} className="entry">
                        <a
                          href={workHref(item)}
                          {...(item.slug ? {} : OUT)}
                          className={`inline-flex items-center gap-1.5 ${LINK}`}
                        >
                          {item.title}
                          <Icon name="material-symbols:arrow-outward-rounded" />
                        </a>
                        {item.blurb && <p className="text-foreground/50">{item.blurb}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          {latest && (
            <section>
              {/* Title on the left, date pushed to the right edge of the column. */}
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-foreground/50">Blog</h2>
                <span className="text-foreground/50">{displayDate(latest.date)}</span>
              </div>
              {latest.paragraphs.map((text, i) => (
                <p key={i} className="mt-3 text-foreground/80">
                  {renderInline(text, `p${i}`)}
                </p>
              ))}
            </section>
          )}

          <section>
            <h2 className="text-foreground/50">Talk to me</h2>
            <p className="text-foreground/80">
              Anywhere online with <HandleMenu /> or{" "}
              <a href={`mailto:${SITE.email}`} className={LINK}>
                {SITE.email}
              </a>
              .
            </p>
          </section>

          {/* "Because of love" -- doing it out of passion rather than for the
              result. The idiomatic Chinese for "for the love of the game"; a
              literal translation of that phrase reads as nothing anyone says. */}
          {/* The sign-off, with the accounts alongside it on narrow screens
              where the handle's hover sequence cannot be used. */}
          <div className="flex items-center justify-between gap-4">
            <p className="font-chinese text-foreground/60" lang="zh-Hans">
              因为热爱
            </p>
            <SocialIcons className="sm:hidden" />
          </div>
        </article>

        {/* Reserved. Intentionally empty until the side details land. */}
        <aside className="side" aria-hidden="true" />
      </div>
    </main>
  );
}
