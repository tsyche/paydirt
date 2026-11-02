// Overview math shared by the parent cost/fairness views and the kid "My Bank"
// card (web + mobile). Pure functions only: callers fetch rows, these add up.
// Dollars always use the rate passed in (today's), so past periods shift if
// `goods_rate` changes; the UI says which rate it used.

import { choreLimit, limitWindowDays } from "./choreLimit";
import { MINUTES_STEP, normalizePay } from "./chorePay";
import type { Assignment, Chore, CurrencyTransaction } from "./types";

/** bucks / goodsRate, or null when no dollar rate is set. */
export function toDollars(bucks: number, goodsRate: number): number | null {
  return goodsRate > 0 ? bucks / goodsRate : null;
}

/** Screen minutes `bucks` could buy at `screenRate`, floored to the 5-minute step. */
export function bucksToMinutes(bucks: number, screenRate: number): number {
  if (!(screenRate > 0) || !(bucks > 0)) return 0;
  return Math.floor(bucks / screenRate / MINUTES_STEP) * MINUTES_STEP;
}

export interface BankView {
  /** Null when no dollar rate is set. */
  dollars: number | null;
  /** Potential only: the ledger doesn't reserve it and a request still needs approval. */
  screenMinutes: number;
}

export function bankView(balance: number, goodsRate: number, screenRate: number): BankView {
  return { dollars: toDollars(balance, goodsRate), screenMinutes: bucksToMinutes(balance, screenRate) };
}

// ─── Weekly potential (forward-looking, parent-only) ─────────────────────────

type PotentialChore = Pick<
  Chore,
  "type" | "cadence" | "reward" | "reward_minutes" | "pay_mode" | "max_per_period"
>;

/** Times per week a recurring chore can pay: cadence rate, capped by its advisory limit. */
export function occurrencesPerWeek(chore: PotentialChore): number {
  if (chore.type !== "recurring") return 0;
  const cadence = chore.cadence === "weekly" ? 1 : chore.cadence === "monthly" ? 7 / 30 : 7;
  const max = choreLimit(chore);
  return max > 0 ? Math.min(cadence, (max * 7) / limitWindowDays(chore)) : cadence;
}

export interface WeeklyPotential {
  /** Recurring chores counted. */
  chores: number;
  /** One-offs assigned; they don't fit a weekly figure and are left out of the totals. */
  oneOffs: number;
  bucks: number;
  bonusMinutes: number;
  dollars: number | null;
  /** What the bucks alone could buy as screen time. */
  screenMinutes: number;
}

export function weeklyPotential(
  chores: PotentialChore[],
  goodsRate: number,
  screenRate: number,
): WeeklyPotential {
  let bucks = 0;
  let bonusMinutes = 0;
  let recurring = 0;
  let oneOffs = 0;
  for (const c of chores) {
    if (c.type !== "recurring") { oneOffs++; continue; }
    recurring++;
    const occ = occurrencesPerWeek(c);
    const pay = normalizePay(c);
    bucks += occ * pay.bucks;
    bonusMinutes += occ * pay.minutes;
  }
  bucks = Math.round(bucks);
  bonusMinutes = Math.round(bonusMinutes);
  return {
    chores: recurring,
    oneOffs,
    bucks,
    bonusMinutes,
    dollars: toDollars(bucks, goodsRate),
    screenMinutes: bucksToMinutes(bucks, screenRate),
  };
}

// ─── Period cost (what actually happened, parent-only) ───────────────────────

export type PeriodKind = "week" | "month" | "year";

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Local-date range [start, end) for the period `offset` periods from the one containing `now` (weeks start Monday). */
export function periodRange(kind: PeriodKind, now: Date, offset = 0): { start: string; end: string; label: string } {
  let s: Date;
  let e: Date;
  let label: string;
  if (kind === "week") {
    const back = (now.getDay() + 6) % 7;
    s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back + offset * 7);
    e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
    const last = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 1);
    label = `${ymd(s)} – ${ymd(last)}`;
  } else if (kind === "month") {
    s = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    e = new Date(s.getFullYear(), s.getMonth() + 1, 1);
    label = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`;
  } else {
    s = new Date(now.getFullYear() + offset, 0, 1);
    e = new Date(s.getFullYear() + 1, 0, 1);
    label = String(s.getFullYear());
  }
  return { start: ymd(s), end: ymd(e), label };
}

export interface PeriodSummary {
  /** Positive `earn` rows: chores, streak bonuses. */
  earned: number;
  /** Parent bonuses (+) and deductions (-) net. */
  adjustments: number;
  /** Absolute value of `spend` rows: screen time, goods, anything redeemed. */
  spent: number;
  /** Screen minutes paid directly by time chores (not in the ledger). */
  bonusMinutes: number;
  chores: number;
}

type PeriodTxn = Pick<CurrencyTransaction, "amount" | "type">;
type PeriodAssignment = Pick<Assignment, "approved_at"> & { expand?: { chore?: Pick<Chore, "reward" | "reward_minutes" | "pay_mode"> } };

export function summarizePeriod(txns: PeriodTxn[], assignments: PeriodAssignment[]): PeriodSummary {
  let earned = 0;
  let adjustments = 0;
  let spent = 0;
  for (const t of txns) {
    if (t.type === "earn" && t.amount > 0) earned += t.amount;
    else if (t.type === "spend") spent += Math.abs(t.amount);
    else if (t.type === "manual_adjustment") adjustments += t.amount;
  }
  let bonusMinutes = 0;
  for (const a of assignments) {
    const c = a.expand?.chore;
    if (c) bonusMinutes += normalizePay(c).minutes;
  }
  return { earned, adjustments, spent, bonusMinutes, chores: assignments.length };
}

export function addSummaries(list: PeriodSummary[]): PeriodSummary {
  return list.reduce<PeriodSummary>(
    (a, s) => ({
      earned: a.earned + s.earned,
      adjustments: a.adjustments + s.adjustments,
      spent: a.spent + s.spent,
      bonusMinutes: a.bonusMinutes + s.bonusMinutes,
      chores: a.chores + s.chores,
    }),
    { earned: 0, adjustments: 0, spent: 0, bonusMinutes: 0, chores: 0 },
  );
}

/** Percent change from `prev` to `cur`, or null when there's no baseline. */
export function pctChange(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}
