import Link from "next/link";
import {
  getAnalytics,
  pctChange,
  formatDuration,
  type AnalyticsData,
  type NamedValue,
} from "@/lib/analytics";

/** Always live; a cached dashboard is a lying dashboard. */
export const dynamic = "force-dynamic";

const RANGES = [7, 28, 90];
const n = new Intl.NumberFormat("en-US");

function Delta({ now, before }: { now: number; before: number }) {
  // Nothing either side is not a 0% change, it is no reading at all.
  if (!now && !before) return null;
  const pct = pctChange(now, before);
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={up ? "text-accent" : "text-foreground/40"}>
      {up ? "+" : ""}
      {pct.toFixed(0)}%
    </span>
  );
}

function Stat({
  label,
  value,
  now,
  before,
}: {
  label: string;
  value: string;
  now: number;
  before: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-foreground/40">{label}</span>
      <span className="flex items-baseline gap-2">
        {value}
        <Delta now={now} before={before} />
      </span>
    </div>
  );
}

/** Daily active users. Bars rather than a chart library for five kilobytes. */
function Series({ series }: { series: AnalyticsData["series"] }) {
  const peak = Math.max(1, ...series.map((d) => d.value));
  return (
    <div className="flex h-20 items-end gap-px" aria-hidden="true">
      {series.map((day) => (
        <span
          key={day.label}
          title={`${day.label}: ${day.value}`}
          className="flex-1 bg-foreground/25"
          style={{ height: `${Math.max(2, (day.value / peak) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function List({ title, rows }: { title: string; rows: NamedValue[] }) {
  if (!rows.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-foreground/40">{title}</span>
      {rows.slice(0, 5).map((row) => (
        <span key={row.label} className="flex justify-between gap-4">
          <span className="truncate">{row.label || "—"}</span>
          <span className="shrink-0 text-foreground/50">{n.format(row.value)}</span>
        </span>
      ))}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: raw } = await searchParams;
  const days = RANGES.includes(Number(raw)) ? Number(raw) : 28;
  const result = await getAnalytics(days);

  return (
    <div className="flex flex-col gap-10">
      <nav className="flex justify-end gap-5 text-foreground/40">
        {RANGES.map((range) => (
          <Link
            key={range}
            href={`/dashboard?days=${range}`}
            className={`transition-colors hover:text-accent ${
              range === days ? "text-foreground" : ""
            }`}
          >
            {range}d
          </Link>
        ))}
      </nav>

      {result.status === "unconfigured" && (
        <p className="text-foreground/50">
          Analytics is not configured. Set GA_PROPERTY_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and
          GOOGLE_SERVICE_ACCOUNT_KEY.
        </p>
      )}

      {result.status === "error" && <p className="text-accent">{result.message}</p>}

      {result.status === "ok" && (
        <>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            <Stat
              label="Users"
              value={n.format(result.data.current.users)}
              now={result.data.current.users}
              before={result.data.previous.users}
            />
            <Stat
              label="Sessions"
              value={n.format(result.data.current.sessions)}
              now={result.data.current.sessions}
              before={result.data.previous.sessions}
            />
            <Stat
              label="Views"
              value={n.format(result.data.current.pageViews)}
              now={result.data.current.pageViews}
              before={result.data.previous.pageViews}
            />
            <Stat
              label="Avg session"
              value={formatDuration(result.data.current.avgSessionSeconds)}
              now={result.data.current.avgSessionSeconds}
              before={result.data.previous.avgSessionSeconds}
            />
            <Stat
              label="Bounce"
              value={`${Math.round(result.data.current.bounceRate * 100)}%`}
              now={result.data.current.bounceRate}
              before={result.data.previous.bounceRate}
            />
          </div>

          {result.data.series.length > 0 && <Series series={result.data.series} />}

          {result.data.topPages.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-foreground/40">Pages</span>
              {result.data.topPages.slice(0, 8).map((page) => (
                <span key={page.path} className="flex justify-between gap-4">
                  <span className="truncate">{page.path}</span>
                  <span className="shrink-0 text-foreground/50">{n.format(page.views)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="grid gap-8 sm:grid-cols-3">
            <List title="Channels" rows={result.data.channels} />
            <List title="Countries" rows={result.data.countries} />
            <List title="Devices" rows={result.data.devices} />
          </div>

          {result.data.current.users === 0 && (
            <p className="text-foreground/40">No data in this range.</p>
          )}
        </>
      )}
    </div>
  );
}
