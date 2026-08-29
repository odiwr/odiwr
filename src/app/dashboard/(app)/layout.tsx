import { redirect } from "next/navigation";
import Icon from "@/components/icons";
import { getSession } from "@/lib/auth";
import DashNav from "@/components/dashboard/DashNav";

/**
 * Everything behind the sign-in.
 *
 * A route group rather than a check in each page: the login page lives outside
 * it, so the guard can redirect unconditionally without looping.
 */

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/dashboard/login");

  return (
    <>
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <a
          href="/"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-accent"
        >
          site
          <Icon name="material-symbols:arrow-outward-rounded" />
        </a>
        <form action="/dashboard/auth/logout" method="post">
          <button type="submit" className="text-foreground/50 transition-colors hover:text-accent">
            Sign out
          </button>
        </form>
      </header>

      <DashNav />

      {children}
    </>
  );
}
