import type { Assignment, CurrencyTransaction } from "./types";
import { localDateKey } from "./dates";

export interface MonthActivity {
  chores: number;
  earned: number;
  spent: number;
  peak: number;
}

/** Longest run of consecutive calendar days with at least one approved assignment. */
export function streakPeak(assignments: Pick<Assignment, "approved_at">[]): number {
  const days = [
    ...new Set(
      assignments.map((a) => a.approved_at ? localDateKey(a.approved_at) : "").filter(Boolean),
    ),
  ].sort();
  let peak = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    const cur = Date.parse(d);
    run = prev !== null && (cur - prev) / 86400000 === 1 ? run + 1 : 1;
    if (run > peak) peak = run;
    prev = cur;
  }
  return peak;
}

/** Monthly per-kid summary used by the parent Activity report (web + mobile). */
export function summarizeMonthActivity(
  txns: Pick<CurrencyTransaction, "amount">[],
  assignments: Pick<Assignment, "approved_at">[],
): MonthActivity {
  return {
    chores: assignments.length,
    earned: txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    spent: txns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
    peak: streakPeak(assignments),
  };
}
