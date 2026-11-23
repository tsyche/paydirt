import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import PocketBase from "pocketbase";
import { PaydirtClient } from "./client";
const repo = resolve(import.meta.dirname, "../../..");
const root = mkdtempSync(join(tmpdir(), "paydirt-weekly-recap-"));
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
    stdio: "ignore", env: { ...process.env, NTFY_DISABLED: "1", NTFY_QUEUE_DIR: queue, FL_AUTOMATION_ENABLED: "1", FL_QUEUE_DIR: join(root, "familylink") },
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

async function freshKid(name: string, rate = 0) {
  await admin.collection("users").create({ email: `${name}@test.local`, password: "password123", passwordConfirm: "password123",
    role: "child", household: parent.currentUser!.household, display_name: name, goods_rate: rate });
  const child = new PaydirtClient(admin.baseURL);
  await child.login(`${name}@test.local`, "password123");
  return child;
}
async function recap(child: PaydirtClient) {
  const query = { filter: admin.filter("user = {:id} && title = {:title}", { id: child.currentUser!.id, title: "Your week 🌟" }) };
  const before = new Set((await admin.collection("inbox").getFullList(query)).map((row) => row.id));
  await admin.send("/api/paydirt/cron/kid-recap", { method: "POST" });
  const added = (await admin.collection("inbox").getFullList(query)).filter((row) => !before.has(row.id));
  expect(added).toHaveLength(1);
  return added[0]!.body as string;
}
it("reports earned minutes once and dollar equivalents using the current effective rate", async () => {
  await parent.pb.collection("households").update(parent.currentUser!.household, { goods_rate: 88, grant_weekday_window: "none", grant_weekend_window: "none" });
  const child = await freshKid("weekly-earner", 44);
  async function earn(reward: number, minutes: number) {
    const chore = await parent.createChore({ household: parent.currentUser!.household, name: "Recap chore", reward,
      type: "oneoff", created_by: parent.currentUser!.id, active: true, pay_mode: reward ? "both" : "time", reward_minutes: minutes });
    const assignment = await parent.assignChore(chore.id, child.currentUser!.id);
    await child.markComplete(assignment.id); await parent.approveAssignment(assignment.id);
    return assignment;
  }
  const old = await earn(44, 60);
  const db = new DatabaseSync(join(root, "data/data.db"));
  const past = new Date(Date.now() - 8 * 86400000).toISOString().replace("T", " ");
  try {
    db.prepare("UPDATE time_ledger SET created = ? WHERE assignment = ?").run(past, old.id);
    db.prepare("UPDATE currency_transactions SET created = ? WHERE related_assignment = ?").run(past, old.id);
    db.prepare("UPDATE assignments SET approved_at = ? WHERE id = ?").run(past, old.id);
  } finally { db.close(); }
  await earn(88, 30);
  await earn(0, 15);
  await parent.adjustBalance(child.currentUser!.id, -44, "Spend earned grit");
  const used = await child.redeemSavedTime(15, "weekly_recap_used_time", true);
  const grant = (await child.getTimeBank(child.currentUser!.id)).grants.find((g) => g.redemption === used.id)!;
  await parent.confirmBonusGrant(grant.id);
  await parent.pb.collection("users").update(child.currentUser!.id, { fl_child_id: "123456789012", fl_device_id: "a".repeat(30) });
  const cancelled = await child.redeemSavedTime(15, "weekly_recap_cancel_time", true);
  await child.cancelSavedTime(cancelled.id);
  await admin.collection("savings_goals").create({ child: child.currentUser!.id, name: "Soccer ball", target: 440, achieved: false });
  const snapshot = await child.getTimeBank(child.currentUser!.id);
  const body = await recap(child);
  expect(body).toContain("88 Grit (about $2.00 at your current rate)");
  expect(body).toContain("45 screen-time minutes");
  expect(body).toContain("completed 2 chores!");
  expect(body).toContain("Goal 'Soccer ball': 20% (88/440)");
  expect((await child.getTimeBank(child.currentUser!.id)).ledger).toEqual(snapshot.ledger);
  await parent.pb.collection("users").update(child.currentUser!.id, { goods_rate: 0 });
  expect(await recap(child)).toContain("88 Grit (about $1.00 at your current rate)");
  await parent.pb.collection("households").update(parent.currentUser!.household, { goods_rate: 0 });
  const unavailable = await recap(child);
  expect(unavailable).toContain("dollar value unavailable");
  expect(unavailable).not.toContain("$0.00");
});
it("includes zero activity, keeps recaps private and skips vacation mode", async () => {
  await parent.pb.collection("households").update(parent.currentUser!.household, { goods_rate: 88 });
  const child = await freshKid("weekly-zero");
  const body = await recap(child);
  expect(body).toContain("0 Grit (about $0.00 at your current rate)");
  expect(body).toContain("0 screen-time minutes");
  expect(body).toContain("completed 0 chores!");
  const inbox = await child.pb.collection("inbox").getFullList();
  expect(inbox.every((row) => row.user === child.currentUser!.id)).toBe(true);
  const before = (await admin.collection("inbox").getFullList()).length;
  await parent.pb.collection("households").update(parent.currentUser!.household, { paused: true });
  await admin.send("/api/paydirt/cron/kid-recap", { method: "POST" });
  expect((await admin.collection("inbox").getFullList()).length).toBe(before);
});
