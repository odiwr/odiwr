// SERVER-ONLY. Google Analytics 4 Data API client.
//
// Dependency-free, same as lib/auth.ts: a service-account JWT is signed with
// node's crypto, exchanged for an access token, and used against the Data API's
// REST endpoints. The official @google-analytics/data package pulls in the whole
// gRPC stack for what amounts to two POSTs.
//
// Everything here degrades rather than throws — an unconfigured or failing
// analytics API must never take the dashboard down.
import { createSign } from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const API = "https://analyticsdata.googleapis.com/v1beta";

export function analyticsConfigured(): boolean {
  return Boolean(
    process.env.GA_PROPERTY_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  );
}

/**
 * The PEM as stored in .env, where real newlines can't survive. Accepts either
 * escaped "\n" sequences or a genuinely multi-line value.
 */
function privateKey(): string {
  return (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "").replace(/\\n/g, "\n").trim();
}

const b64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64url");

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

let tokenCache: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  // Google's tokens last an hour; refresh a little early to avoid racing expiry.
  if (tokenCache && tokenCache.expires > Date.now() + 60_000) return tokenCache.token;

  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(privateKey()).toString("base64url");
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google rejected the service account: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expires: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

/* ------------------------------------------------------------------ */
/* Report shapes                                                       */
/* ------------------------------------------------------------------ */

type ApiRow = {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
};
type ApiReport = { rows?: ApiRow[] };

export type Totals = {
  users: number;
  sessions: number;
  pageViews: number;
  avgSessionSeconds: number;
  bounceRate: number; // 0–1
};

export type NamedValue = { label: string; value: number };

export type AnalyticsData = {
  range: number;
  current: Totals;
  previous: Totals;
  series: { label: string; value: number }[];
  topPages: { path: string; views: number; users: number }[];
  channels: NamedValue[];
  countries: NamedValue[];
  devices: NamedValue[];
};

export type AnalyticsResult =
  | { status: "ok"; data: AnalyticsData }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

const num = (r: ApiRow | undefined, i: number) => Number(r?.metricValues?.[i]?.value ?? 0);
const dim = (r: ApiRow, i = 0) => r.dimensionValues?.[i]?.value ?? "";

function toTotals(row: ApiRow | undefined): Totals {
  return {
    users: num(row, 0),
    sessions: num(row, 1),
    pageViews: num(row, 2),
    avgSessionSeconds: num(row, 3),
    bounceRate: num(row, 4),
  };
}

function toNamed(report: ApiReport | undefined): NamedValue[] {
  return (report?.rows ?? []).map((r) => ({ label: dim(r) || "(not set)", value: num(r, 0) }));
}

/** GA returns dates as "20260820"; the charts want something readable. */
function formatGaDate(raw: string): string {
  if (!/^\d{8}$/.test(raw)) return raw;
  const d = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

async function batch(token: string, requests: unknown[]): Promise<ApiReport[]> {
  const res = await fetch(`${API}/properties/${process.env.GA_PROPERTY_ID}:batchRunReports`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ requests }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    // The API's own message is far more useful than a status code — surface it.
    let message = detail.slice(0, 300);
    try {
      message = (JSON.parse(detail) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      /* keep the raw body */
    }
    throw new Error(message);
  }

  const body = (await res.json()) as { reports?: ApiReport[] };
  return body.reports ?? [];
}

const METRICS = [
  { name: "activeUsers" },
  { name: "sessions" },
  { name: "screenPageViews" },
  { name: "averageSessionDuration" },
  { name: "bounceRate" },
];

// TTL cache — GA4 has a daily request quota per property, and a dashboard that
// re-queries on every navigation burns it for no benefit.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<number, { t: number; data: AnalyticsData }>();

export async function getAnalytics(days = 28): Promise<AnalyticsResult> {
  if (!analyticsConfigured()) return { status: "unconfigured" };

  const hit = cache.get(days);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return { status: "ok", data: hit.data };

  try {
    const token = await accessToken();

    const current = { startDate: `${days}daysAgo`, endDate: "today" };
    // The immediately preceding window of the same length, for the deltas.
    const previous = { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo` };

    // batchRunReports caps at 5 reports per call, hence the split.
    const [totalsReport, seriesReport, pagesReport, channelsReport] = await batch(token, [
      { dateRanges: [current, previous], metrics: METRICS },
      {
        dateRanges: [current],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: 400,
      },
      {
        dateRanges: [current],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 10,
      },
      {
        dateRanges: [current],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 6,
      },
    ]);

    const [countriesReport, devicesReport] = await batch(token, [
      {
        dateRanges: [current],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 6,
      },
      {
        dateRanges: [current],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 4,
      },
    ]);

    // With two date ranges the API returns one row per range, in order.
    const rows = totalsReport?.rows ?? [];

    const data: AnalyticsData = {
      range: days,
      current: toTotals(rows[0]),
      previous: toTotals(rows[1]),
      series: (seriesReport?.rows ?? []).map((r) => ({
        label: formatGaDate(dim(r)),
        value: num(r, 0),
      })),
      topPages: (pagesReport?.rows ?? []).map((r) => ({
        path: dim(r) || "/",
        views: num(r, 0),
        users: num(r, 1),
      })),
      channels: toNamed(channelsReport),
      countries: toNamed(countriesReport),
      devices: toNamed(devicesReport),
    };

    cache.set(days, { t: Date.now(), data });
    return { status: "ok", data };
  } catch (e) {
    // Serve stale data rather than an error screen if we ever had some.
    if (hit) return { status: "ok", data: hit.data };
    return { status: "error", message: e instanceof Error ? e.message : "Analytics request failed" };
  }
}

/** Percentage change between two periods. null when there's no baseline. */
export function pctChange(now: number, before: number): number | null {
  if (!before) return now ? null : 0;
  return ((now - before) / before) * 100;
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}
