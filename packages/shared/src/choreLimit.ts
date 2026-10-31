// "Normal" repeat limit per chore. A chore with max_per_period = N should be
// assigned to a given kid at most N times per window; going over is allowed
// (parents can override) but the assign flow warns first. The window follows
// the chore's cadence, same day counts as the daily cron in
// pb_hooks/lib/scheduler.js. One-offs have no cadence, so they use a week.
// No runtime imports on purpose: scripts load this file's siblings directly.

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
