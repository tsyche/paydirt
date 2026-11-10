import { DatabaseSync } from "node:sqlite";
import { completionFormWithPhoto } from "./integration.fixtures";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import PocketBase from "pocketbase";
import { PaydirtClient } from "./client";
import { EventSource } from "eventsource";

(globalThis as { EventSource?: unknown }).EventSource = EventSource;

// Real PocketBase, migrations, hooks and disk; no Google session or network.
describe("Chore conversations (isolated PocketBase)", () => {
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



  async function assignment() {
    const chore = await parent.createChore({ household: parent.currentUser!.household, name: "Conversation fixture", reward: 10,
      type: "oneoff", created_by: parent.currentUser!.id, active: true });
    return parent.assignChore(chore.id, kid.currentUser!.id);
  }
  it("separates questions and replies from approval, preserves decision history, and permits later replies", async () => {
    const a = await assignment();
    await kid.markComplete(a.id, undefined, "bank", "I cleaned the corners too.");
    const before = await kid.getConversationAssignment(a.id);
    const grit = await kid.getBalance(kid.currentUser!.id);
    await parent.sendChoreMessage(a.id, "Did you wipe under the tray?", "parent_question_key");
    await parent.sendChoreMessage(a.id, "Did you wipe under the tray?", "parent_question_key");
    await kid.sendChoreMessage(a.id, "Yes, underneath too.", "child_answer_key");
    const unchanged = await kid.getConversationAssignment(a.id);
    expect(unchanged.status).toBe(before.status);
    expect(unchanged.updated).toBe(before.updated);
    expect(unchanged.timer_started_at).toBe(before.timer_started_at);
    expect(await kid.getBalance(kid.currentUser!.id)).toBe(grit);
    const rows = await kid.listChoreMessages(a.id);
    expect(rows.map((r) => r.kind)).toEqual(["submitted", "message", "message"]);
    expect(rows[0]?.body).toBe("I cleaned the corners too.");
    expect(rows[1]?.author).toBe(parent.currentUser!.id);
    await parent.approveAssignment(a.id, 100, "Looks great.");
    await kid.sendChoreMessage(a.id, "Thank you!", "after_approval_reply");
    expect((await kid.getConversationAssignment(a.id)).status).toBe("approved");
    expect(await kid.getBalance(kid.currentUser!.id)).toBe(grit + 10);
    expect((await kid.listChoreMessages(a.id)).map((r) => r.kind)).toEqual(["submitted", "message", "message", "approved", "message"]);
    expect((await kid.listChoreMessages(a.id))[3]?.body).toBe("Looks great.");
  });
  it("enforces private immutable messages and server-owned author, time, and ordering", async () => {
    const a = await assignment();
    const sent = await kid.sendChoreMessage(a.id, "Private question", "private_question_key");
    const sibling = new PaydirtClient(url); await sibling.login("child2@test.local", "password123");
    expect(await sibling.listChoreMessages(a.id)).toHaveLength(0);
    await expect(sibling.pb.collection("chore_messages").getOne(sent.id)).rejects.toThrow();
    await expect(sibling.sendChoreMessage(a.id, "Forged", "sibling_forgery_key")).rejects.toThrow();
    await expect(kid.pb.collection("chore_messages").create({ assignment: a.id, child: kid.currentUser!.id, author: parent.currentUser!.id, body: "Forged" })).rejects.toThrow();
    await expect(kid.pb.collection("chore_messages").update(sent.id, { body: "Changed" })).rejects.toThrow();
    await expect(parent.pb.collection("chore_messages").delete(sent.id)).rejects.toThrow();
    await expect(parent.pb.collection("assignments").delete(a.id)).rejects.toThrow();
    await expect(parent.sendChoreMessage(a.id, " ", "empty_message_key")).rejects.toThrow();
    await expect(parent.sendChoreMessage(a.id, "x".repeat(1001), "oversized_message_key")).rejects.toThrow();
    await expect(parent.sendChoreMessage(a.id, "Valid", "short")).rejects.toThrow();
    await expect(kid.sendChoreMessage(a.id, "Different", "private_question_key")).rejects.toThrow();
    const row = (await kid.listChoreMessages(a.id))[0]!;
    expect(row.author).toBe(kid.currentUser!.id); expect(row.author_role).toBe("child"); expect(row.sequence).toBe(1);
  });
  it("keeps legacy feedback fields private in assignment responses", async () => {
    const a = await assignment(); await kid.markComplete(a.id);
    await parent.rejectAssignment(a.id, "Private parent feedback");
    await kid.respondToRejection(a.id, "Private kid reply");
    const sibling = new PaydirtClient(url); await sibling.login("child2@test.local", "password123");
    const visible = await sibling.pb.collection("assignments").getOne(a.id);
    expect(visible).not.toHaveProperty("rejection_message");
    expect(visible).not.toHaveProperty("kid_response");
    expect((await kid.getConversationAssignment(a.id)).rejection_message).toBe("Private parent feedback");
  });

  it("denies a parent outside the household access to the conversation", async () => {
    const a = await assignment(); const message = await kid.sendChoreMessage(a.id, "Private household message", "private_household_key");
    const household = await admin.collection("households").create({ name: "Other household" });
    await admin.collection("users").create({ email: "outside-parent@test.local", password: "password123", passwordConfirm: "password123", verified: true,
      role: "parent", household: household.id, display_name: "Outside parent" });
    const outside = new PaydirtClient(url); await outside.login("outside-parent@test.local", "password123");
    expect(await outside.listChoreMessages(a.id)).toHaveLength(0);
    await expect(outside.pb.collection("chore_messages").getOne(message.id)).rejects.toThrow();
    await expect(outside.sendChoreMessage(a.id, "No access", "outside_parent_key")).rejects.toThrow();
  });

  it("serializes concurrent sends and dedupes uncertain retries without gaps or double notifications", async () => {
    const a = await assignment();
    await Promise.all([
      parent.sendChoreMessage(a.id, "Question", "concurrent_parent_msg"),
      kid.sendChoreMessage(a.id, "Reply", "concurrent_child_msg"),
      kid.sendChoreMessage(a.id, "Reply", "concurrent_child_msg"),
    ]);
    expect((await parent.listChoreMessages(a.id)).map((r) => r.sequence)).toEqual([1, 2]);
    const source = "assignments:" + a.id + ":conversation";
    const inbox = (await parent.listInbox(parent.currentUser!.id, 200)).filter((r) => r.source === source);
    expect(inbox).toHaveLength(1);
    const coParent = new PaydirtClient(url); await coParent.login("parent2@test.local", "password123");
    expect((await coParent.listInbox(coParent.currentUser!.id, 200)).filter((r) => r.source === source)).toHaveLength(2);
  });
  it("preserves returned/reopened events and prevents duplicate approval decisions", async () => {
    const a = await assignment();
    await kid.markComplete(a.id);
    await parent.rejectAssignment(a.id, "Please wipe the edge.");
    await kid.sendChoreMessage(a.id, "Which edge?", "returned_chore_question");
    const form = completionFormWithPhoto();
    form.set("submission_note", "The back edge is clean.");
    await kid.pb.collection("assignments").update(a.id, form);
    await Promise.allSettled([parent.approveAssignment(a.id), parent.approveAssignment(a.id)]);
    const approved = (await parent.listChoreMessages(a.id)).filter((r) => r.kind === "approved");
    expect(approved).toHaveLength(1);
    await parent.undoApproval(a.id);
    expect((await kid.listChoreMessages(a.id)).map((r) => r.kind)).toEqual(["submitted", "rejected", "message", "submitted", "approved", "reopened"]);
  });
  it("keeps personal archives independent of participants and retains complete thread recovery", async () => {
    const a = await assignment(); await kid.markComplete(a.id); await parent.approveAssignment(a.id);
    await kid.sendChoreMessage(a.id, "Keep this in history", "archived_thread_reply");
    const archive = await parent.archiveItem("assignment", a.id);
    expect((await kid.listChoreMessages(a.id)).some((r) => r.body === "Keep this in history")).toBe(true);
    await parent.sendChoreMessage(a.id, "Still here", "parent_archived_reply");
    expect((await parent.listArchivesPage()).items.some((r) => r.assignment === a.id)).toBe(true);
    await parent.restoreArchivedItem(archive.id);
    expect(await parent.listChoreMessages(a.id)).toHaveLength(4);
  });
  it("does not expose a previous kid's messages after reassignment", async () => {
    const a = await assignment(); await kid.sendChoreMessage(a.id, "Original kid's private note", "before_reassignment_msg");
    await kid.markComplete(a.id, undefined, "bank", "Original submission note");
    await parent.rejectAssignment(a.id, "Parent feedback for the original kid");
    await kid.respondToRejection(a.id, "Original kid's earlier reply");
    const sibling = new PaydirtClient(url); await sibling.login("child2@test.local", "password123");
    await parent.pb.collection("assignments").update(a.id, { child: sibling.currentUser!.id });
    expect(await sibling.listChoreMessages(a.id)).toHaveLength(0);
    const reassigned = await sibling.getConversationAssignment(a.id);
    expect(reassigned.rejection_message || "").toBe("");
    expect(reassigned.kid_response || "").toBe("");
    expect(reassigned.submission_note || "").toBe("");
    await sibling.sendChoreMessage(a.id, "New kid's message", "after_reassignment_msg");
    expect((await kid.listChoreMessages(a.id)).map((r) => r.body)).toEqual(["Original kid's private note", "Original submission note", "Parent feedback for the original kid", "Original kid's earlier reply"]);
    expect((await parent.listChoreMessages(a.id)).length).toBe(5);
    await expect(kid.sendChoreMessage(a.id, "Cannot send now", "old_owner_new_message")).rejects.toThrow();
  });
  it("migrates legacy feedback without rewriting it, then refuses to roll populated threads back", async () => {
    const a = await assignment(); await kid.markComplete(a.id);
    await parent.rejectAssignment(a.id, "Earlier parent request");
    await kid.respondToRejection(a.id, "Earlier kid reply");
    await kid.pb.collection("assignments").update(a.id, completionFormWithPhoto());
    await parent.approveAssignment(a.id, 100, "Earlier approval praise");
    const exit = new Promise<void>((done) => server!.once("exit", () => done())); server!.kill(); await exit;
    const dbPath = join(root, "data/data.db");
    const fixture = new DatabaseSync(dbPath);
    try { fixture.prepare("DELETE FROM chore_messages").run(); } finally { fixture.close(); }
    const binary = join(repo, "pocketbase/pocketbase");
    const args = ["--dir", join(root, "data"), "--migrationsDir", join(repo, "pocketbase/pb_migrations")];
    execFileSync(binary, ["migrate", "down", "1", ...args], { input: "y\n", stdio: ["pipe", "ignore", "ignore"] });
    execFileSync(binary, ["migrate", "up", ...args], { stdio: "ignore" });
    const db = new DatabaseSync(dbPath);
    try {
      const rows = db.prepare("SELECT kind, body, created FROM chore_messages WHERE assignment = ? ORDER BY sequence").all(a.id);
      expect(rows.map((r) => r.body)).toEqual(["", "Earlier parent request", "Earlier kid reply", "Earlier approval praise"]);
      const legacyDates = db.prepare("SELECT completed_at, approved_at FROM assignments WHERE id = ?").get(a.id)!;
      expect(rows[0]?.created).toBe(legacyDates.completed_at);
      expect(rows[3]?.created).toBe(legacyDates.approved_at);
      expect(db.prepare("SELECT approval_comment, kid_response FROM assignments WHERE id = ?").get(a.id)).toMatchObject({ approval_comment: "Earlier approval praise", kid_response: "Earlier kid reply" });
    } finally { db.close(); }
    expect(() => execFileSync(binary, ["migrate", "down", "1", ...args], { input: "y\n", stdio: ["pipe", "ignore", "ignore"] })).toThrow();
  });

});
