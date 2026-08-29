import Icon from "@/components/icons";
import { SITE } from "@/lib/site";

/**
 * The accounts as icons, for narrow screens.
 *
 * The handle's hover sequence is a pointer interaction — there is no hover on a
 * phone, and making it a tap target turns a sentence into a control. So on
 * narrow screens the handle goes back to being plain text and the accounts move
 * here, in the open.
 */
export default function SocialIcons({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-4 ${className}`}>
      {SITE.profiles.map((p) => (
        <a
          key={p.label}
          href={p.href}
          aria-label={p.label}
          className="text-foreground/50 transition-colors hover:text-accent"
          {...(p.href.startsWith("http") ? { target: "_blank", rel: "noreferrer noopener" } : {})}
        >
          <Icon name={p.icon} size="1.15em" />
        </a>
      ))}
    </span>
  );
}
