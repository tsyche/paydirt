import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
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
describe("Parent delivery override (isolated PocketBase)", () => {
  const repo = resolve(import.meta.dirname, "../../..");
  const root = mkdtempSync(join(tmpdir(), "paydirt-deliver-now-"));
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
    `);
    const binary = join(repo, "pocketbase/pocketbase");
    const args = ["--dir", join(root, "data"), "--migrationsDir", join(repo, "pocketbase/pb_migrations")];
    execFileSync(binary, ["migrate", "up", ...args], { stdio: "ignore" });
    execFileSync(binary, ["superuser", "upsert", "admin@paydirt.local", "password123", ...args], { stdio: "ignore" });
    server = spawn(binary, ["serve", ...args, "--hooksWatch=false", "--hooksDir", hooks, "--http", `127.0.0.1:${port}`], {
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

  async function queued(kind: "bonus" | "bank" | "purchase", minutes = 15) {
    await parent.pb.collection("households").update(hh(), { grant_weekday_window: "none", grant_weekend_window: "none", grant_expiry_days: 0 });
    await parent.pb.collection("users").update(child(), { fl_child_id: "123456789012", fl_device_id: "a".repeat(30) });
    const key = `override_${kind}_${Date.now()}`;
    if (kind === "bonus") return { id: (await parent.giveBonusMinutes(child(), minutes, "Holiday time", key)).id, collection: "time_grants" as const };
    if (kind === "bank") {
      await earn(minutes);
      const r = await kid.redeemSavedTime(minutes, key, true);
      return { id: (await kid.getTimeBank(child())).grants.find((g) => g.redemption === r.id)!.id, collection: "time_grants" as const };
    }
    await parent.adjustBalance(child(), 1000, "Override purchase fixture");
    const r = await kid.submitScreenTimeRequest(child(), 15, 1);
    const before = await kid.getBalance(child());
    await parent.approveSpendRequest(r.id, parent.currentUser!.id);
    expect(await kid.getBalance(child())).toBe(before - r.amount);
    expect((await parent.listTransactions(child())).filter((row) => row.related_spend_request === r.id && row.type === "spend")).toHaveLength(1);
    return { id: r.id, collection: "spend_requests" as const };
  }
  const record = (g: { id: string; collection: string }) => parent.pb.collection(g.collection).getOne(g.id);
  const job = (id: string) => JSON.parse(readFileSync(join(queue, "pending", `${id}.json`), "utf8"));

  it.each(["bonus", "bank", "purchase"] as const)("delivers a queued %s outside windows exactly once without changing accounting or schedules", async (kind) => {
    const g = await queued(kind);
    expect((await record(g)).grant_window_override).toBe(false);
    await expect(kid.pb.collection(g.collection).update(g.id, { grant_window_override: true })).rejects.toThrow();
    const balance = await kid.getBalance(child());
    const saved = (await totals()).available;
    await Promise.all([parent.deliverGrantNow(g.collection, g.id), parent.deliverGrantNow(g.collection, g.id)]);
    expect(job(g.id).seconds).toBe(900);
    expect(job(g.id).validUntil).toBeUndefined();
    const calls: string[] = [];
    await processFamilyLinkQueue(queue, async (j) => { calls.push(j.id); return 0; }, true);
    await tick();
    expect((await record(g)).grant_status).toBe("granted");
    await parent.deliverGrantNow(g.collection, g.id);
    await processFamilyLinkQueue(queue, async (j) => { calls.push(j.id); return 0; }, true);
    expect(calls.filter((id) => id === g.id)).toHaveLength(1);
    expect(await kid.getBalance(child())).toBe(balance);
    expect((await totals()).available).toBe(saved);
    expect((await parent.getHousehold(hh())).grant_weekday_window).toBe("none");
    expect((await parent.getHousehold(hh())).grant_weekend_window).toBe("none");
  }, 20_000);

  it("does not rewrite a live job, and safely retries its deferred result outside the old window", async () => {
    const g = await queued("bonus");
    // Simulate a queued worker job whose earlier window has just closed.
    writeFileSync(join(queue, "pending", `${g.id}.json`), JSON.stringify({ id: g.id, childId: "123456789012", deviceId: "a".repeat(30), seconds: 900, validUntil: "2000-01-01T00:00:00Z" }));
    await parent.deliverGrantNow(g.collection, g.id);
    expect(job(g.id).validUntil).toBe("2000-01-01T00:00:00Z");
    expect((await record(g)).grant_error).toBe("Parent delivery override enabled.");
    let calls = 0;
    await processFamilyLinkQueue(queue, async () => { calls++; return 0; }, true);
    expect(calls).toBe(0);
    const receipt = join(queue, "results", `${g.id}.json`);
    writeFileSync(receipt, JSON.stringify({ id: g.id, status: "deferred", retryAfter: "2099-01-01T00:00:00Z" }));
    await parent.deliverGrantNow(g.collection, g.id);
    expect(job(g.id).validUntil).toBeUndefined();
    await processFamilyLinkQueue(queue, async () => { calls++; return 0; }, true);
    await tick();
    expect(calls).toBe(1);
    expect((await record(g)).grant_status).toBe("granted");
  });

  it("keeps the override for partial remainders and never replays uncertain time", async () => {
    const g = await queued("bonus", 30);
    await parent.deliverGrantNow(g.collection, g.id);
    await processFamilyLinkQueue(queue, async () => ({ code: 0, deliveredSeconds: 600 }), true);
    await tick();
    expect(job(`${g.id}-600`).seconds).toBe(1200);
    expect(job(`${g.id}-600`).validUntil).toBeUndefined();
    await parent.deliverGrantNow(g.collection, g.id);
    await processFamilyLinkQueue(queue, async () => 1, true);
    await tick();
    expect((await record(g)).grant_status).toBe("manual");
    await parent.deliverGrantNow(g.collection, g.id);
    let replayed = false;
    await processFamilyLinkQueue(queue, async () => { replayed = true; return 0; }, true);
    expect(replayed).toBe(false);
    expect((await record(g)).grant_delivered_seconds).toBe(600);
  });

  it("enforces household/parent authority, protected fields, and existing expiry", async () => {
    const g = await queued("bonus");
    await expect(kid.deliverGrantNow(g.collection, g.id)).rejects.toMatchObject({ status: 403 });
    await expect(parent.pb.collection(g.collection).update(g.id, { grant_window_override: true })).rejects.toMatchObject({ status: 403 });
    const household = await admin.collection("households").create({ name: "Other household" });
    await admin.collection("users").create({ email: "override-outside@test.local", password: "password123", passwordConfirm: "password123", role: "parent", household: household.id, display_name: "Outside parent" });
    const outside = new PaydirtClient(url); await outside.login("override-outside@test.local", "password123");
    await expect(outside.deliverGrantNow(g.collection, g.id)).rejects.toMatchObject({ status: 403 });
    await parent.pb.collection("users").update(child(), { fl_child_id: "" });
    const manual = await parent.giveBonusMinutes(child(), 15, "Manual review", "override_manual_fixture");
    await expect(parent.deliverGrantNow("time_grants", manual.id)).rejects.toMatchObject({ status: 400 });
    await parent.pb.collection("households").update(hh(), { grant_expiry_days: 1 });
    const db = new DatabaseSync(join(root, "data/data.db"));
    try { db.prepare("UPDATE time_grants SET created = ? WHERE id = ?").run("2000-01-01 00:00:00Z", g.id); } finally { db.close(); }
    await parent.deliverGrantNow(g.collection, g.id);
    expect((await record(g)).grant_status).toBe("manual");
    expect(existsSync(join(queue, "pending", `${g.id}.json`))).toBe(false);
  });

  it("blocks rollback with an active override and preserves existing data through down/up", async () => {
    const g = await queued("bonus");
    await parent.deliverGrantNow(g.collection, g.id);
    expect((await record(g)).grant_status).toBe("queued");
    expect((await record(g)).grant_window_override).toBe(true);
    const stopped = new Promise<void>((done) => server!.once("exit", () => done()));
    server!.kill(); await stopped;
    const binary = join(repo, "pocketbase/pocketbase");
    const args = ["--dir", join(root, "data"), "--migrationsDir", join(repo, "pocketbase/pb_migrations")];
    expect(() => execFileSync(binary, ["migrate", "down", "1", ...args], { input: "y\n", stdio: ["pipe", "ignore", "ignore"] })).toThrow();
    let db = new DatabaseSync(join(root, "data/data.db"));
    const before = db.prepare("SELECT id, balance FROM users ORDER BY id").all();
    const count = db.prepare("SELECT COUNT(*) AS n FROM currency_transactions").get();
    try {
      expect(db.prepare("SELECT grant_window_override FROM time_grants WHERE id = ?").get(g.id)?.grant_window_override).toBe(1);
      db.prepare("UPDATE time_grants SET grant_window_override = 0 WHERE id = ?").run(g.id);
    } finally { db.close(); }
    execFileSync(binary, ["migrate", "down", "1", ...args], { input: "y\n", stdio: ["pipe", "ignore", "ignore"] });
    db = new DatabaseSync(join(root, "data/data.db"));
    try { expect(db.prepare("PRAGMA table_info(time_grants)").all().map((column) => column.name)).not.toContain("grant_window_override"); }
    finally { db.close(); }
    execFileSync(binary, ["migrate", "up", ...args], { stdio: "ignore" });
    db = new DatabaseSync(join(root, "data/data.db"));
    try {
      expect(db.prepare("SELECT id, balance FROM users ORDER BY id").all()).toEqual(before);
      expect(db.prepare("SELECT COUNT(*) AS n FROM currency_transactions").get()).toEqual(count);
      expect(db.prepare("SELECT grant_window_override FROM time_grants WHERE id = ?").get(g.id)?.grant_window_override).toBe(0);
    } finally { db.close(); }
  });
});
