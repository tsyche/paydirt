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
