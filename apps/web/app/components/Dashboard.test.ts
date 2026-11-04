import { describe, expect, it } from "vitest";
import { assignHint, buildLedgerCsv } from "./Dashboard";
import type { CurrencyTransaction } from "@paydirt/shared";

const LABELS: Record<string, string> = {
  earn: "Chore reward",
  spend: "Spent",
  manual_adjustment: "Adjustment",
};

function makeTxn(overrides: Partial<CurrencyTransaction> = {}): CurrencyTransaction {
  return {
    id: "t1",
    created: "2026-06-01T10:00:00Z",
    updated: "2026-06-01T10:00:00Z",
    user: "kid1",
    amount: 10,
    type: "earn",
    ...overrides,
  };
}

describe("assignHint", () => {
  it("shows the held hint when the kid has an active assignment", () => {
    expect(assignHint(true, false, "1 per day")).toEqual({ text: " assigned", ok: true });
  });

  it("shows the done-and-at-limit hint when at limit without an active assignment", () => {
    expect(assignHint(false, true, "1 per day")).toEqual({ text: " done · at limit (1 per day)", ok: true });
  });

  it("is null when the kid is not held and not at limit", () => {
    expect(assignHint(false, false, "1 per day")).toBeNull();
  });

  it("is null at limit when the chore has no label", () => {
    expect(assignHint(false, true, "")).toBeNull();
  });
});

describe("buildLedgerCsv", () => {
  it("emits a header row followed by one data row", () => {
    const csv = buildLedgerCsv([makeTxn()], LABELS);
    const lines = csv.split("\n");
    expect(lines[0]).toBe('"Date","Type","Amount","Reason"');
    expect(lines[1]).toBe('"2026-06-01","Chore reward","10",""');
  });

  it("uses the label map for known types", () => {
    const csv = buildLedgerCsv([makeTxn({ type: "spend", amount: -5 })], LABELS);
    expect(csv).toContain('"Spent"');
    expect(csv).toContain('"-5"');
  });

  it("falls back to raw type for unknown types", () => {
    const csv = buildLedgerCsv([makeTxn({ type: "unknown" as never })], LABELS);
    expect(csv).toContain('"unknown"');
  });

  it("includes the reason when present", () => {
    const csv = buildLedgerCsv([makeTxn({ reason: "Bonus for good week" })], LABELS);
    expect(csv).toContain('"Bonus for good week"');
  });

  it("escapes double quotes in values", () => {
    const csv = buildLedgerCsv([makeTxn({ reason: 'He said "hi"' })], LABELS);
    expect(csv).toContain('"He said ""hi"""');
  });

  it("returns only the header row for an empty transaction list", () => {
    const csv = buildLedgerCsv([], LABELS);
    expect(csv).toBe('"Date","Type","Amount","Reason"');
  });

  it("produces one line per transaction plus the header", () => {
    const txns = [makeTxn({ id: "a" }), makeTxn({ id: "b" }), makeTxn({ id: "c" })];
    const lines = buildLedgerCsv(txns, LABELS).split("\n");
    expect(lines).toHaveLength(4);
  });
});
