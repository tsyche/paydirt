// Pure fire/no-fire decision logic for PayDirt's scheduled jobs (see
// pocketbase/pb_hooks/lib/scheduler.js). PocketBase's embedded Goja JS
// runtime can't import this package (no node_modules/TS/ESM resolution —
// its require() only reads local .js files), so scheduler.js carries a
// hand-ported mirror of these functions with an identical clock-injection
// shape. Keep the two in sync — see the comment above each mirrored
// function in scheduler.js.
//
// Every function here takes `now` as an explicit Date instead of reaching
// for `new Date()`, which is what makes fire/no-fire assertable with a fake
// clock in tests instead of only observable by waiting out a real cron.

const HOUR_MS = 3600e3;
const DAY_MS = 86400e3;

/**
 * Approval nudge (runTick): a completed chore that's sat unapproved for
 * longer than `nudgeHours`. Fires once per completion — `nudgedAt` gates the
 * repeat, and going stale again after a resubmit (a new `completedAt` newer
 * than the last nudge) is expected to re-fire.
 */
export function shouldFireNudge(
  now: Date,
  completedAt: Date,
  nudgedAt: Date | null,
  nudgeHours: number,
  vacationMode: boolean,
): boolean {
  if (vacationMode || nudgeHours <= 0) return false;
  const cutoff = now.getTime() - nudgeHours * HOUR_MS;
  if (completedAt.getTime() > cutoff) return false;
  if (nudgedAt && nudgedAt.getTime() >= completedAt.getTime()) return false;
  return true;
}

/**
 * Parent-scheduled chore reminder (runTick): fires once per day, on the
 * first tick at/after `reminderTime` ("HH:MM", server-local). Mirrors the
 * original's mixed-timezone comparison exactly (local HH:MM, UTC calendar
 * day) rather than "fixing" it — behavior must stay identical.
 */
export function shouldFireReminder(
  now: Date,
  reminderTime: string,
  lastRemindedAt: Date | null,
  vacationMode: boolean,
): boolean {
  if (vacationMode) return false;
  const pad = (n: number) => String(n).padStart(2, "0");
  const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (nowHM < reminderTime) return false;
  if (lastRemindedAt) {
    const today = now.toISOString().slice(0, 10);
    const lastRemindedDay = lastRemindedAt.toISOString().slice(0, 10);
    if (lastRemindedDay === today) return false;
  }
  return true;
}

/** Escalation stage for a due-dated chore: 0 = not yet due-soon. */
export type DueStage = 0 | 1 | 2 | 3;

/**
 * Deadline escalation stage (runTick): 1 = due within 24h, 2 = due within
 * 2h, 3 = overdue.
 */
export function computeDueStage(now: Date, dueAt: Date): DueStage {
  const msLeft = dueAt.getTime() - now.getTime();
  if (msLeft <= 0) return 3;
  if (msLeft <= 2 * HOUR_MS) return 2;
  if (msLeft <= 24 * HOUR_MS) return 1;
  return 0;
}

/**
 * Whether a deadline escalation notification should fire: only when the
 * newly computed stage is a real stage (not 0) and higher than the stage
 * already notified for, so each stage fires exactly once.
 */
export function shouldEscalate(stage: DueStage, prevStage: number, vacationMode: boolean): boolean {
  if (vacationMode) return false;
  return stage > 0 && stage > prevStage;
}

/**
 * Currency expiry (runDaily): an `earn` ledger entry lapses once it's older
 * than `expiryDays`.
 */
export function isCurrencyExpired(
  now: Date,
  createdAt: Date,
  expiryDays: number,
  vacationMode: boolean,
): boolean {
  if (vacationMode || expiryDays <= 0) return false;
  const cutoff = now.getTime() - expiryDays * DAY_MS;
  return createdAt.getTime() <= cutoff;
}

/** Weekly parent digest (runWeeklyDigest): skipped entirely on vacation. */
export function shouldSendWeeklyDigest(vacationMode: boolean): boolean {
  return !vacationMode;
}
