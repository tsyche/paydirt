import { normalizePay, type ChorePayFields } from "./chorePay";

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

export interface ApprovalItem {
  chore?: (ChorePayFields & { name?: string }) | null;
  kidName?: string;
  timeChoice?: "bank" | "use";
}

/**
 * Confirm text for approving, or null when nothing pays screen time (bucks-only
 * approvals stay one click). Time earnings remain irreversible; Bank holds
 * them, while Use now requests whole 15-minute blocks under delivery windows.
 */
export function approveTimePrompt(items: ApprovalItem[]): string | null {
  const lines: string[] = [];
  let total = 0;
  for (const it of items) {
    const minutes = it.chore ? normalizePay(it.chore).minutes : 0;
    if (minutes <= 0) continue;
    total += minutes;
    lines.push(`• ${it.kidName ?? "kid"}: ${minutes} min (${it.chore?.name ?? "chore"}) — ${it.timeChoice === "use" ? "Use now in 15-minute blocks; remainder saved" : "Bank"}`);
  }
  if (lines.length === 0) return null;
  return `Approving awards ${total} min of earned screen time and can't be undone:\n${lines.join("\n")}`;
}
