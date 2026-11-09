import { describe, expect, it } from "vitest";
import { canCancelTimeGrant, timeBankTotals } from "./timeBank";
import type { SpendRequest, TimeGrant, TimeLedgerEntry } from "./types";

describe("earned-time accounting", () => {
  it("deducts reservations once, records deliveries without another debit, and releases cancelled time", () => {
    const ledger = [
      { kind: "earn", minutes: 60 }, { kind: "reserve", minutes: 30 },
      { kind: "redeem", minutes: 15 }, { kind: "release", minutes: 15 },
    ] as TimeLedgerEntry[];
    expect(timeBankTotals(ledger, [])).toEqual({ available: 45, reserved: 0, requested: 0, queued: 0 });
  });
  it("separates held, manual review, requested, and queued remainders including purchased minutes", () => {
    const ledger = [{ kind: "earn", minutes: 60 }, { kind: "reserve", minutes: 30 }] as TimeLedgerEntry[];
    const grants = [
      { minutes: 30, grant_status: "queued", grant_delivered_seconds: 900 },
      { minutes: 15, grant_status: "manual" },
      { minutes: 30, grant_status: "granted" },
      { minutes: 15, grant_status: "cancelled" },
    ] as TimeGrant[];
    const purchases = [
      { screen_minutes: 15, status: "pending" },
      { screen_minutes: 30, status: "approved", grant_status: "queued", grant_delivered_seconds: 1200 },
      { screen_minutes: 60, status: "denied" },
    ] as SpendRequest[];
    expect(timeBankTotals(ledger, grants, purchases)).toEqual({ available: 30, reserved: 15, requested: 15, queued: 25 });
  });
  it("only offers cancellation for queued reservations that have never been dispatched", () => {
    const grant = { redemption: "r", minutes: 15, grant_status: "queued", grant_dispatch_started: false } as TimeGrant;
    expect(canCancelTimeGrant(grant)).toBe(true);
    expect(canCancelTimeGrant({ ...grant, grant_delivered_seconds: 60 })).toBe(false);
    expect(canCancelTimeGrant({ ...grant, grant_dispatch_started: true })).toBe(false);
    expect(canCancelTimeGrant({ ...grant, grant_status: "manual" })).toBe(false);
    expect(canCancelTimeGrant({ ...grant, redemption: "" })).toBe(false);
  });
});
