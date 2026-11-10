import type { ChoreMessage } from "./types";

export function conversationSource(source?: string): string | null {
  return /^assignments:([a-z0-9]{15})(?::conversation)?$/.exec(source || "")?.[1] || null;
}
export function conversationEventLabel(kind: ChoreMessage["kind"]): string {
  return { message: "Message", submitted: "Submitted for approval", approved: "Approved", rejected: "Returned for another try", reopened: "Approval undone", closed: "Race closed", legacy: "Earlier feedback" }[kind];
}
