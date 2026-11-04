import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import PocketBase from "pocketbase";
import { PaydirtClient } from "./client";
import type { SpendRequest } from "./types";
import { processFamilyLinkQueue } from "./familylinkQueue";

// Real PocketBase, migrations, hooks and disk; no Google session or network.
describe("Family Link approval queue (isolated PocketBase)", () => {
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
        require(__hooks + "/lib/familylink.js").reconcile(e.app);
        return e.json(200, {});
      });
      routerAdd("POST", "/test/historical", (e) => {
        const r = new Record(e.app.findCollectionByNameOrId("spend_requests"));
        r.set("child", e.app.findFirstRecordByData("users", "email", "child1@test.local").id);
        r.set("amount", 15);
        r.set("description", "Historical");
        r.set("screen_minutes", 15);
        r.set("status", "approved");
        e.app.save(r);
        return e.json(200, {id: r.id});
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

  async function approve(minutes = 15) {
    await parent.adjustBalance(kid.currentUser!.id, 100, "Queue test funds");
    const request = await kid.submitScreenTimeRequest(kid.currentUser!.id, minutes as 15, 1);
    await parent.approveSpendRequest(request.id, parent.currentUser!.id);
    return parent.pb.collection("spend_requests").getOne<SpendRequest>(request.id);
  }

  it("cannot reopen a settled spend or charge it twice", async () => {
    const request = await approve();
    const balance = await parent.getBalance(kid.currentUser!.id);
    await expect(parent.pb.collection("spend_requests").update(request.id, { status: "pending" })).rejects.toThrow();
    await parent.approveSpendRequest(request.id, parent.currentUser!.id);
    expect(await parent.getBalance(kid.currentUser!.id)).toBe(balance);
  });

  it("keeps submitted spending terms immutable", async () => {
    const request = await kid.submitScreenTimeRequest(kid.currentUser!.id, 15, 1);
    for (const patch of [{ screen_minutes: 60 }, { amount: 1 }, { description: "Changed" }]) {
      await expect(parent.pb.collection("spend_requests").update(request.id, patch)).rejects.toThrow();
    }
  });

  it("clears spoofed results on create and rejects API result forgery", async () => {
    const request = await kid.pb.collection("spend_requests").create<SpendRequest>({
      child: kid.currentUser!.id, amount: 15, description: "Spoof",
      screen_minutes: 15, grant_status: "granted", grant_error: "forged",
    });
    expect(request.grant_status).toBe("");
    expect(request.grant_error).toBe("");
    await expect(parent.pb.collection("spend_requests").update(request.id, {
      grant_status: "granted",
    })).rejects.toThrow();
  });

  it("falls back to manual when IDs are absent and accepts a parent's completion", async () => {
    const request = await approve();
    expect(request.grant_status).toBe("manual");
    expect(request.grant_error).toContain("target is missing");
    const done = await parent.confirmManualGrant(request.id);
    expect(done.grant_status).toBe("manual_done");
    expect(done.grant_error).toBe("");
    await expect(kid.pb.collection("spend_requests").update(request.id, {
      grant_status: "manual",
    })).rejects.toThrow();
  });

  it("only queues screen time, publishes once, and reconciles worker results", async () => {
    await parent.pb.collection("users").update(kid.currentUser!.id, {
      fl_child_id: "123456789012", fl_device_id: "a".repeat(30),
    });
    const ordinary = await kid.submitSpendRequest(kid.currentUser!.id, 1, "A toy");
    await parent.approveSpendRequest(ordinary.id, parent.currentUser!.id);
    expect((await parent.pb.collection("spend_requests").getOne(ordinary.id)).grant_status).toBe("");
    const request = await approve();
    expect(request.grant_status).toBe("queued");
    expect((await parent.listScreenTimeGrants(parent.currentUser!.household)).map((r) => r.id)).toContain(request.id);
    const filename = `${request.id}.json`;
    expect(readdirSync(join(queue, "pending"))).toEqual([filename]);
    expect(JSON.parse(readFileSync(join(queue, "pending", filename), "utf8"))).toEqual({
      id: request.id, childId: "123456789012", deviceId: "a".repeat(30), seconds: 900,
    });
    await expect(parent.pb.collection("spend_requests").delete(request.id)).rejects.toThrow();
    await parent.approveSpendRequest(request.id, parent.currentUser!.id);
    let calls = 0;
    await processFamilyLinkQueue(queue, async () => { calls++; return 0; }, true);
    expect(calls).toBe(1);
    await fetch(`${url}/test/reconcile`, { method: "POST" });
    expect((await parent.pb.collection("spend_requests").getOne(request.id)).grant_status).toBe("granted");
    await fetch(`${url}/test/reconcile`, { method: "POST" });
    await processFamilyLinkQueue(queue, async () => { calls++; return 0; }, true);
    expect(calls).toBe(1);
  });

  it("parents give direct bonus minutes once without charging grit; kids cannot forge them", async () => {
    await admin.collection("users").update(kid.currentUser!.id, {
      fl_child_id: "123456789012", fl_device_id: "a".repeat(30),
    });
    const balance = await parent.getBalance(kid.currentUser!.id);
    const key = `bonus-${Date.now()}`;
    const grant = await parent.giveBonusMinutes(kid.currentUser!.id, 15, "Extra effort", key);
    expect(grant).toMatchObject({
      minutes: 15, description: "Extra effort", given_by: parent.currentUser!.id,
      grant_status: "queued", assignment: "",
    });
    const retry = await parent.giveBonusMinutes(kid.currentUser!.id, 15, "Extra effort", key);
    expect(retry.id).toBe(grant.id);
    expect(await parent.getBalance(kid.currentUser!.id)).toBe(balance);
    await expect(kid.pb.collection("time_grants").create({
      child: kid.currentUser!.id, minutes: 15, request_key: `${key}-forged`,
    })).rejects.toThrow();
    await expect(parent.giveBonusMinutes(kid.currentUser!.id, 7, "", `${key}-bad`)).rejects.toThrow();
    await expect(parent.pb.collection("time_grants").update(grant.id, { minutes: 120 })).rejects.toThrow();
    const job = JSON.parse(readFileSync(join(queue, "pending", `${grant.id}.json`), "utf8"));
    expect(job.seconds).toBe(900);
    await processFamilyLinkQueue(queue, async () => 0, true);
    await fetch(`${url}/test/reconcile`, { method: "POST" });
    expect((await parent.pb.collection("time_grants").getOne(grant.id)).grant_status).toBe("granted");
  });

  it("queues a chore's bonus minutes, publishes once, and the worker result lands on the grant", async () => {
    await parent.pb.collection("users").update(kid.currentUser!.id, {
      fl_child_id: "123456789012", fl_device_id: "a".repeat(30),
    });
    const chore = await parent.createChore({
      household: parent.currentUser!.household, name: "Queue bonus chore", reward: 0, type: "oneoff",
      created_by: parent.currentUser!.id, active: true, pay_mode: "time", reward_minutes: 10,
    });
    const assignment = await parent.assignChore(chore.id, kid.currentUser!.id);
    await kid.markComplete(assignment.id);
    await parent.approveAssignment(assignment.id);

    const grant = (await parent.listBonusGrants(parent.currentUser!.household)).find((g) => g.assignment === assignment.id)!;
    expect(grant.grant_status).toBe("queued");
    const filename = `${grant.id}.json`;
    expect(JSON.parse(readFileSync(join(queue, "pending", filename), "utf8"))).toEqual({
      id: grant.id, childId: "123456789012", deviceId: "a".repeat(30), seconds: 600,
    });
    // Clients can't forge results or edit terms; nobody can delete a queued grant.
    await expect(kid.pb.collection("time_grants").update(grant.id, { grant_status: "granted" })).rejects.toThrow();
    await expect(parent.pb.collection("time_grants").update(grant.id, { grant_status: "granted" })).rejects.toThrow();
    await expect(parent.pb.collection("time_grants").update(grant.id, { minutes: 60 })).rejects.toThrow();
    await expect(parent.pb.collection("time_grants").delete(grant.id)).rejects.toThrow();

    let calls = 0;
    await processFamilyLinkQueue(queue, async () => { calls++; return 0; }, true);
    await fetch(`${url}/test/reconcile`, { method: "POST" });
    expect((await parent.pb.collection("time_grants").getOne(grant.id)).grant_status).toBe("granted");
    await fetch(`${url}/test/reconcile`, { method: "POST" });
    await processFamilyLinkQueue(queue, async () => { calls++; return 0; }, true);
    expect(calls).toBe(1);
  });

  it("repairs an unpublished committed approval and surfaces session expiry", async () => {
    const request = await approve();
    rmSync(join(queue, "pending", `${request.id}.json`));
    await fetch(`${url}/test/reconcile`, { method: "POST" });
    expect(readdirSync(join(queue, "pending"))).toContain(`${request.id}.json`);
    await processFamilyLinkQueue(queue, async () => 2, true);
    await fetch(`${url}/test/reconcile`, { method: "POST" });
    const result = await parent.pb.collection("spend_requests").getOne<SpendRequest>(request.id);
    expect(result.grant_status).toBe("manual");
    expect(result.grant_error).toContain("session expired");
    // An old approved row with no grant state must never be backfilled.
    const old = await (await fetch(`${url}/test/historical`, { method: "POST" })).json() as { id: string };
    expect((await admin.collection("spend_requests").getOne(old.id)).status).toBe("approved");
    await fetch(`${url}/test/reconcile`, { method: "POST" });
    expect(readdirSync(join(queue, "pending"))).not.toContain(`${old.id}.json`);
  });

  it("falls back to a manual bonus grant when Family Link IDs are absent", async () => {
    await parent.pb.collection("users").update(kid.currentUser!.id, { fl_child_id: "", fl_device_id: "" });
    const chore = await parent.createChore({
      household: parent.currentUser!.household, name: "Manual bonus chore", reward: 5, type: "oneoff",
      created_by: parent.currentUser!.id, active: true, pay_mode: "both", reward_minutes: 5,
    });
    const assignment = await parent.assignChore(chore.id, kid.currentUser!.id);
    await kid.markComplete(assignment.id);
    await parent.approveAssignment(assignment.id);
    const grant = (await parent.listBonusGrants(parent.currentUser!.household)).find((g) => g.assignment === assignment.id)!;
    expect(grant.grant_status).toBe("manual");
    expect(grant.grant_error).toContain("target is missing");
    const done = await parent.confirmBonusGrant(grant.id);
    expect(done.grant_status).toBe("manual_done");
    expect(done.grant_error).toBe("");
  });

  it("rapidly approving several time-pay chores queues each grant without dropping any", async () => {
    await parent.pb.collection("users").update(kid.currentUser!.id, {
      fl_child_id: "123456789012", fl_device_id: "a".repeat(30),
    });
    const grantIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const chore = await parent.createChore({
        household: parent.currentUser!.household, name: `Rapid queue chore ${i}`, reward: 0, type: "oneoff",
        created_by: parent.currentUser!.id, active: true, pay_mode: "time", reward_minutes: 5,
      });
      const assignment = await parent.assignChore(chore.id, kid.currentUser!.id);
      await kid.markComplete(assignment.id);
      await parent.approveAssignment(assignment.id);
      const grant = (await parent.listBonusGrants(parent.currentUser!.household)).find((g) => g.assignment === assignment.id)!;
      expect(grant.grant_status).toBe("queued");
      grantIds.push(grant.id);
    }
    expect(grantIds).toHaveLength(3);
    for (const g of grantIds) {
      expect(readdirSync(join(queue, "pending"))).toContain(`${g}.json`);
    }
    let calls = 0;
    await processFamilyLinkQueue(queue, async () => { calls++; return 0; }, true);
    await fetch(`${url}/test/reconcile`, { method: "POST" });
    for (const g of grantIds) {
      expect((await parent.pb.collection("time_grants").getOne(g)).grant_status).toBe("granted");
    }
    await fetch(`${url}/test/reconcile`, { method: "POST" });
    await processFamilyLinkQueue(queue, async () => { calls++; return 0; }, true);
    expect(calls).toBe(3);
  });
});
