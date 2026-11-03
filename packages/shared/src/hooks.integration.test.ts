import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EventSource } from "eventsource";
import { PaydirtClient } from "./client";
import { Collections } from "./collections";
import { adminPb, cleanupChores, cleanupSpendRequests, cleanupUsers } from "./integration.cleanup";
import { TINY_JPEG, completionFormWithPhoto } from "./integration.fixtures";
import { avatarUrl } from "./avatar";
import type { KudosAward, SpendRequest, User } from "./types";

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

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:3111";
const PW = "password123";

describe("PocketBase hooks & guards (live)", () => {
  let parent: PaydirtClient;
  let kid: PaydirtClient;
  let kidUser: User;
  let householdId: string;
  const createdChores: string[] = [];
  const createdSpendRequests: string[] = [];
  const createdUsers: string[] = [];

  beforeAll(async () => {
    parent = new PaydirtClient(PB_URL);
    kid = new PaydirtClient(PB_URL);
    await parent.login("parent1@test.local", PW);
    kidUser = await kid.login("child2@test.local", PW);
    householdId = parent.currentUser!.household;
  });

  // Remove everything the suite created so the dev household stays clean —
  // leftover "test chore" assignments otherwise pile up on the kid screens.
  afterAll(async () => {
    await cleanupChores(createdChores);
    await cleanupUsers(createdUsers);
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

  it("kudos create a private, immutable ledger credit and one-time celebration", async () => {
    const email = `kudos-kid-${Date.now()}@test.local`;
    const su = await adminPb();
    const fresh = await su.collection("users").create<User>({
      email,
      password: PW,
      passwordConfirm: PW,
      verified: true,
      role: "child",
      display_name: "Kudos Kid",
      household: householdId,
    });
    createdUsers.push(fresh.id);

    const recipient = new PaydirtClient(PB_URL);
    await recipient.login(email, PW);
    const start = await parent.getBalance(fresh.id);
    const award = await parent.giveKudos(fresh.id, 17, "Big effort");

    expect(award.child).toBe(fresh.id);
    expect(award.given_by).toBe(parent.currentUser!.id);
    expect(award.seen_at).toBeFalsy();
    expect(await parent.getBalance(fresh.id)).toBe(start + 17);

    const tx = (await parent.listTransactions(fresh.id)).find((row) => row.related_kudos === award.id);
    expect(tx).toMatchObject({
      amount: 17,
      type: "kudos",
      reason: "Kudos: Big effort",
      related_kudos: award.id,
    });
    expect(await recipient.listKudosForChild(fresh.id)).toHaveLength(1);
    expect(await kid.listKudosForChild(fresh.id)).toEqual([]);
    await expect(kid.giveKudos(fresh.id, 99, "forged")).rejects.toThrow();

    const inbox = await recipient.listInbox(fresh.id);
    expect(inbox.some((item) => item.type === "kudos" && item.body?.includes("Big effort"))).toBe(true);

    const seen = await recipient.markKudosSeen(award.id);
    expect(seen.seen_at).toBeTruthy();
    await expect(recipient.markKudosSeen(award.id)).rejects.toThrow();
    await expect(
      recipient.pb.collection(Collections.Kudos).update<KudosAward>(award.id, { reason: "edited" }),
    ).rejects.toThrow();
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

  describe("per-chore pay mode", () => {
    async function grantsFor(assignmentId: string) {
      const all = await parent.listBonusGrants(householdId);
      return all.filter((g) => g.assignment === assignmentId);
    }

    it("undo reverses what was paid, even if the chore's reward is edited after approval", async () => {
      const start = await parent.getBalance(kidUser.id);
      const { chore, assignment } = await completedAssignment(17, "Undo after edit chore");
      await parent.approveAssignment(assignment.id);
      expect(await parent.getBalance(kidUser.id)).toBe(start + 17);

      await parent.updateChore(chore.id, { reward: 40 });
      await parent.undoApproval(assignment.id);
      expect(await parent.getBalance(kidUser.id)).toBe(start);
    });

    it("a time-only chore pays minutes and no bucks", async () => {
      const start = await parent.getBalance(kidUser.id);
      const chore = await createTestChore(0, "Time-only chore", { pay_mode: "time", reward_minutes: 10 });
      const assignment = await parent.assignChore(chore.id, kidUser.id);
      await kid.markComplete(assignment.id);
      await parent.approveAssignment(assignment.id);

      expect(await parent.getBalance(kidUser.id)).toBe(start);
      const grants = await grantsFor(assignment.id);
      expect(grants).toHaveLength(1);
      expect(grants[0]?.minutes).toBe(10);
      expect(["queued", "manual"]).toContain(grants[0]?.grant_status);
    });

    it("a time-only approval alone starts a streak (fresh kid, no earn rows)", async () => {
      const email = `streak-kid-${Date.now()}@test.local`;
      const su = await adminPb();
      const fresh = await su.collection("users").create({
        email,
        password: PW,
        passwordConfirm: PW,
        verified: true,
        role: "child",
        display_name: "Streak Kid",
        household: householdId,
      });
      createdUsers.push(fresh.id);
      const freshKid = new PaydirtClient(PB_URL);
      await freshKid.login(email, PW);
      expect(fresh.streak_count ?? 0).toBe(0);

      const chore = await createTestChore(0, "Streak time chore", { pay_mode: "time", reward_minutes: 5 });
      const assignment = await parent.assignChore(chore.id, fresh.id);
      await freshKid.markComplete(assignment.id);
      await parent.approveAssignment(assignment.id);

      expect(await parent.getBalance(fresh.id)).toBe(0);
      const k = (await parent.listChildren(householdId)).find((c) => c.id === fresh.id)!;
      expect(k.streak_count).toBe(1);
    });

    it("'both' pays bucks and minutes", async () => {
      const start = await parent.getBalance(kidUser.id);
      const chore = await createTestChore(12, "Both chore", { pay_mode: "both", reward_minutes: 5 });
      const assignment = await parent.assignChore(chore.id, kidUser.id);
      await kid.markComplete(assignment.id);
      await parent.approveAssignment(assignment.id);

      expect(await parent.getBalance(kidUser.id)).toBe(start + 12);
      const grants = await grantsFor(assignment.id);
      expect(grants.map((g) => g.minutes)).toEqual([5]);
    });

    it("a chore that granted time cannot be undone, even after the chore is edited back to bucks", async () => {
      const chore = await createTestChore(0, "No-undo time chore", { pay_mode: "time", reward_minutes: 15 });
      const assignment = await parent.assignChore(chore.id, kidUser.id);
      await kid.markComplete(assignment.id);
      await parent.approveAssignment(assignment.id);

      await parent.updateChore(chore.id, { pay_mode: "bucks", reward: 5, reward_minutes: 0 });
      await expect(parent.undoApproval(assignment.id)).rejects.toThrow();
      expect(await grantsFor(assignment.id)).toHaveLength(1);
    });

    it("bucks-only chores never create a grant, and a stale reward_minutes is ignored", async () => {
      const chore = await createTestChore(8, "Bucks chore", { pay_mode: "bucks", reward_minutes: 30 });
      expect(chore.reward_minutes).toBe(0);
      const assignment = await parent.assignChore(chore.id, kidUser.id);
      await kid.markComplete(assignment.id);
      await parent.approveAssignment(assignment.id);
      expect(await grantsFor(assignment.id)).toHaveLength(0);
    });

    it("rejects invalid pay setups on create and edit", async () => {
      const base = { household: householdId, name: "Invalid pay", type: "oneoff" as const, created_by: parent.currentUser!.id, active: true };
      await expect(parent.createChore({ ...base, reward: 0 })).rejects.toThrow();
      await expect(parent.createChore({ ...base, reward: 0, pay_mode: "time", reward_minutes: 0 })).rejects.toThrow();
      await expect(parent.createChore({ ...base, reward: 0, pay_mode: "time", reward_minutes: 7 })).rejects.toThrow();
      await expect(parent.createChore({ ...base, reward: 0, pay_mode: "time", reward_minutes: 600 })).rejects.toThrow();
      await expect(parent.createChore({ ...base, reward: 0, pay_mode: "both", reward_minutes: 10 })).rejects.toThrow();

      const ok = await createTestChore(5, "Valid then invalid");
      await expect(parent.updateChore(ok.id, { pay_mode: "time", reward_minutes: 0 })).rejects.toThrow();
    });
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

  // Balance minus the kid's other pending requests (seed data has some).
  async function availableBalance(): Promise<number> {
    const [balance, requests] = await Promise.all([
      parent.getBalance(kidUser.id),
      parent.listSpendRequestsForChild(kidUser.id),
    ]);
    return requests.filter((r) => r.status === "pending").reduce((n, r) => n - r.amount, balance);
  }

  it("spend requests exceeding the balance cannot even be submitted", async () => {
    const balance = await parent.getBalance(kidUser.id);
    // Free-form request: rejected up front, with a readable message.
    await expect(
      kid.submitSpendRequest(kidUser.id, balance + 1000, "moon rocket"),
    ).rejects.toMatchObject({ response: { message: expect.stringMatching(/enough/i) } });
    // Screen time goes through the same guard (60 min at 100 bucks/min).
    const household = await parent.getHousehold(householdId);
    await parent.updateHousehold(householdId, { screen_rate: 100 });
    try {
      await expect(
        kid.submitScreenTimeRequest(kidUser.id, 60, 100),
      ).rejects.toMatchObject({ response: { message: expect.stringMatching(/enough/i) } });
    } finally {
      await parent.updateHousehold(householdId, { screen_rate: household.screen_rate ?? 0 });
    }
    expect(await parent.getBalance(kidUser.id)).toBe(balance);
  });

  it("pending requests count against the balance for new requests", async () => {
    const available = await availableBalance();
    expect(available).toBeGreaterThan(0);
    const first = await kid.submitSpendRequest(kidUser.id, available, "uses it all");
    createdSpendRequests.push(first.id);
    try {
      await expect(kid.submitSpendRequest(kidUser.id, 1, "one more")).rejects.toMatchObject({
        response: { message: expect.stringMatching(/already requested/i) },
      });
    } finally {
      await parent.denySpendRequest(first.id, parent.currentUser!.id);
    }
    // Once the first is settled the funds are free again.
    const again = await kid.submitSpendRequest(kidUser.id, 1, "now fine");
    createdSpendRequests.push(again.id);
    await parent.denySpendRequest(again.id, parent.currentUser!.id);
  });

  it("new spend requests are forced pending and must be positive", async () => {
    await expect(
      kid.submitSpendRequest(kidUser.id, -500, "reverse spend"),
    ).rejects.toThrow();

    const sr = await kid.pb.collection(Collections.SpendRequests).create<SpendRequest>({
      child: kidUser.id,
      amount: 5,
      description: "self-approved",
      status: "approved",
      resolved_by: kidUser.id,
    });
    createdSpendRequests.push(sr.id);
    expect(sr.status).toBe("pending");
    expect(sr.resolved_by).toBe("");
    await parent.denySpendRequest(sr.id, parent.currentUser!.id);
  });

  it("screen-time requests are priced server-side from the household rate", async () => {
    const household = await parent.getHousehold(householdId);
    await parent.updateHousehold(householdId, { screen_rate: 2 });
    // Requests are balance-checked on create, so make sure 60 min is affordable.
    const topUp = Math.max(0, 120 - (await availableBalance()));
    if (topUp) await parent.adjustBalance(kidUser.id, topUp, "pricing test top-up");
    try {
      // A tampered client amount is overwritten with minutes × rate.
      const sr = await kid.pb.collection(Collections.SpendRequests).create<SpendRequest>({
        child: kidUser.id,
        amount: 1,
        description: "60 min screen time",
        screen_minutes: 60,
        status: "pending",
      });
      createdSpendRequests.push(sr.id);
      expect(sr.amount).toBe(120);
      await parent.denySpendRequest(sr.id, parent.currentUser!.id);

      // Off-preset minutes are rejected (no 20s, nothing over an hour).
      for (const m of [20, 75]) {
        await expect(
          kid.pb.collection(Collections.SpendRequests).create({
            child: kidUser.id,
            amount: 1,
            description: "odd screen time",
            screen_minutes: m,
            status: "pending",
          }),
        ).rejects.toThrow();
      }
    } finally {
      if (topUp) await parent.adjustBalance(kidUser.id, -topUp, "pricing test top-up cleanup");
      await parent.updateHousehold(householdId, { screen_rate: household.screen_rate ?? 0 });
    }
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

  it("children can only edit their own push settings, not privileged fields", async () => {
    const before = await parent.pb.collection(Collections.Users).getOne<User>(kidUser.id);
    const attempts: Partial<User>[] = [
      { balance: before.balance + 9999 },
      { role: "parent" },
      { simplified_mode: !before.simplified_mode },
      { fl_child_id: "123456789012" },
    ];
    try {
      for (const patch of attempts) {
        await expect(
          kid.pb.collection(Collections.Users).update(kidUser.id, patch),
        ).rejects.toThrow();
      }
      // The app's own self-updates still work.
      const ok = await kid.pb
        .collection(Collections.Users)
        .update<User>(kidUser.id, { up_endpoint: before.up_endpoint ?? "" });
      expect(ok.id).toBe(kidUser.id);
    } finally {
      // If the guard ever regresses, put the seeded kid back.
      await parent.pb.collection(Collections.Users).update(kidUser.id, {
        balance: before.balance,
        role: before.role,
        simplified_mode: before.simplified_mode,
        fl_child_id: before.fl_child_id ?? "",
      });
    }
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

  it("kid replies to a broadcast with a canned answer; parents are told; once only; parents can't reply", async () => {
    const msg = `reply test ${Date.now()}`;
    const b = await parent.sendBroadcast(householdId, parent.currentUser!.id, msg);
    const r = await kid.sendBroadcastReply(b.id, kidUser.id, "later");
    expect(r.code).toBe("later");
    const parent2 = new PaydirtClient(PB_URL);
    await parent2.login("parent2@test.local", PW);
    for (const p of [parent, parent2]) {
      const item = (await p.listInbox(p.currentUser!.id)).find((i) => i.body === `re: ${msg}`);
      expect(item?.title).toContain("⏰ Later");
    }
    await expect(kid.sendBroadcastReply(b.id, kidUser.id, "ok")).rejects.toThrow();
    await expect(kid.sendBroadcastReply(b.id, kidUser.id, "bogus")).rejects.toThrow();
    await expect(parent.sendBroadcastReply(b.id, parent.currentUser!.id, "ok")).rejects.toThrow();
    expect((await kid.listBroadcastReplies(kidUser.id)).some((x) => x.broadcast === b.id)).toBe(true);
  });

  it("inbox: broadcasts land in each recipient's history; owners can clear, nobody else can touch it", async () => {
    const msg = `inbox test ${Date.now()}`;
    await parent.sendBroadcast(householdId, parent.currentUser!.id, msg);

    const kidItems = await kid.listInbox(kidUser.id);
    const received = kidItems.find((i) => i.body === msg);
    expect(received).toMatchObject({ type: "broadcast", user: kidUser.id });
    // The sender keeps a copy too.
    const parentItems = await parent.listInbox(parent.currentUser!.id);
    expect(parentItems.find((i) => i.body === msg)?.type).toBe("broadcast_sent");

    // The other parent gets the full text, attributed to the sender.
    const parent2 = new PaydirtClient(PB_URL);
    await parent2.login("parent2@test.local", PW);
    const p2 = (await parent2.listInbox(parent2.currentUser!.id)).find((i) => i.body === msg);
    expect(p2?.type).toBe("broadcast");
    expect(p2?.title).toContain("messaged the kids");

    // Isolation: a kid can't read a parent's inbox, and clients can't forge items.
    const foreign = await kid.pb
      .collection(Collections.Inbox)
      .getList(1, 5, { filter: `user = "${parent.currentUser!.id}"` });
    expect(foreign.items).toHaveLength(0);
    await expect(
      kid.pb.collection(Collections.Inbox).create({ user: kidUser.id, title: "forged" }),
    ).rejects.toThrow();
    await expect(parent.deleteInboxItem(received!.id)).rejects.toThrow();

    // Owner delete.
    await kid.deleteInboxItem(received!.id);
    expect((await kid.listInbox(kidUser.id)).find((i) => i.body === msg)).toBeUndefined();
    await parent.clearInbox(parent.currentUser!.id);
    expect(await parent.listInbox(parent.currentUser!.id)).toHaveLength(0);
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

  it("resumeRealtime: events flow again after the socket is silently dropped", async () => {
    // Reproduces the mobile failure mode: the SSE socket dies without an
    // EventSource error (backgrounded app, half-open TCP), so the SDK never
    // auto-reconnects and events stop. resumeRealtime() must force a rebuild
    // and re-deliver — the same path useRealtimeResume takes on AppState
    // "active" / offline→online.
    let events = 0;
    const unsub = await kid.subscribeToKidUpdates(kidUser.id, () => {
      events += 1;
    });
    await new Promise((r) => setTimeout(r, 500));

    // Silent drop: the SDK's disconnect() is runtime-public but typed
    // private — it tears the socket down with no error event, exactly the
    // half-open death mobile sockets produce.
    (kid.pb.realtime as unknown as { disconnect: () => void }).disconnect();
    await new Promise((r) => setTimeout(r, 200));

    kid.resumeRealtime();
    // Allow reconnect + subscription re-submit to settle before triggering.
    await new Promise((r) => setTimeout(r, 1500));

    const chore = await createTestChore(1, "Resume test chore");
    await parent.assignChore(chore.id, kidUser.id);

    await expect(
      Promise.race([
        (async () => {
          while (events === 0) await new Promise((r) => setTimeout(r, 100));
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("no realtime event after resume within 5s")), 5000),
        ),
      ]),
    ).resolves.toBeUndefined();
    expect(events).toBeGreaterThan(0);

    await unsub();
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

  it("avatar upload: a kid can set their own photo, but not other profile fields", async () => {
    const form = () => {
      const f = new FormData();
      f.append("avatar", new Blob([TINY_JPEG], { type: "image/jpeg" }), "me.jpg");
      return f;
    };
    try {
      const updated = await kid.pb.collection("users").update<User>(kidUser.id, form());
      expect(updated.avatar).toMatch(/\.jpg$/);
      const res = await fetch(avatarUrl(kid.pb, updated, "100x100"));
      expect(res.status).toBe(200);
      // Photo access doesn't widen anything else: color stays parent-only.
      await expect(kid.pb.collection("users").update(kidUser.id, { color: "#123456" })).rejects.toThrow();
      // A parent can still replace or clear it.
      const byParent = await parent.pb.collection("users").update<User>(kidUser.id, form());
      expect(byParent.avatar).toMatch(/\.jpg$/);
    } finally {
      await parent.pb.collection("users").update(kidUser.id, { avatar: null });
    }
  });
  it("assign-time limit warnings: none without a limit, flagged at the limit, 'assign anyway' still works", async () => {
    const unlimited = await createTestChore(5, `no limit ${Date.now()}`);
    await parent.assignChore(unlimited.id, kidUser.id);
    await parent.assignChore(unlimited.id, kidUser.id);
    expect(await parent.assignLimitWarnings(unlimited.id, [kidUser.id])).toEqual([]);

    const limited = await createTestChore(5, `limit 1 ${Date.now()}`, { max_per_period: 1 });
    expect(await parent.assignLimitWarnings(limited.id, [kidUser.id])).toEqual([]);
    const first = await parent.assignChore(limited.id, kidUser.id);
    const warned = await parent.assignLimitWarnings(limited.id, [kidUser.id]);
    expect(warned).toEqual([{ childId: kidUser.id, count: 1, max: 1, windowDays: 7 }]);

    // The warning is advisory: the parent can still assign.
    const second = await parent.assignChore(limited.id, kidUser.id);
    expect(second.id).not.toBe(first.id);

    // Race-closed assignments don't count toward the limit.
    const raced = await createTestChore(5, `limit closed ${Date.now()}`, { max_per_period: 1 });
    const a = await parent.assignChore(raced.id, kidUser.id);
    await parent.pb.collection("assignments").update(a.id, { status: "closed" });
    expect(await parent.assignLimitWarnings(raced.id, [kidUser.id])).toEqual([]);
  });

  it("sibling balances are hidden from kids unless the household opts in; parents and self always see them", async () => {
    const sibling = (await parent.listChildren(householdId)).find((k) => k.id !== kidUser.id)!;
    try {
      await parent.updateHousehold(householdId, { kids_see_balances: false });
      const hidden = await kid.pb.collection(Collections.Users).getOne<User>(sibling.id);
      expect(hidden.balance).toBeUndefined();
      expect((await kid.pb.collection(Collections.Users).getOne<User>(kidUser.id)).balance).toBeTypeOf("number");
      expect((await parent.pb.collection(Collections.Users).getOne<User>(sibling.id)).balance).toBeTypeOf("number");

      await parent.updateHousehold(householdId, { kids_see_balances: true });
      expect((await kid.pb.collection(Collections.Users).getOne<User>(sibling.id)).balance).toBeTypeOf("number");
    } finally {
      await parent.updateHousehold(householdId, { kids_see_balances: false });
    }
  });
});
