"use client";

import { useRef } from "react";
import Icon from "@/components/icons";
import GoogleG from "@/components/icons/GoogleG";

/**
 * The sign-in.
 *
 * Google is the ONLY way in. The email and password form is a decoy: it has no
 * action, sends nothing anywhere, and whatever is typed into it is cleared and
 * answered with a warning. There are no passwords on this dashboard to check.
 *
 * On a local dev server without a Google client, the Google button signs in as
 * `devEmail` instead (see devSignInAllowed in lib/auth.ts). That prop is never
 * set in production.
 */

const GOOGLE_BUTTON = "btn flex w-full items-center justify-center gap-2.5";

export default function LoginForm({ google, devEmail }: { google: boolean; devEmail?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.current?.reset();
    dialog.current?.showModal();
  };

  return (
    <div className="flex flex-col gap-6">
      <form ref={form} onSubmit={onSubmit} className="flex flex-col gap-4" autoComplete="off">
        <label className="label">
          Email
          <input name="email" type="email" className="field" autoComplete="off" spellCheck={false} />
        </label>

        <label className="label">
          Password
          <input name="password" type="password" className="field" autoComplete="off" />
        </label>

        <button type="submit" className="btn btn-primary w-full">
          Login
        </button>
      </form>

      <div className="flex items-center gap-3 text-foreground/30" aria-hidden="true">
        <span className="h-px flex-1 bg-foreground/15" />
        or
        <span className="h-px flex-1 bg-foreground/15" />
      </div>

      {google ? (
        // A route handler, not a page: it redirects straight out to Google, so a
        // client-side navigation has nothing to render.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a href="/dashboard/auth/google" className={GOOGLE_BUTTON}>
          <GoogleG />
          Login with Google
        </a>
      ) : devEmail ? (
        <form action="/dashboard/auth/dev" method="post" className="flex flex-col gap-2">
          <button type="submit" className={GOOGLE_BUTTON}>
            <GoogleG />
            Login with Google
          </button>
          <p className="text-center text-foreground/40">
            Local only: signs in as {devEmail}, no Google.
          </p>
        </form>
      ) : (
        <p className="text-foreground/50">
          Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable sign-in.
        </p>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="login-warning-title"
        className="warning-dialog"
        // A click on the backdrop lands on the dialog itself; one inside the
        // panel lands on its content.
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="flex flex-col gap-4">
          <h2 id="login-warning-title" className="flex items-center gap-2 font-medium text-accent">
            <Icon name="material-symbols:warning-rounded" size="1.25em" />
            Unauthorized access is illegal
          </h2>
          <p className="text-foreground/80">
            This dashboard is private. Trying to get into a computer system without permission,
            including guessing or using someone else&rsquo;s credentials, is a crime under the
            Computer Fraud and Abuse Act (18 U.S.C. &sect; 1030) and similar laws elsewhere.
          </p>
          <form method="dialog" className="flex justify-end">
            <button type="submit" className="btn" autoFocus>
              Close
            </button>
          </form>
        </div>
      </dialog>
    </div>
  );
}
