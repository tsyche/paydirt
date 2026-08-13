import { describe, expect, it } from "vitest";
import { verifyLedger } from "./ledger";

describe("verifyLedger", () => {
  it("reports no mismatches for a consistent ledger", () => {
    const users = [
      { id: "kid1", balance: 30 },
      { id: "kid2", balance: -5 },
    ];
    const transactions = [
      { user: "kid1", amount: 20 },
      { user: "kid1", amount: 10 },
      { user: "kid2", amount: 15 },
      { user: "kid2", amount: -20 },
    ];

    expect(verifyLedger(users, transactions)).toEqual([]);
  });

  it("treats a user with no transactions as a balance of 0", () => {
    const users = [{ id: "kid1", balance: 0 }];
    expect(verifyLedger(users, [])).toEqual([]);
  });

  it("tolerates floating point rounding noise", () => {
    const users = [{ id: "kid1", balance: 0.3 }];
    const transactions = [
      { user: "kid1", amount: 0.1 },
      { user: "kid1", amount: 0.2 },
    ];
    expect(verifyLedger(users, transactions)).toEqual([]);
  });

  it("detects a deliberately corrupted balance", () => {
    const users = [
      { id: "kid1", balance: 999 }, // corrupted: should be 30
      { id: "kid2", balance: -5 },
    ];
    const transactions = [
      { user: "kid1", amount: 20 },
      { user: "kid1", amount: 10 },
      { user: "kid2", amount: 15 },
      { user: "kid2", amount: -20 },
    ];

    const mismatches = verifyLedger(users, transactions);
    expect(mismatches).toEqual([
      { userId: "kid1", cachedBalance: 999, computedBalance: 30, delta: 969 },
    ]);
  });

  it("detects a user with no transactions but a non-zero cached balance", () => {
    const users = [{ id: "kid1", balance: 50 }];
    expect(verifyLedger(users, [])).toEqual([
      { userId: "kid1", cachedBalance: 50, computedBalance: 0, delta: 50 },
    ]);
  });
});
