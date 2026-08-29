import { stackTitle } from "@/lib/stack-index";

/**
 * A brand mark, drawn as a mask rather than inline SVG.
 *
 * The artwork comes from /icon as an external file, so none of the three
 * thousand available brands are in the bundle; painting it as a mask over
 * currentColor keeps it tinting with the text around it, which a plain <img>
 * would not.
 */
export default function Brand({
  slug,
  size = "1em",
  className = "",
}: {
  /** "prefix:name", e.g. "simple-icons:rust". */
  slug: string;
  size?: string;
  className?: string;
}) {
  const [prefix, name] = slug.split(":");
  const url = `url(/icon/${prefix}/${encodeURIComponent(name ?? "")})`;
  return (
    <span
      role="img"
      aria-label={stackTitle(slug)}
      title={stackTitle(slug)}
      className={`inline-block shrink-0 bg-current align-[-0.125em] ${className}`}
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
