import type { SpendRequest, TimeGrant, TimeLedgerEntry } from "./types";

export function timeBankTotals(ledger: TimeLedgerEntry[], grants: TimeGrant[], purchases: SpendRequest[] = []) {
  const available = ledger.reduce((total, row) => total +
    (row.kind === "earn" || row.kind === "release" ? row.minutes : row.kind === "reserve" ? -row.minutes : 0), 0);
  let reserved = 0;
  let queued = 0;
  for (const grant of [...grants, ...purchases]) {
    const remaining = Math.max(0, (("minutes" in grant ? grant.minutes : grant.screen_minutes) || 0) - (grant.grant_delivered_seconds || 0) / 60);
    if (grant.grant_status === "queued") queued += remaining;
    if (grant.grant_status === "manual") reserved += remaining;
  }
  const requested = purchases.filter((p) => p.status === "pending").reduce((sum, p) => sum + (p.screen_minutes || 0), 0);
  return { available, reserved, requested, queued };
}

export function canCancelTimeGrant(grant: TimeGrant) {
  return !!grant.redemption && grant.grant_status === "queued" && !grant.grant_dispatch_started && !grant.grant_delivered_seconds;
}

export function timeBankEventLabel(kind: TimeLedgerEntry["kind"]): string {
  return { earn: "Earned", reserve: "Reserved for delivery", redeem: "Delivered", release: "Returned to savings" }[kind];
}

/** Acceptance is not delivery. Only persisted grant outcomes confirm arrival. */
export function timeDeliveryOutcome(grant: TimeGrant): { title: string; detail: string } {
  const delivered = Math.min(grant.minutes, Math.max(0, (grant.grant_delivered_seconds || 0) / 60));
  const progress = delivered > 0 && delivered < grant.minutes ? `${delivered} of ${grant.minutes} minutes delivered. ` : "";
  switch (grant.grant_status) {
    case "granted": return { title: "Delivered", detail: `${grant.minutes} minutes delivered to your device.` };
    case "manual_done": return { title: "Delivered", detail: `A parent confirmed ${grant.minutes} minutes delivered.` };
    case "manual": return { title: "Needs parent help", detail: `${progress}Ask a parent to check the remaining delivery. Do not request it again.` };
    case "cancelled": return { title: "Returned to savings", detail: `${grant.minutes} undelivered minutes returned to your bank.` };
    case "queued": return { title: "Queued", detail: `${progress}Waiting for delivery in an allowed window. This request is accepted; delivery is not yet complete.` };
    default: return { title: "Awaiting confirmation", detail: "Ask a parent to check delivery. Do not request it again." };
  }
}
