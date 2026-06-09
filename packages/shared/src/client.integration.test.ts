import { describe, it, expect, beforeAll } from "vitest";
import { PaydirtClient } from "./client";
import { Collections } from "./collections";
import type { User } from "./types";

// Live integration test — requires a running PocketBase at PB_URL with the seed
// users (parent@test.local / child1@test.local, pw password123). Run `make seed`.
// Excluded from the default `test` script; run with `pnpm test:integration`.

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const PW = "password123";

describe("PaydirtClient (live)", () => {
  let parent: PaydirtClient;
  let child: PaydirtClient;
  let childUser: User;

  beforeAll(async () => {
    parent = new PaydirtClient(PB_URL);
    child = new PaydirtClient(PB_URL);
    await parent.login("parent@test.local", PW);
    childUser = await child.login("child1@test.local", PW);
  });

  it("runs the full earn → spend loop with correct balance math", async () => {
    const householdId = parent.currentUser!.household;
    const startBalance = await parent.getBalance(childUser.id);

    // Parent creates and assigns a chore worth 30
    const chore = await parent.createChore({
      household: householdId,
      name: "Integration test chore",
      reward: 30,
      type: "oneoff",
      created_by: parent.currentUser!.id,
      active: true,
    });
    const assignment = await parent.assignChore(chore.id, childUser.id);

    // Child marks it complete
    const done = await child.markComplete(assignment.id);
    expect(done.status).toBe("completed");

    // Guard: child cannot approve their own chore
    await expect(child.approveAssignment(assignment.id)).rejects.toThrow();

    // Parent approves → earn hook fires
    const approved = await parent.approveAssignment(assignment.id);
    expect(approved.status).toBe("approved");
    expect(await parent.getBalance(childUser.id)).toBe(startBalance + 30);

    // Child submits a spend request, parent approves → spend hook fires
    const sr = await child.submitSpendRequest(childUser.id, 10, "test reward");
    const resolved = await parent.approveSpendRequest(sr.id, parent.currentUser!.id);
    expect(resolved.status).toBe("approved");
    expect(await parent.getBalance(childUser.id)).toBe(startBalance + 30 - 10);
  });

  it("scopes reads to the household (child sees the household's chores)", async () => {
    const chores = await child.pb
      .collection(Collections.Chores)
      .getFullList({ filter: child.pb.filter("household = {:hh}", { hh: childUser.household }) });
    expect(chores.length).toBeGreaterThan(0);
  });
});
