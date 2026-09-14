import type { Metadata } from "next";
import VineArt from "@/components/notfound/VineArt";
import { HOME_HREF } from "@/lib/site";

/**
 * 404.
 *
 * A vine grows across the number, different on every visit (lib/vine.ts,
 * drawn by VineArt), under one line of text. The whole thing, number, vine and
 * text, is the way home: there is no separate back link.
 *
 * The number sits in the exact middle of the window. The line hangs below it,
 * out of the flow, rather than being counted in and pushing the number up.
 * With reduced motion the vine is simply there, fully grown.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center">
      <a
        href={HOME_HREF}
        aria-label="Page not found. Go to odiwr.com"
        className="group enter relative block w-full max-w-[640px] py-32"
      >
        <h1 className="sr-only">Page not found</h1>

        <VineArt />

        <p className="absolute inset-x-0 top-[calc(100%-8rem+2.5rem)] text-center text-foreground/80 transition-colors group-hover:text-foreground">
          This page doesn&rsquo;t exist, but here&rsquo;s something{" "}
          <span className="font-cursive">beautiful</span>.
        </p>
      </a>
    </main>
  );
}
