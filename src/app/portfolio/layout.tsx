import type { Viewport } from "next";
import { BAND_CSS } from "@/lib/portfolio";
import { cormorant, jost } from "./fonts";
import "./portfolio.css";

/**
 * Everything on portfolio.odiwr.com: white, where the rest of the site is dark.
 *
 * The root layout's <body> carries the site's colours and side margin;
 * portfolio.css undoes them for any body holding a .pxs, so this subdomain needs
 * no layout of its own above this one.
 */

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`pxs ${cormorant.variable} ${jost.variable}`}>
      {/* The grid's bands (lib/portfolio.ts). Generated from the same table the
          rows are cut with, so the two cannot disagree. */}
      <style dangerouslySetInnerHTML={{ __html: BAND_CSS }} />
      {children}
    </div>
  );
}
