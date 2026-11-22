import { afterAll, beforeAll, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import PocketBase from "pocketbase";
import { PaydirtClient } from "./client";
const repo = resolve(import.meta.dirname, "../../..");
const root = mkdtempSync(join(tmpdir(), "paydirt-ledger-audit-"));
const queue = join(root, "push");
let server: ChildProcess;
let parent: PaydirtClient;
let kid: PaydirtClient;
let admin: PocketBase;
beforeAll(async () => {
  const reservation = createServer();
  await new Promise<void>((done) => reservation.listen(0, "127.0.0.1", done));
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((done) => reservation.close(() => done()));
  const url = `http://127.0.0.1:${port}`;
  const binary = join(repo, "pocketbase/pocketbase");
  const args = ["--dir", join(root, "data"), "--migrationsDir", join(repo, "pocketbase/pb_migrations")];
  execFileSync(binary, ["migrate", "up", ...args], { stdio: "ignore" });
  execFileSync(binary, ["superuser", "upsert", "admin@paydirt.local", "password123", ...args], { stdio: "ignore" });
  server = spawn(binary, ["serve", ...args, "--hooksWatch=false", "--hooksDir", join(repo, "pocketbase/pb_hooks"), "--http", `127.0.0.1:${port}`], {
    stdio: "ignore", env: { ...process.env, NTFY_DISABLED: "1", NTFY_QUEUE_DIR: queue },
  });
  let healthy = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { healthy = (await fetch(`${url}/api/health`)).ok; } catch { /* Startup. */ }
    if (healthy) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  if (!healthy) throw new Error("Isolated PocketBase did not start");
  execFileSync(process.execPath, [join(repo, "pocketbase/seed.mjs")], { stdio: "ignore", env: { ...process.env, PB_URL: url } });
  parent = new PaydirtClient(url);
  kid = new PaydirtClient(url);
  await parent.login("parent1@test.local", "password123");
  await kid.login("child1@test.local", "password123");
  admin = new PocketBase(url);
  await admin.collection("_superusers").authWithPassword("admin@paydirt.local", "password123");
  await admin.collection("households").update(parent.currentUser!.household, { quiet_start: "", quiet_end: "" });
  for (const user of await admin.collection("users").getFullList()) {
    await admin.collection("users").update(user.id, { ntfy_topic: "", up_endpoint: "" });
  }

}, 20_000);

afterAll(async () => {
  if (server?.exitCode === null) {
    const exited = new Promise<void>((done) => server.once("exit", () => done()));
    server.kill();
    await exited;
  }
  rmSync(root, { recursive: true, force: true });
});

it("rejects non-superuser manual checks", async () => {
  await expect(kid.pb.send("/api/paydirt/cron/ledger", { method: "POST" })).rejects.toMatchObject({ status: 403 });
  await expect(parent.pb.send("/api/paydirt/cron/ledger", { method: "POST" })).rejects.toMatchObject({ status: 403 });
});

it("is quiet when clean, alerts only household parents on drift and never repairs accounting", async () => {
  const check = () => admin.send("/api/paydirt/cron/ledger", { method: "POST" });
  const alerts = () => admin.collection("inbox").getFullList({ filter: "type = 'ledger_drift'" });
  expect(await alerts()).toHaveLength(0);
  await check();
  expect(await alerts()).toHaveLength(0);
  const child = await admin.collection("users").getOne(kid.currentUser!.id);
  const ledger = await admin.collection("currency_transactions").getFullList();
  // Simulate a historical failed cache update through the parent-only field.
  await parent.pb.collection("users").update(child.id, { balance: child.balance + 0.25 });
  try {
    await check();
    const notifications = await alerts();
    const parents = await admin.collection("users").getFullList({ filter: admin.filter("household = {:h} && role = 'parent'", { h: child.household }) });
    expect(notifications.map((n) => n.user).sort()).toEqual(parents.map((p) => p.id).sort());
    for (const n of notifications) {
      expect(n.body).toContain(child.display_name);
      expect(n.body).toContain("difference 0.25 Grit");
      expect(n.body).toContain("No balances were changed");
    }
    expect((await admin.collection("users").getOne(child.id)).balance).toBe(child.balance + 0.25);
    expect(await admin.collection("currency_transactions").getFullList()).toEqual(ledger);
    expect(await kid.pb.collection("inbox").getFullList({ filter: "type = 'ledger_drift'" })).toHaveLength(0);
  } finally {
    await parent.pb.collection("users").update(child.id, { balance: child.balance });
  }
  const count = (await alerts()).length;
  await check();
  expect(await alerts()).toHaveLength(count);
});
