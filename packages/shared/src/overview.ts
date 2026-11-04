// Overview math shared by the parent cost/fairness views and the kid "My Bank"
// card (web + mobile). Pure functions only: callers fetch rows, these add up.
// Dollars always use the rate passed in (today's), so past periods shift if
// `goods_rate` changes; the UI says which rate it used.

import { choreLimit, limitWindowDays } from "./choreLimit";
import { householdWallDate } from "./dates";
import { MINUTES_STEP, normalizePay, partialPay } from "./chorePay";
import type { Assignment, Chore, CurrencyTransaction, SpendRequest } from "./types";

/** A kid's own dollar rate when set (> 0), else the household's. PocketBase returns 0, not null, for an empty number. */
export function effectiveGoodsRate(kidRate: number | null | undefined, householdRate: number | null | undefined): number {
  return kidRate && kidRate > 0 ? kidRate : (householdRate ?? 0);
}

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

/** Pending chore rewards are estimates; pending spending reduces availability. */
export function kidBankSummary(
  balance: number,
  assignments: { status: string; expand?: { chore?: Chore } }[],
  requests: Pick<SpendRequest, "status" | "amount">[],
) {
  const pendingSpend = requests.filter((r) => r.status === "pending").reduce((sum, r) => sum + r.amount, 0);
  const pendingEarn = assignments.filter((a) => a.status === "completed")
    .reduce((sum, a) => sum + (a.expand?.chore ? normalizePay(a.expand.chore).bucks : 0), 0);
  return { pendingSpend, pendingEarn, available: Math.max(0, balance - pendingSpend) };
}

export interface BankRow {
  id: string;
  name: string;
  balance: number;
  dollars: number | null;
  screenMinutes: number;
}

export interface BankSummary {
  rows: BankRow[];
  /** Sum of the rows, so it always agrees with them even when kids have their own dollar rates. */
  total: { balance: number; dollars: number | null; screenMinutes: number };
}

/** Per-kid and combined grit / dollars / screen minutes. A kid's own `goods_rate` wins over the household's. */
export function bankSummary(
  kids: { id: string; display_name: string; balance: number; goods_rate?: number | null }[],
  goodsRate: number,
  screenRate: number,
): BankSummary {
  const rows = kids.map((k) => ({
    id: k.id,
    name: k.display_name,
    balance: k.balance,
    ...bankView(k.balance, effectiveGoodsRate(k.goods_rate, goodsRate), screenRate),
  }));
  const priced = rows.filter((r) => r.dollars !== null);
  return {
    rows,
    total: {
      balance: rows.reduce((n, r) => n + r.balance, 0),
      dollars: priced.length ? priced.reduce((n, r) => n + (r.dollars ?? 0), 0) : null,
      screenMinutes: rows.reduce((n, r) => n + r.screenMinutes, 0),
    },
  };
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

/**
 * Household weekly grit ceiling. A race chore held by several kids pays once (first
 * approved wins), so it counts once; any other chore counts per holder.
 */
export function householdWeeklyBucks(
  chores: (PotentialChore & { id: string; race?: boolean })[],
  holders: Record<string, number>,
): number {
  let bucks = 0;
  for (const c of chores) {
    const n = holders[c.id] ?? 0;
    if (c.type !== "recurring" || n <= 0) continue;
    bucks += occurrencesPerWeek(c) * normalizePay(c).bucks * (c.race ? 1 : n);
  }
  return Math.round(bucks);
}

// ─── Period cost (what actually happened, parent-only) ───────────────────────

export type PeriodKind = "week" | "month" | "year";

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Local-date range [start, end) for the period `offset` periods from the one containing `now` (weeks start Monday). */
export function periodRange(kind: PeriodKind, now: Date, offset = 0): { start: string; end: string; label: string } {
  now = householdWallDate(now);
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
  /** Parent "Great work" bonuses, tracked separately from chore earnings. */
  kudos: number;
  /** Parent bonuses (+) and deductions (-) net. */
  adjustments: number;
  /** Absolute value of `spend` rows: screen time, goods, anything redeemed. */
  spent: number;
  /** Screen minutes paid directly by time chores (not in the ledger). */
  bonusMinutes: number;
  chores: number;
}

type PeriodTxn = Pick<CurrencyTransaction, "amount" | "type">;
type PeriodAssignment = Pick<Assignment, "approved_at" | "credit_percent"> & { expand?: { chore?: Pick<Chore, "reward" | "reward_minutes" | "pay_mode"> } };

export function summarizePeriod(txns: PeriodTxn[], assignments: PeriodAssignment[]): PeriodSummary {
  let earned = 0;
  let kudos = 0;
  let adjustments = 0;
  let spent = 0;
  for (const t of txns) {
    if (t.type === "earn" && t.amount > 0) earned += t.amount;
    else if (t.type === "kudos" && t.amount > 0) kudos += t.amount;
    else if (t.type === "spend") spent += Math.abs(t.amount);
    else if (t.type === "manual_adjustment") adjustments += t.amount;
  }
  let bonusMinutes = 0;
  for (const a of assignments) {
    const c = a.expand?.chore;
    if (c) bonusMinutes += partialPay(c, a.credit_percent || 100).minutes;
  }
  return { earned, kudos, adjustments, spent, bonusMinutes, chores: assignments.length };
}

export function addSummaries(list: PeriodSummary[]): PeriodSummary {
  return list.reduce<PeriodSummary>(
    (a, s) => ({
      earned: a.earned + s.earned,
      kudos: a.kudos + s.kudos,
      adjustments: a.adjustments + s.adjustments,
      spent: a.spent + s.spent,
      bonusMinutes: a.bonusMinutes + s.bonusMinutes,
      chores: a.chores + s.chores,
    }),
    { earned: 0, kudos: 0, adjustments: 0, spent: 0, bonusMinutes: 0, chores: 0 },
  );
}

/** Percent change from `prev` to `cur`, or null when there's no baseline. */
export function pctChange(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}

// ─── Cost strip (paid vs. ceiling, screen time vs. goods) ────────────────────

/** Length of a `periodRange` in weeks (7 days = 1). */
export function periodWeeks(range: { start: string; end: string }): number {
  const days = (Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86_400_000;
  return days / 7;
}

export interface SpendSplit {
  /** Grit redeemed for screen time (spend rows linked to a request with screen_minutes). */
  screenBucks: number;
  /** Minutes those screen-time requests bought. */
  screenMinutes: number;
  /** Grit redeemed for everything else: goods, cash, unlinked spends. */
  goodsBucks: number;
}

/**
 * Splits `spend` rows into screen time vs. real goods. A row is screen time when
 * its `related_spend_request` has `screen_minutes > 0`; screen minutes are counted
 * once per distinct request.
 */
export function splitSpend(
  txns: Pick<CurrencyTransaction, "amount" | "type" | "related_spend_request">[],
  requests: Pick<SpendRequest, "id" | "screen_minutes">[],
): SpendSplit {
  const minutes = new Map(requests.map((r) => [r.id, r.screen_minutes ?? 0]));
  const counted = new Set<string>();
  const out: SpendSplit = { screenBucks: 0, screenMinutes: 0, goodsBucks: 0 };
  for (const t of txns) {
    if (t.type !== "spend") continue;
    const bucks = Math.abs(t.amount);
    const id = t.related_spend_request;
    const m = id ? (minutes.get(id) ?? 0) : 0;
    if (m > 0 && id) {
      out.screenBucks += bucks;
      if (!counted.has(id)) { counted.add(id); out.screenMinutes += m; }
    } else {
      out.goodsBucks += bucks;
    }
  }
  return out;
}

export interface CostStrip {
  /** Bucks kids actually earned in the period. */
  paid: number;
  /** Ceiling: weekly potential x weeks in the period. */
  max: number;
  /** paid / max as a whole percent, or null when there is no ceiling. */
  pct: number | null;
  paidDollars: number | null;
  maxDollars: number | null;
}

export function costStrip(paid: number, weeklyMaxBucks: number, weeks: number, goodsRate: number): CostStrip {
  const max = Math.round(weeklyMaxBucks * weeks);
  return {
    paid,
    max,
    pct: max > 0 ? Math.round((paid / max) * 100) : null,
    paidDollars: toDollars(paid, goodsRate),
    maxDollars: toDollars(max, goodsRate),
  };
}
