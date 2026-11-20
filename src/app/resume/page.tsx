import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/icons";
import SectionHeader from "@/components/work/SectionHeader";
import { RESUME, type ResumeEntry } from "@/lib/resume";
import { renderInline } from "@/lib/richtext";
import { PROFILE, SITE } from "@/lib/site";

/**
 * odiwr.com/resume. The résumé in the site's own type: the 640px column, one
 * size, hierarchy from weight and colour, the same headings and arrows as the
 * home page. The PDF is one click away for anyone who needs the file.
 *
 * Printed, it drops the dark background (see .resume in globals.css), so
 * printing the page is as good as printing the PDF.
 */

export const metadata: Metadata = {
  title: "Résumé",
  description: `${SITE.fullName}: education, experience, projects and skills.`,
  alternates: { canonical: "/resume" },
  openGraph: { title: `Résumé — ${SITE.name}`, url: `${SITE.url}/resume` },
};

const LINK =
  "inline-flex items-center gap-1.5 underline decoration-foreground/30 decoration-1 underline-offset-[2.5px] transition-colors hover:text-accent hover:decoration-accent";

const OUT = { target: "_blank", rel: "noreferrer noopener" } as const;

/** The entry's name, linked when it has somewhere to go: a page here, or off-site. */
function EntryTitle({ entry }: { entry: ResumeEntry }) {
  if (!entry.href) return <>{entry.title}</>;
  if (entry.href.startsWith("/")) {
    return (
      <Link href={entry.href} className={LINK}>
        {entry.title}
        <Icon name="material-symbols:arrow-right-alt-rounded" />
      </Link>
    );
  }
  return (
    <a href={entry.href} {...OUT} className={LINK}>
      {entry.title}
      <Icon name="material-symbols:arrow-outward-rounded" />
    </a>
  );
}

function Entry({ entry, id }: { entry: ResumeEntry; id: string }) {
  const sub = [entry.detail, entry.where].filter(Boolean).join(" · ");
  return (
    <div>
      {/* Dates pushed to the right edge, like the blog's; they wrap under the
          name on a phone rather than squeezing it. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3>
          <EntryTitle entry={entry} />
        </h3>
        {entry.when && <span className="shrink-0 text-foreground/50">{entry.when}</span>}
      </div>
      {sub && <p className="text-foreground/50">{sub}</p>}
      {entry.points?.length ? (
        <ul className="rich-list mt-2 text-foreground/80">
          {entry.points.map((point, i) => (
            <li key={i}>{renderInline(point, `${id}-${i}`)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Section({ heading, entries }: { heading: string; entries: ResumeEntry[] }) {
  return (
    <section>
      <h2 className="text-foreground/50">{heading}</h2>
      <div className="mt-4 flex flex-col gap-6">
        {entries.map((entry) => (
          <Entry key={entry.title} entry={entry} id={entry.title} />
        ))}
      </div>
    </section>
  );
}

export default function ResumePage() {
  return (
    <main className="page resume">
      <div className="page-grid">
        <div className="top-fade" aria-hidden="true" />

        <article className="prose enter">
          <SectionHeader title="Résumé" />

          <div>
            <p className="font-medium">{SITE.fullName}</p>
            <p className="text-foreground/50">
              {RESUME.location} ·{" "}
              <a href={SITE.mailto} className={LINK}>
                {SITE.email}
              </a>{" "}
              ·{" "}
              <a href={PROFILE.GitHub} {...OUT} className={LINK}>
                GitHub
              </a>{" "}
              ·{" "}
              <a href={PROFILE.LinkedIn} {...OUT} className={LINK}>
                LinkedIn
              </a>
            </p>
          </div>

          <p className="no-print text-foreground/80">
            <a href={RESUME.pdf} {...OUT} className={LINK}>
              One page, as a PDF
              <Icon name="material-symbols:arrow-outward-rounded" />
            </a>{" "}
            <span className="text-foreground/50">· {RESUME.updated}</span>
          </p>

          <Section heading="Education" entries={RESUME.education} />
          <Section heading="Experience" entries={RESUME.experience} />
          <Section heading="Projects" entries={RESUME.projects} />

          <section>
            <h2 className="text-foreground/50">Skills</h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
              {RESUME.skills.map(([label, list]) => (
                <div key={label} className="contents">
                  <dt className="text-foreground/50">{label}</dt>
                  <dd className="text-foreground/80">{list}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="text-foreground/50">Honors &amp; awards</h2>
            <ul className="rich-list mt-4 text-foreground/80">
              {RESUME.honors.map((honor) => (
                <li key={honor}>{honor}</li>
              ))}
            </ul>
          </section>
        </article>

        <aside className="side" aria-hidden="true" />
      </div>
    </main>
  );
}
