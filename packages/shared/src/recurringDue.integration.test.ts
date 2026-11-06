import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PaydirtClient } from "./client";
import { cleanupChores } from "./integration.cleanup";
import type { User } from "./types";
const parent = new PaydirtClient(process.env.PB_URL ?? "http://127.0.0.1:3111");
const kid = new PaydirtClient(process.env.PB_URL ?? "http://127.0.0.1:3111");
const chores: string[] = [];
let child: User;
beforeAll(async () => { await parent.login("parent1@test.local", "password123"); child = await kid.login("child1@test.local", "password123"); });
afterAll(() => cleanupChores(chores));
describe("assignment recurring deadline snapshots (live)", () => {
  it.each(["daily", "weekly", "monthly"] as const)("stamps %s deadlines, retains snapshots on rule edits, and rejects client tampering", async (cadence) => {
    const chore = await parent.createChore({ household: parent.currentUser!.household, created_by: parent.currentUser!.id,
      name: `Deadline snapshot ${cadence}`, type: "recurring", cadence, reward: 5, active: true, due_time: "20:00", due_day: cadence === "monthly" ? 31 : 2 });
    chores.push(chore.id);
    const first = await parent.assignChore(chore.id, child.id);
    expect(new Date(first.due_at!).getTime()).toBeGreaterThan(Date.now());
    await parent.updateChore(chore.id, { due_time: "21:00" });
    const existing = await parent.pb.collection("assignments").getOne(first.id);
    expect(existing.due_at).toBe(first.due_at);
    await expect(parent.pb.collection("assignments").update(first.id, { due_at: "2099-01-01T00:00:00Z" })).rejects.toThrow();
    const second = await parent.assignChore(chore.id, child.id);
    expect(second.due_at).not.toBe(first.due_at);
  });
});
