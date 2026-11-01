import { describe, expect, it } from "vitest";
import { popTab, pushTab } from "./tabHistory";

describe("tab history", () => {
  it("pops back through visited tabs, then reports empty so the app can exit", () => {
    let s: string[] = [];
    s = pushTab(s, "approvals", "chores");
    s = pushTab(s, "chores", "ledger");
    let r = popTab(s);
    expect(r.tab).toBe("chores");
    r = popTab(r.stack);
    expect(r.tab).toBe("approvals");
    expect(popTab(r.stack).tab).toBeNull();
  });
  it("ignores re-selecting the current tab", () => {
    expect(pushTab(["a"], "b", "b")).toEqual(["a"]);
  });
  it("caps depth", () => {
    let s: string[] = [];
    for (let i = 0; i < 50; i++) s = pushTab(s, `t${i}`, `t${i + 1}`);
    expect(s.length).toBe(20);
  });
});
