// "Normal" repeat limit per chore. A chore with max_per_period = N should be
// assigned to a given kid at most N times per window; going over is allowed
// (parents can override) but the assign flow warns first. The window follows
// the chore's cadence, same day counts as the daily cron in
// pb_hooks/lib/scheduler.js. One-offs have no cadence, so they use a week.
// No runtime imports on purpose: scripts load this file's siblings directly.

import { localDateKey, localDateInstant } from "./dates";
export interface ChoreLimitFields {
  type?: string;
  cadence?: string;
  max_per_period?: number;
}

/** Window length in days for a chore's limit. */
export function limitWindowDays(chore: ChoreLimitFields): number {
  if (chore.type === "recurring") {
    if (chore.cadence === "weekly") return 7;
    if (chore.cadence === "monthly") return 30;
    return 1;
  }
  return 7;
}

/** Daily recurrence resets at local midnight; other windows retain rolling days. */
export function limitWindowStart(chore: ChoreLimitFields, now = Date.now()): Date {
  const start = new Date(now);
  if (chore.type === "recurring" && limitWindowDays(chore) === 1) return new Date(localDateInstant(localDateKey(start)));
  else start.setTime(now - limitWindowDays(chore) * 86400e3);
  return start;
}

/** The limit, or 0 when unset/invalid (no limit). */
export function choreLimit(chore: ChoreLimitFields): number {
  const n = chore.max_per_period;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : 0;
}

/** True when assigning once more would exceed the limit. */
export function isOverLimit(chore: ChoreLimitFields, recentCount: number): boolean {
  const max = choreLimit(chore);
  return max > 0 && recentCount >= max;
}

/** "day" | "week" | "month" for the chore's limit window. */
export function limitUnit(chore: ChoreLimitFields): string {
  const days = limitWindowDays(chore);
  return days === 1 ? "day" : days === 7 ? "week" : "month";
}

/** "1 per day", "2 per week", ... for chore rows. Empty when there's no limit. */
export function limitLabel(chore: ChoreLimitFields): string {
  const max = choreLimit(chore);
  if (!max) return "";
  return `${max} per ${limitUnit(chore)}`;
}

export interface LimitWarning {
  childId: string;
  /** Assignments of this chore to this kid inside the window. */
  count: number;
  max: number;
  windowDays: number;
}

export interface RecentAssignmentRow {
  chore: string;
  child: string;
  created: string;
}

/**
 * Kids already at/over this chore's limit inside its window, from pre-fetched
 * (non-closed) assignment rows. Mirrors the server-side count in
 * assignLimitWarnings so the UI can say so up front instead of on Assign.
 */
export function kidsAtLimit(
  chore: ChoreLimitFields & { id: string },
  rows: RecentAssignmentRow[],
  now: number = Date.now(),
): Map<string, number> {
  const max = choreLimit(chore);
  const out = new Map<string, number>();
  if (!max) return out;
  const cutoff = limitWindowStart(chore, now).getTime();
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.chore !== chore.id) continue;
    if (new Date(r.created.replace(" ", "T")).getTime() < cutoff) continue;
    counts.set(r.child, (counts.get(r.child) ?? 0) + 1);
  }
  for (const [kid, n] of counts) if (n >= max) out.set(kid, n);
  return out;
}
