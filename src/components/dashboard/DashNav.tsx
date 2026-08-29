"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Analytics" },
  { href: "/dashboard/work", label: "Work" },
  { href: "/dashboard/blog", label: "Blog" },
  { href: "/dashboard/media", label: "Media" },
];

export default function DashNav() {
  const path = usePathname();

  return (
    <nav className="mb-10 flex flex-wrap gap-5 text-foreground/40">
      {NAV.map((item) => {
        // Analytics is an exact match; the others own everything beneath them,
        // so an editor page keeps its section lit.
        const active =
          item.href === "/dashboard" ? path === item.href : path.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={active ? "text-accent" : "transition-colors hover:text-accent"}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
