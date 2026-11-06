import type { Assignment, BaseRecord, InboxItem, KudosAward, SpendRequest, TimeGrant } from "./types";

export type ArchiveKind = "inbox" | "kudos" | "assignment" | "spend_request" | "time_grant";
export interface ArchivedItem extends BaseRecord {
  user: string;
  inbox?: string; kudos?: string; assignment?: string; spend_request?: string; time_grant?: string;
  expand?: { inbox?: InboxItem; kudos?: KudosAward; assignment?: Assignment & { expand?: { chore?: { name?: string } } }; spend_request?: SpendRequest; time_grant?: TimeGrant };
}
export function archiveLabel(item: ArchivedItem): string {
  const e = item.expand;
  return e?.inbox?.title || e?.kudos?.reason || (item.kudos ? "Great work!" : "") ||
    e?.assignment?.expand?.chore?.name || e?.spend_request?.description || e?.time_grant?.description || "Past chore or screen-time grant";
}
export function archiveDetails(item: ArchivedItem): string {
  const e = item.expand;
  if (e?.inbox) return e.inbox.body || "";
  if (e?.kudos) return `Kudos reward: ${e.kudos.bucks}`;
  if (e?.assignment) return e.assignment.approval_comment ? `Parent feedback: ${e.assignment.approval_comment}` : "Completed chore";
  const grant = e?.spend_request || e?.time_grant;
  return grant ? `${"screen_minutes" in grant ? grant.screen_minutes : (grant as TimeGrant).minutes} minutes · ${grant.grant_status === "manual_done" ? "Granted manually" : "Delivered"}` : "";
}

export function startsArchiveSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy) * 1.5;
}
export function completesArchiveSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) >= 72 && Math.abs(dx) > Math.abs(dy) * 1.5;
}
