import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import PocketBase from "pocketbase";
import { PaydirtClient } from "./client";
import { processFamilyLinkQueue } from "./familylinkQueue";

describe("Parent settings and grant status (isolated PocketBase)", () => {
  const repo = resolve(import.meta.dirname, "../../..");
  const root = mkdtempSync(join(tmpdir(), "paydirt-parent-reliability-"));
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
    writeFileSync(join(hooks, "publicationProbe.pb.js"), `
      routerAdd("POST", "/test/reconcile", (e) => {
        require(__hooks + "/lib/familylink.js").reconcile(e.app);
        return e.json(200, {});
      }, $apis.requireSuperuserAuth());
      onRecordAfterUpdateSuccess((e) => {
        if (e.record.getString("description") === "Publication order probe" && e.record.getInt("grant_delivered_seconds") === 900) {
          const dir = $os.getenv("FL_QUEUE_DIR");
          let published = false;
          try { $os.stat(dir + "/pending/" + e.record.id + "-900.json"); published = true; } catch (_) {}
          $os.writeFile(dir + "/publication-probe.json", JSON.stringify({ published }), 0o600);
        }
        e.next();
      }, "time_grants");
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
    await parent.pb.collection("users").update(kid.currentUser!.id, { fl_child_id: "123456789012", fl_device_id: "a".repeat(30) });
    await parent.updateHousehold(parent.currentUser!.household, { grant_weekday_window: "", grant_weekend_window: "", grant_day_windows: "" });
  }, 20_000);

  afterAll(async () => {
    if (server && server.exitCode === null) {
      const exited = new Promise<void>((done) => server!.once("exit", () => done()));
      server.kill();
      await exited;
    }
    rmSync(root, { recursive: true, force: true });
  });

  it("previews expiry against live earnings and debits without changing the ledger", async () => {
    const household = parent.currentUser!.household;
    const target = await admin.collection("users").create({ email: "expiry-preview@test.local", password: "password123", passwordConfirm: "password123", role: "child", display_name: "Expiry preview", household, verified: true });
    const old = await admin.collection("currency_transactions").create({ user: target.id, type: "earn", amount: 100, reason: "Old earned lot" });
    const debit = await admin.collection("currency_transactions").create({ user: target.id, type: "spend", amount: -40, reason: "Spent old earnings" });
    await admin.collection("currency_transactions").create({ user: target.id, type: "earn", amount: 50, reason: "Fresh earnings" });
    await admin.collection("currency_transactions").create({ user: target.id, type: "manual_adjustment", amount: 20, reason: "Non-expiring bonus" });
    const db = new DatabaseSync(join(root, "data/data.db"));
    try {
      db.prepare("UPDATE currency_transactions SET created = ? WHERE id = ?").run("2020-01-01 00:00:00.000Z", old.id);
      db.prepare("UPDATE currency_transactions SET created = ? WHERE id = ?").run("2020-01-02 00:00:00.000Z", debit.id);
    } finally { db.close(); }
    const before = await parent.listTransactions(target.id);
    const householdBefore = await parent.getHousehold(household);
    const preview = await parent.previewExpiry(household, 30);
    expect(preview.children.find((c) => c.id === target.id)).toMatchObject({ display_name: "Expiry preview", lapse: 60 });
    expect((await parent.previewExpiry(household, 0)).children.every((c) => c.lapse === 0)).toBe(true);
    expect(await parent.listTransactions(target.id)).toEqual(before);
    expect(await parent.getBalance(target.id)).toBe(130);
    expect((await parent.getHousehold(household)).expiry_days).toBe(householdBefore.expiry_days);
    const processedDb = new DatabaseSync(join(root, "data/data.db"));
    try { processedDb.prepare("UPDATE currency_transactions SET expiry_processed = true WHERE id = ?").run(old.id); }
    finally { processedDb.close(); }
    expect((await parent.previewExpiry(household, 30)).children.find((c) => c.id === target.id)?.lapse).toBe(0);
    await expect(kid.previewExpiry(household, 30)).rejects.toThrow();
    await expect(parent.previewExpiry(household, -1)).rejects.toThrow();
  });

  it("imports a completed worker receipt immediately and never replays its payout", async () => {
    const target = kid.currentUser!.id;
    await parent.pb.collection("users").update(target, { fl_child_id: "123456789012", fl_device_id: "a".repeat(30) });
    await parent.updateHousehold(parent.currentUser!.household, { grant_weekday_window: "", grant_weekend_window: "", grant_day_windows: "" });
    const grant = await parent.giveBonusMinutes(target, 30, "Fresh receipt", "fresh_receipt_status");
    let deliveries = 0;
    await processFamilyLinkQueue(queue, async () => { deliveries++; return 0; }, true);
    expect((await parent.pb.collection("time_grants").getOne(grant.id)).grant_status).toBe("queued");
    await Promise.all([parent.refreshGrantResults(), kid.refreshGrantResults(), parent.refreshGrantResults()]);
    expect(await parent.pb.collection("time_grants").getOne(grant.id)).toMatchObject({ grant_status: "granted", grant_delivered_seconds: 1800 });
    await parent.refreshGrantResults();
    await processFamilyLinkQueue(queue, async () => { deliveries++; return 0; }, true);
    expect(deliveries).toBe(1);
  });
  it("limits foreground receipt import to the authenticated household", async () => {
    const hh = await admin.collection("households").create({ name: "Other receipt household" });
    const credentials = { password: "password123", passwordConfirm: "password123", household: hh.id, verified: true };
    await admin.collection("users").create({ ...credentials, email: "other-parent@test.local", role: "parent", display_name: "Other parent" });
    const otherKid = await admin.collection("users").create({ ...credentials, email: "other-kid@test.local", role: "child", display_name: "Other kid", fl_child_id: "123456789012", fl_device_id: "b".repeat(30) });
    const otherParent = new PaydirtClient(url);
    await otherParent.login("other-parent@test.local", "password123");
    const grant = await otherParent.giveBonusMinutes(otherKid.id, 15, "Private receipt", "private_receipt_key");
    await processFamilyLinkQueue(queue, async () => 0, true);
    await parent.refreshGrantResults();
    await kid.refreshGrantResults();
    expect((await admin.collection("time_grants").getOne(grant.id)).grant_status).toBe("queued");
    await otherParent.refreshGrantResults();
    expect((await admin.collection("time_grants").getOne(grant.id)).grant_status).toBe("granted");
    expect((await fetch(`${url}/api/paydirt/grants/refresh`, { method: "POST" })).status).toBe(401);
  });

  it("imports partial and uncertain receipts without advancing them twice", async () => {
    const target = kid.currentUser!.id;
    const partial = await parent.giveBonusMinutes(target, 30, "Partial receipt", "partial_fresh_receipt");
    await processFamilyLinkQueue(queue, async () => ({ code: 0, deliveredSeconds: 900 }), true);
    await Promise.all([parent.refreshGrantResults(), kid.refreshGrantResults()]);
    await parent.refreshGrantResults();
    expect(await parent.pb.collection("time_grants").getOne(partial.id)).toMatchObject({ grant_status: "queued", grant_delivered_seconds: 900 });
    const uncertain = await parent.giveBonusMinutes(target, 15, "Uncertain receipt", "uncertain_fresh_receipt");
    await processFamilyLinkQueue(queue, async () => 1, true);
    await parent.refreshGrantResults();
    await parent.refreshGrantResults();
    expect(await parent.pb.collection("time_grants").getOne(uncertain.id)).toMatchObject({ grant_status: "manual", grant_delivered_seconds: 0 });
  });

  it("keeps sibling receipts private until a parent imports them", async () => {
    const sibling = (await parent.listChildren(parent.currentUser!.household)).find((child) => child.id !== kid.currentUser!.id)!;
    await parent.pb.collection("users").update(sibling.id, { fl_child_id: "123456789012", fl_device_id: "c".repeat(30) });
    const grant = await parent.giveBonusMinutes(sibling.id, 15, "Sibling receipt", "sibling_private_receipt");
    await processFamilyLinkQueue(queue, async () => 0, true);
    await kid.refreshGrantResults();
    expect((await parent.pb.collection("time_grants").getOne(grant.id)).grant_status).toBe("queued");
    await parent.refreshGrantResults();
    expect((await parent.pb.collection("time_grants").getOne(grant.id)).grant_status).toBe("granted");
  });

  it("publishes a partial remainder only after its receipt update commits", async () => {
    const grant = await parent.giveBonusMinutes(kid.currentUser!.id, 30, "Publication order probe", "publication_order_probe");
    await processFamilyLinkQueue(queue, async () => ({ code: 0, deliveredSeconds: 900 }), true);
    await admin.send("/test/reconcile", { method: "POST" });
    expect(JSON.parse(readFileSync(join(queue, "publication-probe.json"), "utf8"))).toEqual({ published: false });
    expect(existsSync(join(queue, "pending", `${grant.id}-900.json`))).toBe(true);
  });

});
