import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PaydirtClient } from "./client";
import { Collections } from "./collections";
import { cleanupChores } from "./integration.cleanup";
import { completionFormWithPhoto } from "./integration.fixtures";
import type { User } from "./types";

// Live tests for the Phase 1 / 1.5 features: rejected-chore resubmission,
// races, savings goals, streaks, proposals, swaps, and the cron trigger
// endpoints. Same prerequisites as the other *.integration.test.ts files.

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const PW = "password123";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@paydirt.local";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "password123";

describe("Phase 1 features (live)", () => {
  let parent: PaydirtClient;
  let kid1: PaydirtClient; // child1
  let kid2: PaydirtClient; // child2
  let kid1User: User;
  let kid2User: User;
  let householdId: string;
  const createdChores: string[] = [];

  beforeAll(async () => {
    parent = new PaydirtClient(PB_URL);
    kid1 = new PaydirtClient(PB_URL);
    kid2 = new PaydirtClient(PB_URL);
    await parent.login("parent@test.local", PW);
    kid1User = await kid1.login("child1@test.local", PW);
    kid2User = await kid2.login("child2@test.local", PW);
    householdId = parent.currentUser!.household;
  });

  afterAll(async () => {
    await cleanupChores(createdChores);
  });

  async function newChore(name: string, extra: object = {}) {
    const chore = await parent.createChore({
      household: householdId,
      name,
      reward: 5,
      type: "oneoff",
      created_by: parent.currentUser!.id,
      active: true,
      ...extra,
    });
    createdChores.push(chore.id);
    return chore;
  }

  it("rejected chores: kid can reply; resubmission demands a fresh photo", async () => {
    const chore = await newChore("Resubmit test chore");
    const assignment = await parent.assignChore(chore.id, kid2User.id);
    await kid2.markComplete(assignment.id);
    await parent.rejectAssignment(assignment.id, "The corners are still dusty");

    // Kid replies without changing status — parents get notified by the hook
    const replied = await kid2.respondToRejection(assignment.id, "I'll get the corners!");
    expect(replied.kid_response).toBe("I'll get the corners!");
    expect(replied.status).toBe("rejected");

    // Resubmitting without a NEW photo is blocked, even though this chore
    // doesn't normally require one
    await expect(kid2.markComplete(assignment.id)).rejects.toThrow();

    // With a fresh photo it goes back to the approval queue
    const resubmitted = await kid2.pb
      .collection(Collections.Assignments)
      .update(assignment.id, completionFormWithPhoto());
    expect(resubmitted.status).toBe("completed");
    expect(resubmitted.photo).toBeTruthy();
  });

  it("race: first approval wins, remaining assignments close and lock", async () => {
    const chore = await newChore("Race test chore", { race: true });
    const racers = await parent.startRace(chore.id, [kid1User.id, kid2User.id]);
    expect(racers).toHaveLength(2);
    const [a1, a2] = racers as [typeof racers[0], typeof racers[0]];

    await kid1.markComplete(a1.id);
    await kid2.markComplete(a2.id);

    const startBalance2 = await parent.getBalance(kid2User.id);
    await parent.approveAssignment(a1.id);

    // Loser's assignment was closed by the race hook, and they earned nothing
    const closed = await parent.pb.collection(Collections.Assignments).getOne(a2.id);
    expect(closed.status).toBe("closed");
    expect(await parent.getBalance(kid2User.id)).toBe(startBalance2);

    // ...and they can't reopen it
    await expect(kid2.markComplete(a2.id)).rejects.toThrow();

    // Restore kid1's balance (records removed in afterAll)
    await parent.undoApproval(a1.id);
  });

  it("savings goals: achieved when the balance crosses the target; kid-owned", async () => {
    const balance = await parent.getBalance(kid2User.id);
    const goal = await kid2.createGoal(kid2User.id, "Test goal", balance + 3);
    expect(goal.achieved).toBe(false);

    // Kids can't create goals for siblings
    await expect(kid2.createGoal(kid1User.id, "Nope", 10)).rejects.toThrow();

    // Crossing the target flips it to achieved (hook on the ledger entry)
    await parent.adjustBalance(kid2User.id, 3, "goal test bonus");
    const achieved = await kid2.pb
      .collection(Collections.SavingsGoals)
      .getOne(goal.id);
    expect(achieved.achieved).toBe(true);

    // Cleanup: kid deletes their own goal; restore balance
    await kid2.deleteGoal(goal.id);
    await parent.adjustBalance(kid2User.id, -3, "goal test cleanup");
  });

  it("streaks: an approved chore today registers a streak", async () => {
    const chore = await newChore("Streak test chore");
    const assignment = await parent.assignChore(chore.id, kid2User.id);
    await kid2.markComplete(assignment.id);
    await parent.approveAssignment(assignment.id);

    const me = await kid2.pb.collection(Collections.Users).getOne<User>(kid2User.id);
    expect(me.streak_count ?? 0).toBeGreaterThanOrEqual(1);

    await parent.undoApproval(assignment.id);
  });

  it("proposals: kid pitches, parent approves at a chosen reward", async () => {
    const proposal = await kid2.proposeChore(householdId, kid2User.id, "Wash the car", 50);
    expect(proposal.status).toBe("pending");

    // Kids can't resolve proposals
    await expect(kid2.declineProposal(proposal.id, kid2User.id)).rejects.toThrow();

    // Parent approves at a negotiated reward → chore created + assigned to kid
    const chore = await parent.approveProposal(proposal, parent.currentUser!.id, 30);
    createdChores.push(chore.id);
    expect(chore.reward).toBe(30);
    const mine = await kid2.listActiveAssignmentsForChild(kid2User.id);
    expect(mine.some((a) => a.chore === chore.id)).toBe(true);

    // Proposal records are parent-deletable; tidy up
    await parent.pb.collection(Collections.ChoreProposals).delete(proposal.id);
  });

  it("swaps: target sibling can accept (take over) or be the only decliner", async () => {
    const chore = await newChore("Swap test chore");
    const assignment = await parent.assignChore(chore.id, kid2User.id);

    // Swap target must be a sibling — not a parent
    await expect(kid2.offerSwap(assignment.id, parent.currentUser!.id)).rejects.toThrow();

    await kid2.offerSwap(assignment.id, kid1User.id);

    // The offer shows up for kid1
    const incoming = await kid1.listIncomingSwaps(kid1User.id);
    const offer = incoming.find((a) => a.id === assignment.id);
    expect(offer).toBeDefined();

    // kid1 takes it over
    const accepted = await kid1.respondToSwap(offer!, kid1User.id, true);
    expect(accepted.child).toBe(kid1User.id);
    expect(accepted.swap_to).toBe("");
  });

  it("cron jobs run via the superuser trigger endpoints", async () => {
    const admin = new PaydirtClient(PB_URL);
    await admin.pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const job of ["tick", "daily", "digest"]) {
      const res = await admin.pb.send(`/api/paydirt/cron/${job}`, { method: "POST" });
      expect(res.ran).toBe(job);
    }
    // ...and they're locked down for everyone else
    await expect(
      parent.pb.send("/api/paydirt/cron/tick", { method: "POST" }),
    ).rejects.toThrow();
  });

  it("recurring chore auto-assignment: daily cron re-creates after approval", async () => {
    const admin = new PaydirtClient(PB_URL);
    await admin.pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

    // Create a recurring chore and give kid1 the first assignment
    const chore = await newChore("Take out trash", { type: "recurring", cadence: "daily" });
    const first = await parent.assignChore(chore.id, kid1User.id);

    // Complete and approve — no open assignment now
    await kid1.markComplete(first.id);
    await parent.approveAssignment(first.id);

    // Running daily cron should re-assign since there's no open assignment
    await admin.pb.send("/api/paydirt/cron/daily", { method: "POST" });

    const active = await kid1.listActiveAssignmentsForChild(kid1User.id);
    const newAssignment = active.find((a) => a.chore === chore.id);
    expect(newAssignment).toBeDefined();
    expect(newAssignment!.status).toBe("assigned");

    // Running daily cron again should NOT create a duplicate (open one exists)
    await admin.pb.send("/api/paydirt/cron/daily", { method: "POST" });
    const activeAgain = await kid1.listActiveAssignmentsForChild(kid1User.id);
    const duplicates = activeAgain.filter((a) => a.chore === chore.id);
    expect(duplicates).toHaveLength(1);
  });
});
