import type { Metadata } from "next";

/** Never indexed, and never linked from the site. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-4xl px-6 py-10 sm:py-14">{children}</main>;
}
