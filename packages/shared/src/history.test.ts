import { describe, expect, it } from "vitest";
import { historyPrefix, visibleHistoryPage } from "./history";

describe("visible history refresh", () => {
  it("preserves the expanded prefix beyond one API page", async () => {
    const all = Array.from({ length: 300 }, (_, id) => ({ id }));
    const result = await historyPrefix<{ id: number }>(async (after, limit) => {
      const offset = after ? after.id + 1 : 0;
      return { items: all.slice(offset, offset + limit), hasMore: offset + limit < all.length };
    }, 235);
    expect(result.items).toEqual(all.slice(0, 235));
    expect(result.hasMore).toBe(true);
  });
  it("handles history shrinking after an undo without looping or showing stale rows", async () => {
    const result = await historyPrefix(async () => ({ items: [1, 2, 3], hasMore: false }), 25);
    expect(result).toEqual({ items: [1, 2, 3], hasMore: false });
  });
});

describe("archived history paging", () => {
  const all = Array.from({ length: 80 }, (_, id) => ({ id }));
  const fetch = async (after: { id: number } | undefined, limit: number) => {
    const offset = after ? after.id + 1 : 0;
    return { items: all.slice(offset, offset + limit), hasMore: offset + limit < all.length };
  };
  it("fills five visible rows after skipping multiple entirely archived pages", async () => {
    const visible = (item: { id: number }) => item.id >= 55;
    const first = await visibleHistoryPage(fetch, visible, undefined, 5);
    expect(first.items.map((item) => item.id)).toEqual([55, 56, 57, 58, 59]);
    expect(first.hasMore).toBe(true);
    const next = await visibleHistoryPage(fetch, visible, first.items.at(-1), 10);
    expect(next.items.map((item) => item.id)).toEqual(Array.from({ length: 10 }, (_, i) => i + 60));
    const last = await visibleHistoryPage(fetch, visible, next.items.at(-1), 10);
    expect(last.items).toEqual(all.slice(70));
    expect(last.hasMore).toBe(false);
  });
  it("terminates when all remaining items are archived", async () => {
    expect(await visibleHistoryPage(fetch, () => false, undefined, 5)).toEqual({ items: [], hasMore: false });
  });
});
