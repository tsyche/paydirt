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
    if (now.getFullYear() === lastRemindedAt.getFullYear() &&
        now.getMonth() === lastRemindedAt.getMonth() &&
        now.getDate() === lastRemindedAt.getDate()) return false;
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

export interface LedgerRow {
  id: string;
  type: "earn" | "spend" | "manual_adjustment" | "kudos";
  amount: number;
  created: Date;
  reason?: string;
  expiry_processed?: boolean;
}

/** Reason prefix on the compensating row the expiry cron writes; those rows are lapses, not spends. */
export const EXPIRED_REASON_PREFIX = "Expired rewards";

/**
 * What the expiry cron should do for one kid. Replays the ledger oldest-first:
 * each `earn` row is a lot, and every debit (spend or negative adjustment other than
 * a past lapse) consumes the oldest lots first, so spent grit can't expire twice
 * and a fresh earn is never charged for an old one. Credits that are not `earn`
 * (manual bonuses, future kudos) never expire. Already-processed lots are treated
 * as gone once they passed their expiry date.
 *
 * `staleIds`: unprocessed earn rows past `expiryDays` (mark processed, even at 0
 * remaining). `lapse`: grit still left in those lots, capped at `balance`.
 */
export function expiryLapse(
  rows: LedgerRow[],
  now: Date,
  expiryDays: number,
  balance: number,
): { lapse: number; staleIds: string[] } {
  if (expiryDays <= 0) return { lapse: 0, staleIds: [] };
  const span = expiryDays * DAY_MS;
  const sorted = [...rows].sort((a, b) => a.created.getTime() - b.created.getTime());
  const lots: { row: LedgerRow; left: number }[] = [];
  for (const r of sorted) {
    if (r.type === "earn" && r.amount > 0) {
      lots.push({ row: r, left: r.amount });
      continue;
    }
    if (r.amount >= 0 || r.reason?.startsWith(EXPIRED_REASON_PREFIX)) continue;
    let debit = -r.amount;
    for (const lot of lots) {
      if (debit <= 0) break;
      const gone = lot.row.expiry_processed && lot.row.created.getTime() + span <= r.created.getTime();
      if (gone || lot.left <= 0) continue;
      const take = Math.min(lot.left, debit);
      lot.left -= take;
      debit -= take;
    }
  }
  const stale = lots.filter((l) => !l.row.expiry_processed && l.row.created.getTime() + span <= now.getTime());
  const left = stale.reduce((n, l) => n + l.left, 0);
  return { lapse: Math.max(0, Math.min(left, balance)), staleIds: stale.map((l) => l.row.id) };
}

/** Weekly parent digest (runWeeklyDigest): skipped entirely on vacation. */
export function shouldSendWeeklyDigest(vacationMode: boolean): boolean {
  return !vacationMode;
}

/** Local calendar day as YYYY-MM-DD (server-local, unlike the UTC-day reminder quirk). */
export function localDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Per-kid summary time for today: weekend (Sat/Sun) or weekday "HH:MM"; "" = off. */
export function digestTimeFor(now: Date, weekday: string, weekend: string): string {
  const d = now.getDay();
  return d === 0 || d === 6 ? weekend : weekday;
}

/**
 * Kid chore summary (runTick): once per local day, on the first tick at/after
 * the kid's configured time. `lastSentDay` is the stored YYYY-MM-DD marker.
 */
export function shouldFireDigest(
  now: Date,
  time: string,
  lastSentDay: string,
  vacationMode: boolean,
): boolean {
  if (vacationMode || !/^\d{2}:\d{2}$/.test(time)) return false;
  const pad = (n: number) => String(n).padStart(2, "0");
  const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (nowHM < time) return false;
  return lastSentDay !== localDay(now);
}

/** Body of the summary push: count plus up to 3 names. */
export function buildDigestMessage(names: string[]): string {
  const n = names.length;
  const shown = names.slice(0, 3).join(", ");
  const more = n > 3 ? ` +${n - 3} more` : "";
  return `${n} chore${n === 1 ? "" : "s"} today: ${shown}${more}`;
}
