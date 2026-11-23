import { adjustmentToGrit, type AdjustmentUnit } from "./adjustBonus";

/** Goal targets are stored as whole Grit. Dollar entry converts at the kid's
 * current rate and rounds up so the goal never undershoots; NaN means invalid. */
export function goalTargetToGrit(amount: number, unit: AdjustmentUnit, goodsRate: number): number {
  const grit = adjustmentToGrit(amount, unit, goodsRate);
  return Number.isFinite(grit) && grit > 0 ? Math.ceil(grit - 1e-9) : NaN;
}
