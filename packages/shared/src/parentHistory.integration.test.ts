import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { PaydirtClient } from "./client";
import type { Assignment, TimeGrant } from "./types";
import type { ScreenGrantHistoryRow } from "./history";

describe("parent history and approval feedback (isolated PocketBase)", () => {
  const repo = resolve(import.meta.dirname, "../../..");
  const root = mkdtempSync(join(tmpdir(), "paydirt-history-test-"));
  let server: ChildProcess | undefined;
  let parent: PaydirtClient;
  let kid: PaydirtClient;
  let sibling: PaydirtClient;

  beforeAll(async () => {
    const reservation = createServer();
    await new Promise<void>((done) => reservation.listen(0, "127.0.0.1", done));
    const port = (reservation.address() as { port: number }).port;
    await new Promise<void>((done) => reservation.close(() => done()));
    const url = `http://127.0.0.1:${port}`;
    cpSync(join(repo, "pocketbase/pb_hooks"), join(root, "hooks"), { recursive: true });
    writeFileSync(join(root, "hooks", "test-windows.pb.js"), `
      routerAdd("GET", "/test/window-state", (e) => {
        const query = e.requestInfo().query;
        const child = e.app.findRecordById("users", query.child);
        const household = e.app.findRecordById("households", child.getString("household"));
        return e.json(200, require(__hooks + "/lib/grantWindows.js").windowState(household, new Date(query.at), child));
      }, $apis.requireAuth("users"));
    `);
    const binary = join(repo, "pocketbase/pocketbase");
    const args = ["--dir", join(root, "data"), "--migrationsDir", join(repo, "pocketbase/pb_migrations")];
    execFileSync(binary, ["migrate", "up", ...args], { stdio: "ignore" });
    execFileSync(binary, ["superuser", "upsert", "admin@paydirt.local", "password123", ...args], { stdio: "ignore" });
    server = spawn(binary, ["serve", ...args, "--hooksDir", join(root, "hooks"), "--http", `127.0.0.1:${port}`], {
      stdio: "ignore", env: { ...process.env, NTFY_DISABLED: "1", FL_AUTOMATION_ENABLED: "0" },
    });
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try { ready = (await fetch(`${url}/api/health`)).ok; } catch { /* Startup. */ }
      if (ready) break;
      await new Promise((done) => setTimeout(done, 100));
    }
    if (!ready) throw new Error("Isolated PocketBase did not start");
    execFileSync(process.execPath, [join(repo, "pocketbase/seed.mjs")], { stdio: "ignore", env: { ...process.env, PB_URL: url } });
    parent = new PaydirtClient(url);
    kid = new PaydirtClient(url);
    sibling = new PaydirtClient(url);
    await parent.login("parent1@test.local", "password123");
    await kid.login("child1@test.local", "password123");
    await sibling.login("child2@test.local", "password123");
  }, 30_000);
  afterAll(async () => {
    if (server && server.exitCode === null) {
      const exited = new Promise<void>((done) => server!.once("exit", () => done()));
      server.kill();
      await exited;
    }
    rmSync(root, { recursive: true, force: true });
  });

  async function chore(name: string, reward = 20) {
    return parent.createChore({
      household: parent.currentUser!.household, name, reward, pay_mode: "bucks",
      type: "oneoff", created_by: parent.currentUser!.id, active: true,
    });
  }

  it.each(["users", "households"])("saves the exact two weekday windows plus a Wednesday exception on %s", async (scope) => {
    const hh = parent.currentUser!.household;
    const child = kid.currentUser!.id;
    const fields = ["grant_weekday_window", "grant_weekend_window", "grant_day_windows"] as const;
    const oldHousehold = await parent.getHousehold(hh);
    const oldKid = await parent.pb.collection("users").getOne(child);
    const values = (record: Record<string, unknown>) => Object.fromEntries(fields.map((key) => [key, record[key] || ""]));
    try {
      await parent.pb.collection("households").update(hh, {
        grant_weekday_window: "12:00-20:00", grant_weekend_window: "10:00-20:00", grant_day_windows: "",
      });
      await parent.pb.collection("users").update(child, {
        grant_weekday_window: "", grant_weekend_window: "", grant_day_windows: "",
      });
      const weekday = "05:30-09:00,16:30-20:30";
      const days = JSON.stringify({ "3": "05:30-09:00,15:30-20:30" });
      const saved = await parent.pb.collection(scope).update(scope === "users" ? child : hh, {
        grant_weekday_window: weekday, grant_day_windows: days,
      });
      expect(saved.grant_weekday_window).toBe(weekday);
      expect(saved.grant_day_windows).toBe(days);
      const open = async (at: string) => (await parent.pb.send<{ open: boolean }>("/test/window-state", {
        query: { child, at },
      })).open;
      expect(await open("2026-11-03T14:00:00Z")).toBe(true); // Tuesday 6 AM PST
      expect(await open("2026-11-03T17:00:00Z")).toBe(false); // Tuesday 9 AM
      expect(await open("2026-11-04T00:00:00Z")).toBe(false); // Tuesday 4 PM
      expect(await open("2026-11-04T00:30:00Z")).toBe(true); // Tuesday 4:30 PM
      expect(await open("2026-11-05T00:00:00Z")).toBe(true); // Wednesday 4 PM exception
      expect(await open("2026-11-06T00:00:00Z")).toBe(false); // Thursday still uses weekday default
      expect(await open("2026-11-07T14:00:00Z")).toBe(false); // Saturday inherits weekend hours
    } finally {
      await parent.pb.collection("users").update(child, values(oldKid));
      await parent.pb.collection("households").update(hh, values(oldHousehold as unknown as Record<string, unknown>));
    }
  });

  it("stores optional feedback once, pays the normal reward, and delivers it privately", async () => {
    const c = await chore("Feedback approval");
    const assignment = await parent.assignChore(c.id, kid.currentUser!.id);
    await expect(kid.pb.collection("assignments").update(assignment.id, { approval_comment: "Forged praise" })).rejects.toThrow();
    await kid.markComplete(assignment.id);
    const before = await parent.getBalance(kid.currentUser!.id);
    const approvals = await Promise.allSettled([
      parent.approveAssignment(assignment.id, 100, "  Thanks for sticking with it!  "),
      parent.approveAssignment(assignment.id, 100, "  Thanks for sticking with it!  "),
    ]);
    expect(approvals.some((result) => result.status === "fulfilled")).toBe(true);
    expect((await parent.pb.collection("assignments").getOne(assignment.id)).approval_comment)
      .toBe("Thanks for sticking with it!");
    expect(await parent.getBalance(kid.currentUser!.id)).toBe(before + 20);
    expect((await kid.listInbox(kid.currentUser!.id)).some((item) =>
      item.title === "Chore approved! ✅" && item.body?.includes("Thanks for sticking with it!"))).toBe(true);
    expect((await kid.listApprovedHistory(kid.currentUser!.id)).find((item) => item.id === assignment.id)?.approval_comment)
      .toBe("Thanks for sticking with it!");
    const siblingHistory = await sibling.listApprovedHistory(kid.currentUser!.id);
    const siblingRow = siblingHistory.find((item) => item.id === assignment.id);
    expect(siblingRow).toBeDefined();
    expect(siblingRow?.approval_comment).toBeUndefined();
    await parent.approveAssignment(assignment.id, 100, "Thanks for sticking with it!");
    expect(await parent.getBalance(kid.currentUser!.id)).toBe(before + 20);
    await expect(parent.pb.collection("assignments").update(assignment.id, { approval_comment: "Changed later" })).rejects.toThrow();
    await parent.undoApproval(assignment.id);
    expect((await parent.pb.collection("assignments").getOne(assignment.id)).approval_comment).toBe("");
    await parent.approveAssignment(assignment.id);
    expect((await parent.pb.collection("assignments").getOne(assignment.id)).approval_comment).toBe("");
  });

  it("leaves approval and payout unchanged when feedback fails validation", async () => {
    const c = await chore("Feedback limit");
    const assignment = await parent.assignChore(c.id, kid.currentUser!.id);
    await kid.markComplete(assignment.id);
    const before = await parent.getBalance(kid.currentUser!.id);
    await expect(parent.approveAssignment(assignment.id, 100, "x".repeat(501))).rejects.toThrow();
    expect((await parent.pb.collection("assignments").getOne(assignment.id)).status).toBe("completed");
    expect(await parent.getBalance(kid.currentUser!.id)).toBe(before);
    await parent.approveAssignment(assignment.id, 50, "Good progress.");
    expect(await parent.getBalance(kid.currentUser!.id)).toBe(before + 10);
  });

  it("loads five approvals, then ten at a time through the end, including equal timestamps", async () => {
    const c = await chore("History paging", 2);
    for (let i = 0; i < 26; i++) {
      const assignment = await parent.assignChore(c.id, kid.currentUser!.id);
      await kid.markComplete(assignment.id);
      await parent.approveAssignment(assignment.id);
    }
    // Clock boundary fixture: only this ephemeral DB is touched.
    const db = new DatabaseSync(join(root, "data/data.db"));
    try { db.prepare("UPDATE assignments SET approved_at = ? WHERE chore = ?").run("2099-11-06 10:00:00.000Z", c.id); }
    finally { db.close(); }
    const expected = await parent.pb.collection("assignments").getFullList<Assignment>({
      filter: parent.pb.filter("status = 'approved' && chore.household = {:hh}", { hh: parent.currentUser!.household }),
      sort: "-approved_at,-id",
    });
    const first = await parent.listApprovedHistoryPage(parent.currentUser!.household);
    expect(first.items).toHaveLength(5);
    expect(first.hasMore).toBe(true);
    const seen = [...first.items];
    let more = first.hasMore;
    while (more) {
      const page = await parent.listApprovedHistoryPage(parent.currentUser!.household, seen.at(-1), 10);
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.length).toBeLessThanOrEqual(10);
      seen.push(...page.items);
      more = page.hasMore;
    }
    expect(seen.map((row) => row.id)).toEqual(expected.map((row) => row.id));
    expect(new Set(seen.map((row) => row.id)).size).toBe(seen.length);
  }, 15_000);

  it("pages one mixed grant history, keeps ID/timestamp ties, and never limits outstanding work", async () => {
    const child = kid.currentUser!.id;
    const hh = parent.currentUser!.household;
    await parent.adjustBalance(child, 10_000, "History fixture funds");
    const rows: { table: string; id: string; bonus: boolean }[] = [];
    for (let i = 0; i < 26; i++) {
      const bonus = i % 2 === 1;
      const id = i < 4 ? "z".repeat(14) + i : i < 6 ? "y".repeat(15) : "a".repeat(13) + String(i).padStart(2, "0");
      if (bonus) {
        const grant = await parent.pb.collection("time_grants").create<TimeGrant>({
          id, child, minutes: 15, description: `Paged grant ${i}`, request_key: `history_bonus_${i}`,
        });
        await parent.confirmBonusGrant(grant.id);
      } else {
        const request = await kid.pb.collection("spend_requests").create({
          id, child, amount: 15, screen_minutes: 15, description: `Paged grant ${i}`, status: "pending",
        });
        await parent.approveSpendRequest(request.id, parent.currentUser!.id);
        await parent.confirmManualGrant(request.id);
      }
      rows.push({ table: bonus ? "time_grants" : "spend_requests", id, bonus });
    }
    const db = new DatabaseSync(join(root, "data/data.db"));
    try {
      for (const row of rows) db.prepare(`UPDATE ${row.table} SET updated = ? WHERE id = ?`)
        .run("2099-11-06 10:00:00.000Z", row.id);
    } finally { db.close(); }
    const first = await parent.listScreenGrantHistoryPage(hh);
    expect(first.items).toHaveLength(5);
    expect(first.items.at(-1)).toMatchObject({ id: "y".repeat(15), bonus: false });
    const next = await parent.listScreenGrantHistoryPage(hh, first.items.at(-1), 10);
    expect(next.items).toHaveLength(10);
    expect(next.items[0]).toMatchObject({ id: "y".repeat(15), bonus: true });
    const seen: ScreenGrantHistoryRow[] = [...first.items, ...next.items];
    let more = next.hasMore;
    while (more) {
      const page = await parent.listScreenGrantHistoryPage(hh, seen.at(-1), 10);
      expect(page.items.length).toBeGreaterThan(0);
      seen.push(...page.items);
      more = page.hasMore;
    }
    expect(seen).toHaveLength(26);
    expect(new Set(seen.map((row) => `${row.bonus}:${row.id}`)).size).toBe(26);
    const outstanding: string[] = [];
    for (let i = 0; i < 7; i++) {
      outstanding.push((await parent.giveBonusMinutes(child, 5, "Unsettled", `outstanding_${i}`)).id);
    }
    expect((await parent.listBonusGrants(hh, 0)).map((row) => row.id).sort()).toEqual(outstanding.sort());
    expect((await parent.listScreenGrantHistoryPage(hh)).items.every((row) => !outstanding.includes(row.id))).toBe(true);
  }, 15_000);

  it("preserves existing schedules through migration and refuses an incompatible rollback", async () => {
    const child = kid.currentUser!.id;
    const windows = "05:30-09:00,16:30-20:30";
    await parent.pb.collection("users").update(child, { grant_weekday_window: windows });
    const exited = new Promise<void>((done) => server!.once("exit", () => done()));
    server!.kill();
    await exited;
    const binary = join(repo, "pocketbase/pocketbase");
    const args = ["--dir", join(root, "data"), "--migrationsDir", join(repo, "pocketbase/pb_migrations")];
    const down = () => execFileSync(binary, ["migrate", "down", "1", ...args], { input: "y\n", stdio: ["pipe", "ignore", "ignore"] });
    expect(down).toThrow();
    const db = new DatabaseSync(join(root, "data/data.db"));
    try {
      expect(db.prepare("SELECT grant_weekday_window FROM users WHERE id = ?").get(child))
        .toMatchObject({ grant_weekday_window: windows });
      // Fixture-only edit: restore a compatible value before exercising rollback.
      db.prepare("UPDATE users SET grant_weekday_window = ? WHERE id = ?").run("05:30-09:00", child);
    } finally { db.close(); }
    down();
    execFileSync(binary, ["migrate", "up", ...args], { stdio: "ignore" });
    const migrated = new DatabaseSync(join(root, "data/data.db"));
    try {
      expect(migrated.prepare("SELECT grant_weekday_window FROM users WHERE id = ?").get(child))
        .toMatchObject({ grant_weekday_window: "05:30-09:00" });
      const row = migrated.prepare("SELECT fields FROM _collections WHERE name = 'users'").get()!;
      const fields = JSON.parse(row.fields as string) as { name: string; max?: number }[];
      expect(fields.find((field) => field.name === "grant_weekday_window")?.max).toBe(10000);
    } finally { migrated.close(); }
  });
});
