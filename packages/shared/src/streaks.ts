// Pure streak decision logic (see pocketbase/pb_hooks/lib/streaks.js and the
// streak-bonus block in pocketbase/pb_hooks/goals.pb.js). As with
// scheduling.ts, PocketBase's Goja runtime can't import this package, so
// streaks.js and goals.pb.js carry hand-ported mirrors — keep them in sync.
//
// Neither function here takes a vacation-mode flag: a paused household never
// produces new `earn` transactions in the first place (enforced elsewhere),
// so vacation gating is implicit in the input data rather than an explicit
// branch — a paused household simply has no earn date for today/yesterday,
// which computeStreak below already resolves to a broken streak.

/** Milestone day-counts → bonus amount, before per-household overrides. */
export const DEFAULT_STREAK_MILESTONES: Record<number, number> = { 3: 5, 7: 15, 14: 40, 30: 100 };

/**
 * Counts consecutive days, ending today (UTC), on which the child has an
 * `earn` date. `earnDates` is the set of calendar days (YYYY-MM-DD, UTC) on
 * which at least one `earn` ledger entry landed — the caller does the DB
 * fetch and date slicing, this just walks the calendar.
 *
 * Grace period: today isn't over yet, so a streak whose last earn was
 * yesterday is still alive. Without this, the 3am daily cron would zero
 * every streak before the kids wake up.
 */
export function computeStreak(now: Date, earnDates: Iterable<string>): number {
  const days = new Set(earnDates);
  const cursor = new Date(now.getTime());
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/**
 * The bonus to grant when a streak refresh crosses a milestone, or
 * `undefined` when nothing should fire. `milestones` is the already
 * override-resolved day → bonus map (per-household overrides are a
 * PocketBase record lookup and stay in goals.pb.js, not here).
 */
export function getMilestoneBonus(
  streak: number,
  prevStreak: number,
  milestones: Record<number, number>,
): number | undefined {
  if (streak <= prevStreak) return undefined;
  return milestones[streak] || undefined;
}
