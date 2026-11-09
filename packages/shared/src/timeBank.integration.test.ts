import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import PocketBase from "pocketbase";
import { PaydirtClient } from "./client";
import { EventSource } from "eventsource";
import { timeBankTotals } from "./timeBank";
import { processFamilyLinkQueue } from "./familylinkQueue";

(globalThis as { EventSource?: unknown }).EventSource = EventSource;

// Real PocketBase, migrations, hooks and disk; no Google session or network.
describe("Earned-time bank (isolated PocketBase)", () => {
  const repo = resolve(import.meta.dirname, "../../..");
  const root = mkdtempSync(join(tmpdir(), "paydirt-fl-test-"));
  const queue = join(root, "familylink");
  let server: ChildProcess | undefined;
  let parent: PaydirtClient;
  let kid: PaydirtClient;
  let admin: PocketBase;
  let url: string;

  beforeAll(async () => {
    const reservation = createServer();
    await new Promise<void>((done) => reservation.listen(0, "127.0.0.1", done));
    const port = (reservation.address() as { port: number }).port;
    await new Promise<void>((done) => reservation.close(() => done()));
    url = `http://127.0.0.1:${port}`;
    const hooks = join(root, "hooks");
    cpSync(join(repo, "pocketbase/pb_hooks"), hooks, { recursive: true });
    // Test-only trigger for the real cron handler. Never shipped to the host.
    writeFileSync(join(hooks, "test.pb.js"), `
      routerAdd("POST", "/test/reconcile", (e) => {
        const at = e.requestInfo().query.at;
        require(__hooks + "/lib/familylink.js").reconcile(e.app, at ? new Date(at) : undefined);
        return e.json(200, {});
      });
      routerAdd("POST", "/test/legacy-time", (e) => {
        const r = new Record(e.app.findCollectionByNameOrId("time_grants"));
        r.set("child", e.app.findFirstRecordByData("users", "email", "child1@test.local").id);
        r.set("minutes", 10); r.set("grant_status", "queued");
        r.set("description", "Existing queued chore time"); e.app.save(r);
        return e.json(200, { id: r.id });
      });
      routerAdd("POST", "/test/rollback/{id}", (e) => {
        e.app.runInTransaction((tx) => {
          const a = tx.findRecordById("assignments", e.request.pathValue("id"));
          a.set("status", "approved"); tx.save(a);
          throw new BadRequestError("Intentional transaction rollback");
        });
      });
      routerAdd("POST", "/test/streak/{id}", (e) => {
        const kid = e.app.findRecordById("users", e.request.pathValue("id"));
        const hh = e.app.findRecordById("households", kid.getString("household"));
        require(__hooks + "/lib/balanceReactions.js").refreshStreak(e.app, kid, hh);
        return e.json(200, {});
      });
    `);
    const binary = join(repo, "pocketbase/pocketbase");
    const args = ["--dir", join(root, "data"), "--migrationsDir", join(repo, "pocketbase/pb_migrations")];
    execFileSync(binary, ["migrate", "up", ...args], { stdio: "ignore" });
    execFileSync(binary, ["superuser", "upsert", "admin@paydirt.local", "password123", ...args], { stdio: "ignore" });
    server = spawn(binary, ["serve", ...args, "--hooksDir", hooks, "--http", `127.0.0.1:${port}`], {
      stdio: "ignore",
      env: { ...process.env, NTFY_DISABLED: "1", FL_AUTOMATION_ENABLED: "1", FL_QUEUE_DIR: queue },
    });
    let healthy = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { healthy = (await fetch(`${url}/api/health`)).ok; } catch { /* Startup. */ }
      if (healthy) break;
      await new Promise((done) => setTimeout(done, 100));
    }
    if (!healthy) throw new Error("Isolated PocketBase did not start");
    execFileSync(process.execPath, [join(repo, "pocketbase/seed.mjs")], {
      stdio: "ignore", env: { ...process.env, PB_URL: url },
    });
    parent = new PaydirtClient(url);
    kid = new PaydirtClient(url);
    await parent.login("parent1@test.local", "password123");
    await kid.login("child1@test.local", "password123");
    admin = new PocketBase(url);
    await admin.collection("_superusers").authWithPassword("admin@paydirt.local", "password123");
  }, 20_000);

  afterAll(async () => {
    if (server && server.exitCode === null) {
      const exited = new Promise<void>((done) => server!.once("exit", () => done()));
      server.kill();
      await exited;
    }
    rmSync(root, { recursive: true, force: true });
  });


  const child = () => kid.currentUser!.id;
  const hh = () => parent.currentUser!.household;
  async function totals() {
    const bank = await kid.getTimeBank(child());
    return timeBankTotals(bank.ledger, bank.grants, bank.purchases);
  }
  async function earn(minutes: number, choice: "bank" | "use" = "bank", mode: "time" | "both" = "time") {
    const chore = await parent.createChore({ household: hh(), name: "Bank test chore", reward: mode === "both" ? 10 : 0,
      type: "oneoff", created_by: parent.currentUser!.id, active: true, pay_mode: mode, reward_minutes: minutes });
    const assignment = await parent.assignChore(chore.id, child());
    await kid.markComplete(assignment.id, undefined, choice);
    await parent.approveAssignment(assignment.id);
    return assignment;
  }
  const tick = async (at?: string) => {
    const response = await fetch(`${url}/test/reconcile${at ? "?at=" + encodeURIComponent(at) : ""}`, { method: "POST" });
    expect(response.ok).toBe(true);
  };

  it("holds bedtime earnings through morning; delivers only the explicitly redeemed portion, without Grit", async () => {
    await parent.pb.collection("users").update(child(), { fl_child_id: "123456789012", fl_device_id: "a".repeat(30) });
    await parent.pb.collection("households").update(hh(), { grant_timezone: "America/Los_Angeles", grant_weekday_window: "none", grant_weekend_window: "none", grant_expiry_days: 0 });
    const balance = await kid.getBalance(child());
    const assignment = await earn(45);
    expect((await totals()).available).toBe(45);
    expect((await parent.listBonusGrants(hh())).some((g) => g.assignment === assignment.id)).toBe(false);
    await tick("2099-11-05T04:00:00.000Z");
    await parent.pb.collection("households").update(hh(), { grant_weekday_window: "all", grant_weekend_window: "all" });
    await tick("2099-11-05T16:00:00.000Z");
    expect((await totals()).available).toBe(45);
    const request = await kid.redeemSavedTime(15, "morning_partial_redemption");
    await kid.redeemSavedTime(15, "morning_partial_redemption");
    expect((await totals()).available).toBe(30);
    const grant = (await parent.listBonusGrants(hh())).find((g) => g.redemption === request.id)!;
    expect(grant.minutes).toBe(15);
    expect(grant.grant_dispatch_started).toBe(true);
    let delivered = 0;
    await processFamilyLinkQueue(queue, async (job) => { delivered += job.seconds; return 0; }, true);
    await tick(); await tick();
    expect(delivered).toBe(900);
    expect((await totals()).available).toBe(30);
    expect(await kid.getBalance(child())).toBe(balance);
    const history = (await kid.getTimeBank(child())).ledger;
    expect(history.filter((r) => r.redemption === request.id).map((r) => r.kind).sort()).toEqual(["redeem", "reserve"]);
  });

  it("rejects forged amounts, keys, ownership, and sibling reads; parents can see their kids", async () => {
    for (const minutes of [0, -15, 5, 10, 16, 15.5, 135]) {
      await expect(kid.redeemSavedTime(minutes, "invalid_amount_key")).rejects.toThrow();
    }
    await expect(kid.redeemSavedTime(15, "short")).rejects.toThrow();
    await expect(parent.redeemSavedTime(15, "parent_cannot_spend")).rejects.toThrow();
    await expect(kid.pb.collection("time_ledger").create({ child: child(), kind: "earn", minutes: 900, event_key: "forged" })).rejects.toThrow();
    const sibling = new PaydirtClient(url);
    await sibling.login("child2@test.local", "password123");
    const ledger = (await parent.getTimeBank(child())).ledger;
    expect(ledger.length).toBeGreaterThan(0);
    await expect(sibling.pb.collection("time_ledger").getOne(ledger[0]!.id)).rejects.toThrow();
    expect((await sibling.pb.collection("time_ledger").getFullList()).length).toBe(0);
    const grant = (await parent.pb.collection("time_grants").getFullList())[0]!;
    await expect(sibling.pb.collection("time_grants").getOne(grant.id)).rejects.toThrow();
    await expect(kid.pb.collection("time_ledger").update(ledger[0]!.id, { minutes: 999 })).rejects.toThrow();
    await expect(parent.pb.collection("time_ledger").delete(ledger[0]!.id)).rejects.toThrow();
  });

  it("blocks sibling purchase-request reads used by the bank totals", async () => {
    await parent.adjustBalance(child(), 100, "Private request fixture");
    const request = await kid.submitScreenTimeRequest(child(), 15, 1);
    const sibling = new PaydirtClient(url);
    await sibling.login("child2@test.local", "password123");
    await expect(sibling.pb.collection("spend_requests").getOne(request.id)).rejects.toThrow();
    expect(await sibling.pb.collection("spend_requests").getFullList({ filter: sibling.pb.filter("child = {:c}", { c: child() }) })).toHaveLength(0);
    expect((await parent.pb.collection("spend_requests").getOne(request.id)).id).toBe(request.id);
    await parent.denySpendRequest(request.id, parent.currentUser!.id);
  });

  it("serializes concurrent debits, dedupes retries, and rejects reuse for a different amount", async () => {
    const before = (await totals()).available;
    const calls = await Promise.allSettled([
      kid.redeemSavedTime(30, "concurrent_bank_one"), kid.redeemSavedTime(30, "concurrent_bank_two"),
    ]);
    expect(calls.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await totals()).available).toBe(before - 30);
    const success = calls.findIndex((r) => r.status === "fulfilled");
    const key = success === 0 ? "concurrent_bank_one" : "concurrent_bank_two";
    await kid.redeemSavedTime(30, key);
    await expect(kid.redeemSavedTime(15, key)).rejects.toThrow();
    expect((await totals()).available).toBe(before - 30);
    await processFamilyLinkQueue(queue, async () => 0, true); await tick();
  });

  it("requires explicit after-hours queueing and never drains the rest", async () => {
    await earn(30, "bank", "both");
    await parent.pb.collection("households").update(hh(), { grant_weekday_window: "none", grant_weekend_window: "none" });
    const before = await totals();
    await expect(kid.redeemSavedTime(15, "after_hours_confirm")).rejects.toThrow();
    expect((await totals()).available).toBe(before.available);
    await kid.redeemSavedTime(15, "after_hours_confirm", true);
    expect((await totals()).available).toBe(before.available - 15);
    await parent.pb.collection("households").update(hh(), { grant_weekday_window: "all", grant_weekend_window: "all" });
    await tick(); await processFamilyLinkQueue(queue, async () => 0, true); await tick();
    expect((await totals()).available).toBe(before.available - 15);
  });

  it("cancels only unpublished queued reservations and releases once", async () => {
    await parent.pb.collection("households").update(hh(), { grant_weekday_window: "none", grant_weekend_window: "none" });
    const before = (await totals()).available;
    const request = await kid.redeemSavedTime(15, "cancel_unstarted_time", true);
    expect((await totals()).available).toBe(before - 15);
    await kid.cancelSavedTime(request.id); await kid.cancelSavedTime(request.id);
    expect((await totals()).available).toBe(before);
    expect((await kid.getTimeRedemption(request.id)).cancelled).toBe(true);
    await kid.redeemSavedTime(15, "cancel_unstarted_time", true);
    expect((await totals()).available).toBe(before);
    await parent.pb.collection("households").update(hh(), { grant_weekday_window: "all", grant_weekend_window: "all" });
    const queued = await kid.redeemSavedTime(15, "cannot_cancel_queued");
    await expect(kid.cancelSavedTime(queued.id)).rejects.toThrow();
    await processFamilyLinkQueue(queue, async () => 2, true); await tick();
    await expect(kid.cancelSavedTime(queued.id)).rejects.toThrow();
  });

  it("defaults to Bank, keeps sub-15 rewards saved, and snapshots partial pay exactly once", async () => {
    const before = (await totals()).available;
    await earn(10, "use");
    expect((await totals()).available).toBe(before + 10);
    const chore = await parent.createChore({ household: hh(), name: "Partial bank", reward: 20, type: "oneoff",
      created_by: parent.currentUser!.id, active: true, pay_mode: "both", reward_minutes: 30 });
    const assignment = await parent.assignChore(chore.id, child());
    await kid.markComplete(assignment.id);
    const decisions = await Promise.allSettled([parent.approveAssignment(assignment.id, 50), parent.approveAssignment(assignment.id, 50)]);
    expect(decisions.some((r) => r.status === "fulfilled")).toBe(true);
    const ledger = (await kid.getTimeBank(child())).ledger.filter((r) => r.assignment === assignment.id);
    expect(ledger).toHaveLength(1); expect(ledger[0]!.minutes).toBe(15);
    await parent.updateChore(chore.id, { reward_minutes: 60 });
    expect((await kid.getTimeBank(child())).ledger.find((r) => r.id === ledger[0]!.id)?.minutes).toBe(15);
    await expect(parent.pb.collection("assignments").update(assignment.id, { status: "assigned" })).rejects.toThrow();
    const rejected = await parent.assignChore(chore.id, child());
    await kid.markComplete(rejected.id); await parent.rejectAssignment(rejected.id);
    expect((await kid.getTimeBank(child())).ledger.some((r) => r.assignment === rejected.id)).toBe(false);
  });
  it("rolls approval, earnings, reservation and outbox back together on failure", async () => {
    const chore = await parent.createChore({ household: hh(), name: "Atomic bank rollback", reward: 0, type: "oneoff",
      created_by: parent.currentUser!.id, active: true, pay_mode: "time", reward_minutes: 30 });
    const a = await parent.assignChore(chore.id, child());
    await kid.markComplete(a.id, undefined, "use");
    const before = readdirSync(join(queue, "pending")).sort();
    const response = await fetch(`${url}/test/rollback/${a.id}`, { method: "POST" });
    expect(response.status).toBe(400);
    expect((await parent.pb.collection("assignments").getOne(a.id)).status).toBe("completed");
    expect((await kid.getTimeBank(child())).ledger.some((r) => r.assignment === a.id)).toBe(false);
    expect(await parent.pb.collection("time_grants").getFullList({ filter: parent.pb.filter("assignment = {:a}", { a: a.id }) })).toHaveLength(0);
    expect(readdirSync(join(queue, "pending")).sort()).toEqual(before);
  });

  it("preserves legacy queued grants without silently converting them into held earnings", async () => {
    const before = await totals();
    const response = await fetch(`${url}/test/legacy-time`, { method: "POST" });
    const legacy = await response.json() as { id: string };
    expect((await totals()).available).toBe(before.available);
    expect((await totals()).queued).toBe(before.queued + 10);
    await tick();
    let seconds = 0;
    await processFamilyLinkQueue(queue, async (job) => { if (job.id === legacy.id) seconds += job.seconds; return 0; }, true);
    await tick();
    expect(seconds).toBe(600);
    expect((await totals()).available).toBe(before.available);
  });

  it("refreshes parent and owning-kid totals over realtime ledger updates", async () => {
    let parentEvents = 0, kidEvents = 0;
    const stopParent = await parent.subscribeToDashboardUpdates(hh(), () => { parentEvents++; });
    const stopKid = await kid.subscribeToKidUpdates(child(), () => { kidEvents++; });
    try {
      await earn(15);
      for (let i = 0; i < 50 && (!parentEvents || !kidEvents); i++) await new Promise((done) => setTimeout(done, 20));
      expect(parentEvents).toBeGreaterThan(0); expect(kidEvents).toBeGreaterThan(0);
      const own = await totals();
      const bank = await parent.getTimeBank(child());
      expect(timeBankTotals(bank.ledger, bank.grants, bank.purchases)).toEqual(own);
    } finally { stopParent(); stopKid(); }
  });

  it("does not treat standalone parent bonuses as chore-earning streak days", async () => {
    const fresh = await admin.collection("users").create({ email: "bonus-streak@test.local", password: "password123", passwordConfirm: "password123",
      verified: true, role: "child", display_name: "Bonus streak", household: hh() });
    await parent.giveBonusMinutes(fresh.id, 15, "Not a chore", "bonus_is_not_a_chore");
    expect((await fetch(`${url}/test/streak/${fresh.id}`, { method: "POST" })).ok).toBe(true);
    expect((await parent.pb.collection("users").getOne(fresh.id)).streak_count).toBe(0);
  });

  it("never releases manual-review reservations while a parent confirms delivery", async () => {
    await parent.pb.collection("users").update(child(), { fl_child_id: "", fl_device_id: "" });
    const before = (await totals()).available;
    const request = await kid.redeemSavedTime(15, "cancel_vs_parent_confirm");
    const grant = (await kid.getTimeBank(child())).grants.find((g) => g.redemption === request.id)!;
    const outcomes = await Promise.allSettled([kid.cancelSavedTime(request.id), parent.confirmBonusGrant(grant.id)]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const result = await parent.pb.collection("time_grants").getOne(grant.id);
    const history = (await kid.getTimeBank(child())).ledger.filter((r) => r.redemption === request.id && r.kind !== "reserve");
    expect(history).toHaveLength(1);
    expect(history[0]!.kind).toBe(result.grant_status === "cancelled" ? "release" : "redeem");
    expect((await totals()).available).toBe(result.grant_status === "cancelled" ? before : before - 15);
  });

  it("serializes first publication against cancellation before a window opens", async () => {
    await parent.pb.collection("users").update(child(), { fl_child_id: "123456789012", fl_device_id: "a".repeat(30) });
    await parent.pb.collection("households").update(hh(), { grant_weekday_window: "none", grant_weekend_window: "none" });
    const before = (await totals()).available;
    const request = await kid.redeemSavedTime(15, "publication_vs_cancel", true);
    const grant = (await kid.getTimeBank(child())).grants.find((g) => g.redemption === request.id)!;
    expect(grant.grant_dispatch_started).toBe(false);
    await parent.pb.collection("households").update(hh(), { grant_weekday_window: "all", grant_weekend_window: "all" });
    await Promise.allSettled([tick(), kid.cancelSavedTime(request.id)]);
    const result = await parent.pb.collection("time_grants").getOne(grant.id);
    if (result.grant_status === "cancelled") {
      expect(readdirSync(join(queue, "pending"))).not.toContain(`${grant.id}.json`);
      expect((await totals()).available).toBe(before);
    } else {
      expect(result.grant_dispatch_started).toBe(true);
      expect((await totals()).available).toBe(before - 15);
      await expect(kid.cancelSavedTime(request.id)).rejects.toThrow();
    }
  });

  it("refuses rollback when it would destroy a populated saved-minute ledger", async () => {
    const exit = new Promise<void>((done) => server!.once("exit", () => done()));
    server!.kill(); await exit;
    const binary = join(repo, "pocketbase/pocketbase");
    expect(() => execFileSync(binary, ["migrate", "down", "1", "--dir", join(root, "data"),
      "--migrationsDir", join(repo, "pocketbase/pb_migrations")], { input: "y\n", stdio: ["pipe", "ignore", "ignore"] })).toThrow();
  });

});
