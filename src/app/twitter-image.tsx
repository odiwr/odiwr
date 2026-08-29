/**
 * X uses its own convention, and Next does not fall back to the Open Graph
 * image for it. The renderer is re-exported so there is one design, but
 * `runtime` has to be declared here: Next parses these route-segment exports
 * statically and refuses a re-exported one.
 */
export { default, size, contentType, alt } from "./opengraph-image";

export const runtime = "nodejs";
