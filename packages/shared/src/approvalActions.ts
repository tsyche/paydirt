/** Emoji a parent can send on an approved chore. */
export const REACTIONS = ["🎉", "👏", "💪", "🌟"];

/** Confirmation text for undoing an approval; mentions the deduction when the chore and kid are known. */
export function undoApprovalPrompt(
  choreName: string | undefined,
  reward: number | undefined,
  kidName: string | undefined,
  currencyName: string,
): string {
  const name = choreName ?? "this chore";
  const detail =
    choreName && reward !== undefined && kidName
      ? ` This will deduct ${reward} ${currencyName} from ${kidName}.`
      : "";
  return `Undo approval for "${name}"?${detail}`;
}
