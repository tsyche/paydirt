import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EventSource } from "eventsource";
import { PaydirtClient } from "./client";
import { Collections } from "./collections";
import { cleanupChores, cleanupSpendRequests } from "./integration.cleanup";
import { completionFormWithPhoto } from "./integration.fixtures";
import type { User } from "./types";

// The PocketBase SDK's realtime service needs a global EventSource; Node
// doesn't provide one, so polyfill it for the realtime test.
if (!globalThis.EventSource) {
  (globalThis as { EventSource?: unknown }).EventSource = EventSource;
}

// Live integration tests for the PocketBase hooks and guards (currency math,
// authorization, broadcasts, realtime). Same prerequisites as
// client.integration.test.ts: a running PocketBase with seed data.
// Run with `pnpm test:integration` (files run sequentially — both suites
// mutate the seeded kids' balances).

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const PW = "password123";

describe("PocketBase hooks & guards (live)", () => {
  let parent: PaydirtClient;
  let kid: PaydirtClient;
  let kidUser: User;
  let householdId: string;
  const createdChores: string[] = [];
  const createdSpendRequests: string[] = [];

  beforeAll(async () => {
    parent = new PaydirtClient(PB_URL);
    kid = new PaydirtClient(PB_URL);
    await parent.login("parent@test.local", PW);
    kidUser = await kid.login("child2@test.local", PW);
    householdId = parent.currentUser!.household;
  });

  // Remove everything the suite created so the dev household stays clean —
  // leftover "test chore" assignments otherwise pile up on the kid screens.
  afterAll(async () => {
    await cleanupChores(createdChores);
    await cleanupSpendRequests(createdSpendRequests);
  });

  async function createTestChore(reward: number, name: string, extra: object = {}) {
    const chore = await parent.createChore({
      household: householdId,
      name,
      reward,
      type: "oneoff",
      created_by: parent.currentUser!.id,
      active: true,
      ...extra,
    });
    createdChores.push(chore.id);
    return chore;
  }

  /** Create, assign, and complete a fresh chore; returns the pieces. */
  async function completedAssignment(reward: number, name: string) {
    const chore = await createTestChore(reward, name);
    const assignment = await parent.assignChore(chore.id, kidUser.id);
    await kid.markComplete(assignment.id);
    return { chore, assignment };
  }

  it("manual adjustments update the cached balance (both directions)", async () => {
    const start = await parent.getBalance(kidUser.id);
    await parent.adjustBalance(kidUser.id, 5, "hook test bonus");
    expect(await parent.getBalance(kidUser.id)).toBe(start + 5);
    await parent.adjustBalance(kidUser.id, -5, "hook test cleanup");
    expect(await parent.getBalance(kidUser.id)).toBe(start);
  });

  it("approval undo reverses the reward exactly once", async () => {
    const start = await parent.getBalance(kidUser.id);
    const { assignment } = await completedAssignment(17, "Undo test chore");

    await parent.approveAssignment(assignment.id);
    expect(await parent.getBalance(kidUser.id)).toBe(start + 17);

    // Undo: back to completed, reward reversed by the hook
    const undone = await parent.undoApproval(assignment.id);
    expect(undone.status).toBe("completed");
    expect(await parent.getBalance(kidUser.id)).toBe(start);

    // A second undo is a no-op status-wise and must NOT deduct again
    await parent.undoApproval(assignment.id);
    expect(await parent.getBalance(kidUser.id)).toBe(start);

    // Re-approving pays out again (ledger stays consistent)
    await parent.approveAssignment(assignment.id);
    expect(await parent.getBalance(kidUser.id)).toBe(start + 17);

    // Final undo restores the starting balance (records removed in afterAll)
    await parent.undoApproval(assignment.id);
    expect(await parent.getBalance(kidUser.id)).toBe(start);
  });

  it("a child cannot approve, reject, or undo-approve an assignment", async () => {
    const { assignment } = await completedAssignment(11, "Guard test chore");

    await expect(kid.approveAssignment(assignment.id)).rejects.toThrow();
    await expect(kid.rejectAssignment(assignment.id, "nope")).rejects.toThrow();

    await parent.approveAssignment(assignment.id);
    // approved chores are settled — kids can't move them back
    await expect(kid.undoApproval(assignment.id)).rejects.toThrow();

    // Restore the balance (records removed in afterAll)
    await parent.undoApproval(assignment.id);
  });

  it("photo-required chores reject completion without a photo and accept one with it", async () => {
    const chore = await createTestChore(9, "Photo guard test chore", { photo_required: true });
    const assignment = await parent.assignChore(chore.id, kidUser.id);

    // Without a photo: blocked by the guard
    await expect(kid.markComplete(assignment.id)).rejects.toThrow();

    // With a photo (multipart, like the app sends): accepted. This is the
    // case the guard originally got wrong — mid-update a fresh upload isn't a
    // filename string yet, and the guard treated it as "no photo".
    const updated = await kid.pb
      .collection(Collections.Assignments)
      .update(assignment.id, completionFormWithPhoto());

    expect(updated.status).toBe("completed");
    expect(updated.photo).toBeTruthy();
  });

  it("spend requests exceeding the balance cannot be approved", async () => {
    const balance = await parent.getBalance(kidUser.id);
    const sr = await kid.submitSpendRequest(kidUser.id, balance + 1000, "moon rocket");
    createdSpendRequests.push(sr.id);

    await expect(
      parent.approveSpendRequest(sr.id, parent.currentUser!.id),
    ).rejects.toThrow();
    expect(await parent.getBalance(kidUser.id)).toBe(balance);

    await parent.denySpendRequest(sr.id, parent.currentUser!.id);
  });

  it("children cannot create chores or manual adjustments", async () => {
    await expect(
      kid.createChore({
        household: householdId,
        name: "Kid-created chore",
        reward: 9999,
        type: "oneoff",
        active: true,
      }),
    ).rejects.toThrow();

    await expect(
      kid.adjustBalance(kidUser.id, 9999, "free money"),
    ).rejects.toThrow();
  });

  it("parents can broadcast to the household; children cannot", async () => {
    const sent = await parent.sendBroadcast(
      householdId,
      parent.currentUser!.id,
      "Integration test broadcast",
    );
    expect(sent.message).toBe("Integration test broadcast");

    await expect(
      kid.sendBroadcast(householdId, kidUser.id, "kids cannot broadcast"),
    ).rejects.toThrow();
  });

  it("realtime: a kid subscription fires when their assignment changes", async () => {
    const events: unknown[] = [];
    const eventSeen = new Promise<void>((resolve) => {
      void kid.subscribeToKidUpdates(kidUser.id, () => {
        events.push(1);
        resolve();
      });
    });

    // Give the SSE connection a beat to establish, then trigger an event
    await new Promise((r) => setTimeout(r, 500));
    const chore = await createTestChore(1, "Realtime test chore");
    await parent.assignChore(chore.id, kidUser.id);

    await expect(
      Promise.race([
        eventSeen,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("no realtime event within 5s")), 5000),
        ),
      ]),
    ).resolves.toBeUndefined();
    expect(events.length).toBeGreaterThan(0);

    await kid.pb.realtime.unsubscribe();
  });

  it("moves the cached balance in lockstep with the ledger", async () => {
    // Delta-based so historical data can't fail it: every balance change in
    // this block must be mirrored by ledger entries of the same total.
    const sumLedger = async () => {
      const txns = await parent.listTransactions(kidUser.id);
      return txns.reduce((sum, t) => sum + t.amount, 0);
    };
    const startBalance = await parent.getBalance(kidUser.id);
    const startLedger = await sumLedger();

    const { assignment } = await completedAssignment(13, "Ledger lockstep chore");
    await parent.approveAssignment(assignment.id);
    await parent.adjustBalance(kidUser.id, -4, "lockstep deduction");

    expect(await parent.getBalance(kidUser.id)).toBe(startBalance + 13 - 4);
    expect(await sumLedger()).toBe(startLedger + 13 - 4);

    // Restore the balance (records removed in afterAll)
    await parent.undoApproval(assignment.id);
    await parent.adjustBalance(kidUser.id, 4, "lockstep cleanup");
    expect(await parent.getBalance(kidUser.id)).toBe(startBalance);
  });
});
