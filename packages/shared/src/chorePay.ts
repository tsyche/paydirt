// Per-chore pay mode: a chore pays parentBucks ("bucks", the default), screen
// minutes ("time"), or both. pb_hooks/lib/chorePay.js mirrors normalizePay and
// validatePay server-side (hooks can't import TS), so keep them in sync.
// No runtime imports on purpose: scripts load this file's siblings directly.

export const PAY_MODES = ["bucks", "time", "both"] as const;
export type PayModeValue = (typeof PAY_MODES)[number];

/** Minutes come in multiples of this, capped at MAX_REWARD_MINUTES. */
export const MINUTES_STEP = 5;
export const MAX_REWARD_MINUTES = 120;

export interface ChorePayFields {
  pay_mode?: string;
  reward?: number;
  reward_minutes?: number;
}

/** Empty or unknown pay_mode (old APKs, pre-migration rows) means bucks. */
export function payMode(chore: ChorePayFields): PayModeValue {
  return chore.pay_mode === "time" || chore.pay_mode === "both" ? chore.pay_mode : "bucks";
}

/** What approval will actually pay: bucks only in bucks/both, minutes only in time/both. */
export function normalizePay(chore: ChorePayFields): { mode: PayModeValue; bucks: number; minutes: number } {
  const mode = payMode(chore);
  const bucks = mode === "time" ? 0 : Math.max(0, Number(chore.reward) || 0);
  const minutes = mode === "bucks" ? 0 : Math.max(0, Number(chore.reward_minutes) || 0);
  return { mode, bucks, minutes };
}

/** Partial approvals close the chore. Minutes round down to avoid overpaying. */
export function partialPay(chore: ChorePayFields, percent: number) {
  const pay = normalizePay(chore);
  return {
    ...pay,
    bucks: Math.round(pay.bucks * percent) / 100,
    minutes: Math.floor(pay.minutes * percent / 100 / MINUTES_STEP) * MINUTES_STEP,
  };
}

/** Error text for an invalid pay setup, or null when it is fine. */
export function validatePay(chore: ChorePayFields): string | null {
  const { mode, bucks, minutes } = normalizePay(chore);
  if (mode !== "time" && !(bucks > 0)) return "Set a reward above 0.";
  if (mode !== "bucks") {
    if (!(minutes > 0)) return "Set the bonus minutes above 0.";
    if (!Number.isInteger(minutes) || minutes % MINUTES_STEP !== 0) {
      return `Minutes come in steps of ${MINUTES_STEP}.`;
    }
    if (minutes > MAX_REWARD_MINUTES) return `Bonus time is capped at ${MAX_REWARD_MINUTES} minutes.`;
  }
  return null;
}

/** Short payout label, e.g. "15 Grit", "10 min", or "15 Grit + 10 min"; "" currency omits the name. */
export function payLabel(chore: ChorePayFields, currencyName: string, creditPercent = 100): string {
  const { bucks, minutes } = partialPay(chore, creditPercent || 100);
  const parts: string[] = [];
  if (bucks > 0) parts.push(currencyName ? `${bucks} ${currencyName}` : `${bucks}`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.join(" + ");
}
