import type { Viewport } from "next";
import { BAND_CSS } from "@/lib/portfolio";
import "./portfolio.css";

/**
 * Everything on portfolio.odiwr.com: the site's own frame and entrance, on
 * white where the rest of the site is dark. portfolio.css swaps the colours for
 * any body holding a .pxs, so the root layout serves it as it is.
 */

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pxs">
      {/* The grid's bands (lib/portfolio.ts). Generated from the same table the
          rows are cut with, so the two cannot disagree. */}
      <style dangerouslySetInnerHTML={{ __html: BAND_CSS }} />
      {children}
    </div>
  );
}
