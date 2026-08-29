import { ICONS, type IconName } from "./data";

/**
 * An Iconify icon, drawn from data extracted at build time.
 *
 * Renders the SVG body inline rather than going through @iconify/react's own
 * component, which by default fetches unknown icons from the Iconify API at
 * runtime — a network request per icon, and nothing at all if the visitor is
 * offline or the API is down. Everything needed is already in the bundle.
 *
 * Sized in `em` so an icon tracks the text it sits beside, and filled with
 * `currentColor` so it inherits the colour of its container, including hover
 * and focus states, without being told about them.
 */
export default function Icon({
  name,
  size = "1em",
  className,
  title,
}: {
  name: IconName;
  size?: string | number;
  className?: string;
  /** Only set this when the icon is the sole content of a control. */
  title?: string;
}) {
  const icon = ICONS[name];
  return (
    <svg
      viewBox={`0 0 ${icon.width} ${icon.height}`}
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ display: "inline-block", verticalAlign: "-0.125em", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}

export type { IconName };
