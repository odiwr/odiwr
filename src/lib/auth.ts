// SERVER-ONLY. Session + Google OAuth for the custom dashboard at /dashboard.
//
// Deliberately dependency-free: Google's OAuth2 endpoints are plain HTTP, and
// the session is a signed cookie (HMAC-SHA256 over a JSON payload, keyed by
// PAYLOAD_SECRET). Nothing here is imported from a client component.
//
// Access is allow-list only — see ADMIN_EMAILS below. Anyone who authenticates
// with Google but isn't on the list is rejected at the callback, so a stray
// Google account can never hold a dashboard session.
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "odiwr_admin";
export const OAUTH_STATE_COOKIE = "odiwr_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Emails allowed into the dashboard. Comma-separated env override. */
export const ADMIN_EMAILS: string[] = (
  process.env.ADMIN_EMAILS || "billkawaka0@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export type Session = {
  email: string;
  name: string;
  picture: string;
  /** Unix seconds. */
  exp: number;
};

function secret(): string {
  // PAYLOAD_SECRET is accepted as well so the value carried over from the old
  // site keeps working; there is no Payload here.
  const s = process.env.SESSION_SECRET || process.env.PAYLOAD_SECRET;
  if (!s) throw new Error("SESSION_SECRET is required to sign dashboard sessions");
  return s;
}

const b64url = (b: Buffer) => b.toString("base64url");

function sign(data: string): string {
  return b64url(createHmac("sha256", secret()).update(data).digest());
}

/** Constant-time compare that tolerates length mismatch without throwing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function encodeSession(s: Session): string {
  const body = b64url(Buffer.from(JSON.stringify(s)));
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(body))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (!s?.email || typeof s.exp !== "number") return null;
    if (s.exp * 1000 < Date.now()) return null;
    // Re-check the allow-list on every read: revoking access is then just an
    // env change, with no need to hunt down already-issued cookies.
    if (!ADMIN_EMAILS.includes(s.email.toLowerCase())) return null;
    return s;
  } catch {
    return null;
  }
}

/** The current dashboard session, or null. Safe to call from any server code. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

/**
 * Guard for server actions and route handlers. Throws rather than redirecting
 * so a mutation can never run half-authenticated — the dashboard layout is what
 * redirects unauthenticated *page* loads to /dashboard/login.
 */
export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}

export async function setSessionCookie(profile: {
  email: string;
  name?: string;
  picture?: string;
}): Promise<void> {
  const store = await cookies();
  const session: Session = {
    email: profile.email.toLowerCase(),
    name: profile.name || profile.email,
    picture: profile.picture || "",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  store.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/* ------------------------------------------------------------------ */
/* Google OAuth                                                        */
/* ------------------------------------------------------------------ */

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Absolute callback URL. Must exactly match a Google console redirect URI. */
export function callbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/dashboard/auth/callback`;
}

export function newState(): string {
  return randomBytes(16).toString("hex");
}

export function googleAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: callbackUrl(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    // Always show the account chooser — this is a single-user dashboard and
    // silently resuming the wrong Google session is just a confusing rejection.
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH}?${params}`;
}

type GoogleProfile = { email: string; name?: string; picture?: string };

/**
 * Exchange an authorization code for the user's profile.
 *
 * The id_token comes straight from Google's token endpoint over TLS in response
 * to our client-secret-authenticated request, so its claims are trustworthy
 * without a separate signature check (this is the documented behaviour for the
 * direct code-exchange flow — signature verification matters when a token
 * arrives from somewhere other than Google itself).
 */
export async function exchangeCode(
  code: string,
  origin: string
): Promise<GoogleProfile | null> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: callbackUrl(origin),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) return null;

  const payload = data.id_token.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!claims.email || claims.email_verified === false) return null;
    return { email: claims.email, name: claims.name, picture: claims.picture };
  } catch {
    return null;
  }
}

export function isAllowed(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
