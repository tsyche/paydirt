/**
 * Unsaved "who gets which chore" checkbox picks (choreId → kidIds), persisted
 * by the apps so an app restart or update doesn't discard them before the
 * parent presses Assign. Pure (de)serialization only; storage is per platform.
 */
export type AssignDraft = Record<string, Set<string>>;

/** JSON for storage; chores with no picks are omitted. */
export function serializeAssignDraft(draft: AssignDraft): string {
  const out: Record<string, string[]> = {};
  for (const [choreId, kids] of Object.entries(draft)) {
    if (kids.size > 0) out[choreId] = [...kids];
  }
  return JSON.stringify(out);
}

/** Tolerant parse: null, junk, or wrong shapes yield an empty draft. */
export function parseAssignDraft(raw: string | null | undefined): AssignDraft {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out: AssignDraft = {};
    for (const [choreId, kids] of Object.entries(data)) {
      if (!Array.isArray(kids)) continue;
      const ids = kids.filter((k): k is string => typeof k === "string");
      if (ids.length > 0) out[choreId] = new Set(ids);
    }
    return out;
  } catch {
    return {};
  }
}
