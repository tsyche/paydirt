import { describe, expect, it } from "vitest";
import { historyPrefix } from "./history";

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
