import { bankedTimeLabel } from "./screenTime";
import { describe, expect, it } from "vitest";
import { canCancelTimeGrant, deliveryWindowLabel, timeBankTotals, timeDeliveryOutcome } from "./timeBank";
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

describe("time delivery wording", () => {
  it.each(["queued", "manual", "granted", "manual_done", "cancelled", ""] as const)("describes %s without exposing worker errors", (status) => {
    const result = timeDeliveryOutcome({ minutes: 30, grant_status: status, grant_delivered_seconds: 600, grant_error: "private worker details" } as TimeGrant);
    expect(JSON.stringify(result)).not.toContain("private worker details");
    if (status === "queued" || status === "manual") expect(result.detail).toContain("10 of 30 minutes delivered");
    if (status === "queued") expect(result.title).toBe("Queued");
    if (status === "manual") expect(result.title).toBe("Needs parent help");
    if (status === "granted" || status === "manual_done") expect(result.title).toBe("Delivered");
    if (status === "cancelled") expect(result.title).toBe("Returned to savings");
    if (!status) expect(result.title).toBe("Awaiting confirmation");
  });
});

it("shows an override as requested now, without claiming delivery or an allowed-window wait", () => {
  const grant = { minutes: 30, grant_status: "queued", grant_delivered_seconds: 600, grant_window_override: true } as TimeGrant;
  expect(timeDeliveryOutcome(grant).detail).toBe("10 of 30 minutes delivered. Your parent requested delivery now. Waiting for your device to confirm.");
  expect(bankedTimeLabel(grant)).toBe("20 min queued — parent requested delivery now");
});

describe("deliveryWindowLabel", () => {
  const closed = { open: false, window: "05:30-08:50", next: "Banked — next delivery Tue, Nov 24 at 5:30 AM PST" };
  it("shows hours and queue with next delivery when closed", () => {
    expect(deliveryWindowLabel(closed, 2)).toBe("Allowed 05:30–08:50 · 2 queued, next delivery Tue, Nov 24 at 5:30 AM PST");
  });
  it("omits the queue part when nothing is queued", () => {
    expect(deliveryWindowLabel(closed, 0)).toBe("Allowed 05:30–08:50");
  });
  it("handles open, unrestricted and blocked days", () => {
    expect(deliveryWindowLabel({ open: true, window: "14:30-20:30,21:00-22:00", next: "" }, 1)).toBe("Allowed 14:30–20:30, 21:00–22:00 · 1 queued");
    expect(deliveryWindowLabel({ open: true, window: "", next: "" }, 0)).toBe("Allowed any time");
    expect(deliveryWindowLabel({ open: false, window: "none", next: "" }, 0)).toBe("No delivery today");
  });
});
