import Link from "next/link";
import { redirect } from "next/navigation";
import Icon from "@/components/icons";
import LoginForm from "@/components/dashboard/LoginForm";
import { ADMIN_EMAILS, devSignInAllowed, getSession, googleConfigured } from "@/lib/auth";

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
    // Centred in the window. The height is the viewport less the dashboard
    // layout's own vertical padding, so it never adds a scrollbar.
    <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center sm:min-h-[calc(100dvh-7rem)]">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header className="mb-2 flex items-baseline justify-between gap-4">
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

        <LoginForm
          google={googleConfigured()}
          devEmail={devSignInAllowed() ? ADMIN_EMAILS[0] : undefined}
        />
      </div>
    </div>
  );
}
