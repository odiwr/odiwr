/**
 * The résumé, as data: what odiwr.com/resume renders.
 *
 * Copied from the one-page PDF (public/bill-odiwuor-kawaka-resume.pdf, the
 * Sep 2026 version), so the page and the download say the same thing. Change
 * both together: edit here, and replace the PDF with the new export.
 *
 * Text takes the blog's markers: **bold** for what the PDF sets in bold.
 */

export type ResumeEntry = {
  /** The role, school or project. */
  title: string;
  /** Where the title links: a page here ("/memory-mission") or off-site. */
  href?: string;
  /** The line under it: the degree, the organisation, the stack. */
  detail?: string;
  /** Dates, as written on the PDF. */
  when?: string;
  where?: string;
  points?: string[];
};

export const RESUME = {
  /** Served from /public. Named for whoever saves it. */
  pdf: "/bill-odiwuor-kawaka-resume.pdf",
  /** Shown beside the download, so an old copy is recognisable. */
  updated: "September 2026",
  location: "New Jersey",

  education: [
    {
      title: "Rutgers University",
      detail: "B.S. Electrical & Computer Engineering",
      when: "Expected May 2029",
      where: "New Brunswick, NJ",
    },
    {
      title: "Princeton University",
      detail: "Transfer Scholars Initiative ’25, Freshman Scholars Institute ’26",
      when: "Jun 2025 – Aug 2026",
      where: "Princeton, NJ",
    },
    {
      title: "Middlesex College",
      detail: "A.S. in Computer Science, GPA: 4.0",
      when: "Jul 2024 – May 2026",
      where: "Edison, NJ",
    },
  ],

  experience: [
    {
      title: "Chief Technology Officer, Memory Mission",
      href: "/memory-mission",
      detail: "Nonprofit, part-time",
      when: "Jul 2026 – Present",
      where: "New Brunswick, NJ",
      points: [
        "Founding technical lead and sole engineer of a 501(c)(3) memory-science research nonprofit’s entire digital infrastructure. **~49,500 lines of TypeScript** on Next.js 16 / React 19, with a hand-rolled CMS since migrated onto Payload 3.88 + the Puck visual page builder so staff publish without touching code / Postgres, Cloudflare R2 media storage, Resend for transactional email and newsletters, Google OAuth with role-based access across **20 granular permissions**, an append-only audit log on every write, and GA4, deployed on Vercel.",
        "Integrated the Anthropic API (claude-opus-5) into the staff newsletter composer so editors rewrite drafts in place with tone presets, degrading gracefully without configured keys.",
      ],
    },
    {
      title: "Course Fellow, POL/SOC 245: Visualizing Data, Princeton University",
      detail: "Freshman Scholars Institute",
      when: "Apr – Aug 2026",
      where: "Princeton, NJ",
      points: [
        "Sole Course Fellow for a seven-week R course serving 22 incoming Princeton first-years, most of whom had never written code; all finished building & presenting original visualizations. 25+ hrs/week under Prof. Vikram Ramaswamy.",
        "Graded coding work, ran three office-hour blocks a week, and **taught a full precept solo** during final project proposals as well as authoring a weekly “Data Discourse” prompt on Ed Discussions for student discussion & debate.",
      ],
    },
    {
      title: "President, Computer Science Club, Middlesex College",
      detail: "Part-time",
      when: "Jan 2025 – May 2026",
      where: "Edison, NJ",
      points: [
        "Led one of the three largest clubs on campus, sustaining ~30 recurring members per semester.",
        "Designed and taught two 9-week workshop series (HTML/CSS/JavaScript; Python/Pygame), taking students with no prior coding experience to a deployed personal site and a finished game; capped each with a showcase competition.",
      ],
    },
  ],

  projects: [
    {
      title: "BestTime",
      href: "https://github.com/odiwr/BestTime",
      detail: "TypeScript, Web Components, npm (MIT)",
      points: [
        "Open-sourced a timeline component as three npm packages (besttime, @besttime/react, @besttime/core) that compress empty history into marked breaks and zoom continuously. 17 kB gzipped, 82 CI tests.",
      ],
    },
    {
      title: "ume",
      href: "https://github.com/odiwr/ume",
      detail: "Node.js, discord.js, Electron, Cloudflare R2",
      points: [
        "24/7 Discord radio bot streaming a cloud-hosted library through presigned S3 URLs, with slash commands, persisted queue state, and ffmpeg/Opus encoding into live voice channels; shipped an Electron desktop panel for non-technical moderators.",
      ],
    },
  ],

  skills: [
    ["Languages", "TypeScript, JavaScript, Python, Java, C#, C++, R (+Tidyverse), SQL"],
    ["Web", "Next.js, React, Node.js, Tailwind, Web Components, Prisma, PostgreSQL"],
    ["AI", "Anthropic API (Claude), Claude Code / agentic dev workflows, prompt design"],
    ["Tools", "Git & GitHub Actions, Docker, Vitest, Vercel, Cloudflare R2, Unity, Electron"],
  ],

  honors: [
    "TechConnect Workforce Travel Grant (Nov 2025)",
    "Scholarships: Southpole Foundation (Aug 2025) / Kodavatiganti Family (Aug 2025)",
    "Coca-Cola Leader of Promise Scholarship (PTK, Aug 2025)",
    "Phi Theta Kappa Honor Society (PTK, Feb 2025) & Tri-Alpha Honor Society (Nov 2025)",
    "Dr Fannie Lockhart Gordon Award (Educational Opportunity Fund, Aug 2024)",
  ],
} satisfies {
  pdf: string;
  updated: string;
  location: string;
  education: ResumeEntry[];
  experience: ResumeEntry[];
  projects: ResumeEntry[];
  skills: [string, string][];
  honors: string[];
};
