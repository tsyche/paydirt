// Family Link bonus-time protocol and helpers.
// scripts/familylink-grant.mjs supplies the authenticated browser transport.
//
// Each grant reads appliedTimeLimits, then POSTs timeLimitOverrides:batchCreate
// with the remaining bonus plus the purchase. The POST is a CORS "simple"
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
  return buildApiUrl(childId, "timeLimitOverrides:batchCreate", apiKey, authorization);
}

export function buildAppliedTimeLimitsUrl(
  childId: string,
  apiKey: string,
  authorization: string,
): string {
  return buildApiUrl(childId, "appliedTimeLimits", apiKey, authorization);
}

function buildApiUrl(childId: string, endpoint: string, apiKey: string, authorization: string): string {
  const headers = [
    "Content-Type: application/json+protobuf",
    "X-Goog-AuthUser: 0",
    `Authorization: ${authorization}`,
    `X-Goog-Api-Key: ${apiKey}`,
  ]
    .map((h) => `${h}\r\n`)
    .join("");
  return `${FL_API}/people/${childId}/${endpoint}?$httpHeaders=${encodeURIComponent(headers)}`;
}

export type GrantOutcome = "ok" | "auth" | "error";

/** 2xx → ok; 401/403 → auth (re-login); anything else → error. */
export function classifyGrantStatus(status: number): GrantOutcome {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401 || status === 403) return "auth";
  return "error";
}

export type FamilyLinkRequest = (
  url: string,
  init: { method: "GET" | "POST"; body?: string },
) => Promise<{ status: number; text: string }>;

export interface FamilyLinkGrant {
  childId: string;
  deviceId: string;
  apiKey: string;
  authorization: string;
  seconds: number;
}

function unsignedInteger(value: unknown): number {
  if (
    (typeof value !== "string" || !/^\d+$/.test(value)) &&
    typeof value !== "number"
  ) {
    throw new Error("Invalid Family Link bonus timing");
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error("Invalid Family Link bonus timing");
  }
  return number;
}

/**
 * Read the active type-10 bonus for one device. Array positions come from the
 * observed 2026-10-28 appliedTimeLimits response, verified against its UI.
 * Use Google's server time, not the host clock; round up to preserve paid time.
 */
export function remainingBonusSeconds(payload: unknown, deviceId: string): number {
  if (!Array.isArray(payload) || !Array.isArray(payload[0]) || !Array.isArray(payload[1])) {
    throw new Error("Invalid Family Link applied time limits");
  }
  const serverTime = unsignedInteger(payload[0][1]);
  if (!serverTime) throw new Error("Missing Family Link server time");
  const rows = payload[1].filter((row: unknown) => Array.isArray(row) && row[25] === deviceId);
  if (rows.length !== 1) throw new Error("Missing or ambiguous Family Link device");
  const override: unknown = rows[0][0];
  if (override === null) return 0;
  if (!Array.isArray(override) || override[2] !== 10 || override[3] !== deviceId) {
    throw new Error("Unsupported Family Link active override");
  }
  const issuedAt = unsignedInteger(override[1]);
  const duration: unknown = Array.isArray(override[13]) ? override[13][0] : undefined;
  if (!Array.isArray(duration) || duration.length < 1 || duration.length > 2) {
    throw new Error("Missing Family Link bonus duration");
  }
  const seconds = unsignedInteger(duration[0]);
  const nanos = duration[1] === undefined ? 0 : unsignedInteger(duration[1]);
  const expiry = issuedAt + seconds * 1000 + nanos / 1e6;
  if (!issuedAt || issuedAt > serverTime || nanos >= 1e9 || expiry > Number.MAX_SAFE_INTEGER) {
    throw new Error("Invalid Family Link bonus timing");
  }
  return Math.ceil(Math.max(0, expiry - serverTime) / 1000);
}

async function checkedRequest(
  request: FamilyLinkRequest,
  url: string,
  init: Parameters<FamilyLinkRequest>[1],
  action: string,
) {
  let response: Awaited<ReturnType<FamilyLinkRequest>>;
  try {
    response = await request(url, init);
  } catch {
    // Browser/network exceptions can include an authenticated URL.
    throw new Error(`Family Link ${action} request failed`);
  }
  const outcome = classifyGrantStatus(response.status);
  if (outcome === "auth") {
    throw new FamilyLinkAuthError(`Family Link ${action}: HTTP ${response.status} — session rejected`);
  }
  if (outcome !== "ok") {
    throw new Error(`Family Link ${action} failed: HTTP ${response.status}`);
  }
  return response;
}

/** Read before writing. Callers must serialize grants for the same device. */
export async function addFamilyLinkBonus(request: FamilyLinkRequest, grant: FamilyLinkGrant) {
  const seconds = parseGrantSeconds(String(grant.seconds));
  const read = await checkedRequest(
    request,
    buildAppliedTimeLimitsUrl(grant.childId, grant.apiKey, grant.authorization),
    { method: "GET" },
    "bonus read",
  );
  let payload: unknown;
  try {
    payload = JSON.parse(read.text);
  } catch {
    throw new Error("Invalid Family Link bonus response");
  }
  const remainingSeconds = remainingBonusSeconds(payload, grant.deviceId);
  // The per-purchase maximum must not truncate previously purchased time.
  const totalSeconds = remainingSeconds + seconds;
  if (!Number.isSafeInteger(totalSeconds)) throw new Error("Family Link bonus total is too large");
  const response = await checkedRequest(
    request,
    buildGrantUrl(grant.childId, grant.apiKey, grant.authorization),
    { method: "POST", body: buildGrantBody(grant.childId, grant.deviceId, totalSeconds) },
    "grant",
  );
  return { status: response.status, remainingSeconds, totalSeconds };
}
