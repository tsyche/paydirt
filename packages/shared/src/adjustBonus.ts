// Parent Bonus/deduct control: grit, screen minutes, or both in one action.
// Server-side guards live in pocketbase/pb_hooks/directTimeBonus.pb.js (time)
// and the currency_transactions parent access rule (grit) — keep the limits
// below in sync with the hook. No runtime imports on purpose: scripts load
// this file's siblings directly.

export const BONUS_MODES = ["grit", "time", "both"] as const;
export type BonusMode = (typeof BONUS_MODES)[number];
export type AdjustmentUnit = "grit" | "dollars";

/** Dollar adjustments use the kid's effective grit-per-dollar rate.
 * Keep fractional grit; rounding to whole grit would change the dollar value.
 * Dollar input accepts cents only. Invalid/disabled rates block submission.
 */
export function adjustmentToGrit(amount: number, unit: AdjustmentUnit, goodsRate: number): number {
  if (!Number.isFinite(amount)) return NaN;
  if (unit === "grit") return amount;
  if (!Number.isFinite(goodsRate) || goodsRate <= 0) return NaN;
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 0.000001) return NaN;
  const grit = cents * goodsRate / 100;
  return Number.isFinite(grit) ? grit : NaN;
}

/** Manual bonus minutes come in multiples of this, same as the server hook. */
export const BONUS_MINUTES_STEP = 5;
export const BONUS_MINUTES_MIN = 5;
export const BONUS_MINUTES_MAX = 120;

export const BONUS_REASON_MAX = 500;

export interface AdjustBonusFields {
  mode: BonusMode;
  /** Signed grit amount after optional dollar conversion. */
  grit: number;
  minutes: number;
  reason: string;
}

/** Minutes valid for a manual bonus: 5–120 in five-minute steps. */
export function validBonusMinutes(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= BONUS_MINUTES_MIN &&
    minutes <= BONUS_MINUTES_MAX &&
    minutes % BONUS_MINUTES_STEP === 0
  );
}

/**
 * Error text for an invalid bonus form, or null when it is fine.
 * Grit (alone or combined) requires a note; time-only keeps its reason optional.
 */
export function validateAdjustBonus(fields: AdjustBonusFields): string | null {
  const reason = fields.reason.trim();
  if (reason.length > BONUS_REASON_MAX) {
    return `Keep the note under ${BONUS_REASON_MAX} characters.`;
  }
  if (fields.mode === "time") {
    return validBonusMinutes(fields.minutes) ? null : minutesError();
  }
  if (!reason) {
    return fields.mode === "both" ? "Add a note explaining the bonus." : "Reason is required.";
  }
  if (!Number.isFinite(fields.grit) || fields.grit === 0) {
    return fields.mode === "both" ? "Enter a non-zero grit amount." : "Enter a non-zero amount.";
  }
  if (fields.mode === "both" && !validBonusMinutes(fields.minutes)) return minutesError();
  return null;
}

function minutesError(): string {
  return `Minutes must be ${BONUS_MINUTES_MIN}–${BONUS_MINUTES_MAX} in ${BONUS_MINUTES_STEP}-minute steps.`;
}

/**
 * Runs the two halves of a combined bonus: time first (idempotent via
 * requestKey), then grit (not idempotent). Returns which halves applied so
 * the caller can report a partial success instead of silently dropping one.
 * In single-mode use only that half runs and `applied` reflects it.
 */
export async function submitAdjustBonus(
  run: {
    giveTime: () => Promise<unknown>;
    giveGrit: () => Promise<unknown>;
  },
  mode: BonusMode,
): Promise<{ applied: "grit" | "time" | "both" | "none"; error: unknown }> {
  let applied: "grit" | "time" | "both" | "none" = "none";
  if (mode !== "grit") {
    try {
      await run.giveTime();
      applied = "time";
    } catch (error) {
      return { applied, error };
    }
  }
  if (mode !== "time") {
    try {
      await run.giveGrit();
      applied = applied === "time" ? "both" : "grit";
    } catch (error) {
      return { applied, error };
    }
  }
  return { applied, error: null };
}

/** Plain-language partial-success line for the combined mode, or null. */
export function partialBonusMessage(applied: "grit" | "time" | "both" | "none", detail: string): string | null {
  if (applied === "both" || applied === "none") return null;
  if (applied === "time") return `Bonus time given, but the grit half failed: ${detail}`;
  return `Grit bonus given, but the time half failed: ${detail}`;
}
