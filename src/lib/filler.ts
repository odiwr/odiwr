import type { Content, Section, Work } from "./content";
import { sectionWork } from "./content";
import { PROFILE } from "./site";

/**
 * Landing-page filler.
 *
 * Shown in a column ONLY while that section has nothing real in it, so each one
 * disappears by itself the moment the first entry is published — there is
 * nothing to remember to delete. Deliberately not part of the subdomain
 * listings, which stay honest and say there is nothing there.
 *
 * The links are profiles already declared in site.ts rather than invented URLs.
 */
const FILLER: Record<Section, Work[]> = {
  current: [
    {
      id: "filler-current-1",
      section: "current",
      title: "work1",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      href: PROFILE.GitHub,
      stack: ["cpp", "arduino"],
    },
  ],
  projects: [
    {
      id: "filler-projects-1",
      section: "projects",
      title: "work1",
      description: "Sed do eiusmod tempor incididunt ut labore et dolore magna.",
      href: PROFILE.GitHub,
      stack: ["typescript", "next", "postgres"],
    },
    {
      id: "filler-projects-2",
      section: "projects",
      title: "work2",
      description: "Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
      href: PROFILE.GitHub,
      stack: ["rust", "linux"],
    },
    {
      id: "filler-projects-3",
      section: "projects",
      title: "work3",
      description: "Duis aute irure dolor in reprehenderit in voluptate velit.",
      href: PROFILE.GitHub,
      stack: ["python", "raspberrypi"],
    },
  ],
  creative: [
    {
      id: "filler-creative-1",
      section: "creative",
      title: "work1",
      description: "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
      href: PROFILE.Instagram,
    },
    {
      id: "filler-creative-2",
      section: "creative",
      title: "work2",
      description: "Qui officia deserunt mollit anim id est laborum et dolore.",
      href: PROFILE.Instagram,
    },
  ],
};

const HEADINGS: Record<Section, string> = {
  current: "Current",
  projects: "Projects",
  creative: "Creative",
};

/**
 * The three landing-page columns.
 *
 * Pinned work once a section has any; filler only while the section is empty.
 * A section with real but unpinned work shows nothing, which is the point of
 * pinning.
 */
export function columnsFor(content: Content) {
  return (Object.keys(FILLER) as Section[]).map((section) => {
    const real = sectionWork(content, section);
    const pinned = real.filter((w) => w.pinned);
    return {
      heading: HEADINGS[section],
      items: pinned.length ? pinned : real.length ? [] : FILLER[section],
    };
  });
}
