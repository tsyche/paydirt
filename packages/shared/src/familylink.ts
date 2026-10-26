// Pure helpers for the Family Link bonus-time grant (no I/O — unit-tested).
// Consumed by scripts/familylink-grant.mjs, which supplies the browser session.
//
// The grant is one POST to timeLimitOverrides:batchCreate, shaped like the call
// familylink.google.com makes. The real request is sent as a CORS "simple"
// request (Content-Type text/plain); the actual headers ride in the
// `$httpHeaders` query param, the way Google's JSPB web clients do it.

import crypto from "node:crypto";

export const FL_ORIGIN = "https://familylink.google.com";
const FL_API = "https://kidsmanagement-pa.clients6.google.com/kidsmanagement/v1";

export const MIN_GRANT_SECONDS = 60;
export const MAX_GRANT_SECONDS = 4 * 60 * 60;

/** Parse a grant duration; integer seconds within [MIN, MAX]. */
export function parseGrantSeconds(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error(`Grant seconds must be a whole number, got: ${raw ?? "(none)"}`);
  }
  const n = Number(raw);
  if (n < MIN_GRANT_SECONDS || n > MAX_GRANT_SECONDS) {
    throw new Error(`Grant seconds must be ${MIN_GRANT_SECONDS}-${MAX_GRANT_SECONDS}, got: ${n}`);
  }
  return n;
}

const ID_PATTERNS = {
  childId: /^\d{10,30}$/,
  deviceId: /^[a-z0-9]{20,80}$/,
  apiKey: /^AIza[0-9A-Za-z_-]{35}$/,
} as const;

/** Validate an ID/key before it is interpolated into a URL or body. */
export function assertFamilyLinkId(kind: keyof typeof ID_PATTERNS, value: string | undefined): string {
  if (!value || !ID_PATTERNS[kind].test(value)) {
    throw new Error(`Invalid or missing ${kind}`);
  }
  return value;
}

/** JSPB body: `[null,childId,[[null,null,10,deviceId,null×9,[["<seconds>",0]]]],[1]]`. */
export function buildGrantBody(childId: string, deviceId: string, seconds: number): string {
  const override = [null, null, 10, deviceId, ...Array(9).fill(null), [[String(seconds), 0]]];
  return JSON.stringify([null, childId, [override], [1]]);
}

/** `<prefix> <ts>_<sha1("<ts> <cookie> <origin>")>` — Google's first-party auth hash. */
export function sapisidHash(prefix: string, cookie: string, origin: string, ts: number): string {
  const digest = crypto.createHash("sha1").update(`${ts} ${cookie} ${origin}`).digest("hex");
  return `${prefix} ${ts}_${digest}`;
}

/** Thrown when the session lacks what a grant needs — caller should re-login. */
export class FamilyLinkAuthError extends Error {}

/**
 * Build the Authorization header value from the session's cookies. The web
 * app sends SAPISIDHASH only (no 1P/3P variants; captured 2026-10-25).
 */
export function buildAuthorization(
  cookies: { name: string; value: string }[],
  origin: string,
  ts: number,
): string {
  const sapisid = cookies.find((c) => c.name === "SAPISID")?.value;
  if (!sapisid) {
    throw new FamilyLinkAuthError("No SAPISID cookie — session missing or expired");
  }
  return sapisidHash("SAPISIDHASH", sapisid, origin, ts);
}

/**
 * batchCreate URL with the real headers packed into `$httpHeaders`, in the
 * web app's order. It also sends three opaque `x-goog-ext-*-bin` headers,
 * omitted here; add them only if Google starts rejecting grants without them.
 */
export function buildGrantUrl(childId: string, apiKey: string, authorization: string): string {
  const headers = [
    "Content-Type: application/json+protobuf",
    "X-Goog-AuthUser: 0",
    `Authorization: ${authorization}`,
    `X-Goog-Api-Key: ${apiKey}`,
  ]
    .map((h) => `${h}\r\n`)
    .join("");
  return `${FL_API}/people/${childId}/timeLimitOverrides:batchCreate?$httpHeaders=${encodeURIComponent(headers)}`;
}

export type GrantOutcome = "ok" | "auth" | "error";

/** 2xx → ok; 401/403 → auth (re-login); anything else → error. */
export function classifyGrantStatus(status: number): GrantOutcome {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401 || status === 403) return "auth";
  return "error";
}
