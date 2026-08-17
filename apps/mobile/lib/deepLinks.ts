// Notification deep links.
//
// UnifiedPushReceiver.kt attaches a PendingIntent to each Android notification that
// launches the app via `paydirt://notification?type=<type>` (see native-src/UnifiedPushReceiver.kt).
// `type` mirrors the same field PocketBase already sends in the push payload
// (pocketbase/pb_hooks/lib/ntfy.js) — the same field FamilyLinkAccessibilityService's
// automation switches on. This module parses that URL and maps `type` to the parent
// dashboard tab it should open (see ParentHome.tsx, which drives tabs via local state
// rather than a router).
//
// Deliberately avoids the global `URL`/`URLSearchParams` APIs — Hermes' support for them
// is inconsistent across RN versions, so this parses the query string by hand.

export type ParentTab = "approvals" | "kids" | "chores" | "settings";

const DEEP_LINK_PREFIX = "paydirt://notification";

// Known payload `type` values → the tab they should open. Only types the server
// actually sends today are listed; everything else falls through to "no destination"
// (see tabForNotificationType) so the app still opens, just without forcing a tab.
const TYPE_TO_TAB: Partial<Record<string, ParentTab>> = {
  spend_approved: "approvals",
};

// Extracts the `type` query param from a paydirt:// notification deep link.
// Returns null for anything that isn't one of our own deep links, including a
// plain cold-start launch (no URL) or a launch via the home-screen icon.
export function parseNotificationType(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(DEEP_LINK_PREFIX)) return null;

  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) return null;

  const query = url.slice(queryIndex + 1);
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const [rawKey, rawValue] = pair.split("=");
    if (rawKey === "type" && rawValue) {
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Returns the parent-dashboard tab a notification of this type should open, or null
// when there's no specific destination (unrecognized/absent type) — callers should
// leave whatever tab the user was already on alone in that case.
export function tabForNotificationType(type: string | null | undefined): ParentTab | null {
  if (!type) return null;
  return TYPE_TO_TAB[type] ?? null;
}
