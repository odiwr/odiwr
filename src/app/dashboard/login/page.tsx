import Link from "next/link";
import { redirect } from "next/navigation";
import Icon from "@/components/icons";
import { getSession, googleConfigured } from "@/lib/auth";

const MESSAGES: Record<string, string> = {
  denied: "That account is not allowed in.",
  state: "Sign-in expired. Try again.",
  exchange: "Google rejected the sign-in.",
  config: "Google sign-in is not configured.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-foreground/50 transition-colors hover:text-accent"
        >
          <Icon name="material-symbols:arrow-left-alt-rounded" />
          Back
        </Link>
        <span className="font-medium">Dashboard</span>
      </header>

      {error && <p className="text-accent">{MESSAGES[error] ?? "Sign-in failed."}</p>}

      {googleConfigured() ? (
        // A route handler, not a page: it redirects straight out to Google, so a
        // client-side navigation has nothing to render.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a
          href="/dashboard/auth/google"
          className="inline-flex w-max items-center gap-1.5 underline decoration-foreground/30 decoration-1 underline-offset-[2.5px] transition-colors hover:text-accent hover:decoration-accent"
        >
          Continue with Google
          <Icon name="material-symbols:arrow-right-alt-rounded" />
        </a>
      ) : (
        <p className="text-foreground/50">
          Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable sign-in.
        </p>
      )}

    </div>
  );
}
