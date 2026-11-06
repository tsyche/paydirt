// Isolated feasibility model. No production imports, device transport, or credentials.
import { generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type Operation = { id: string; device: string; epoch: number; kind: "complete" | "approve" | "reject"; occurrence: string; child: string };
type Envelope = { operation: Operation; signature: string };
type Member = { key: KeyObject; role: "parent" | "child"; child?: string };
const keys = () => generateKeyPairSync("ed25519");
const encode = (op: Operation) => Buffer.from(JSON.stringify(op));
const envelope = (operation: Operation, key: KeyObject): Envelope => ({ operation, signature: sign(null, encode(operation), key).toString("base64") });

/** A fixed settlement authority avoids irreversible effects from competing replicas.
 * Other parents can decide offline, but the decision remains provisional until catch-up.
 * Epoch membership is supplied out of band; propagating/recovering it is NOT proven here.
 */
class Replica {
  db: DatabaseSync;
  constructor(path: string, private members: Map<string, Member>, private epoch = 1) {
    this.db = new DatabaseSync(path);
    this.db.exec("CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settlements (occurrence TEXT PRIMARY KEY, decision TEXT NOT NULL, child TEXT NOT NULL, reward INTEGER NOT NULL)");
  }
  receive(message: Envelope) {
    const op = message.operation;
    const member = this.members.get(op.device);
    if (!member || op.epoch !== this.epoch || !verify(null, encode(op), member.key, Buffer.from(message.signature, "base64"))) throw new Error("Untrusted operation");
    if (member.role === "child" && (op.kind !== "complete" || member.child !== op.child)) throw new Error("Role violation");
    const old = this.db.prepare("SELECT body FROM operations WHERE id = ?").get(op.id);
    if (old && old.body !== JSON.stringify(message)) throw new Error("Operation ID collision");
    this.db.prepare("INSERT OR IGNORE INTO operations VALUES (?, ?)").run(op.id, JSON.stringify(message));
  }
  exportFor(child?: string): Envelope[] {
    return this.db.prepare("SELECT body FROM operations ORDER BY id").all()
      .map((row) => JSON.parse(String(row.body)) as Envelope)
      .filter((e) => !child || e.operation.child === child);
  }
  // Only the designated parent replica calls this. There is no failover protocol.
  settle() {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const messages = this.exportFor();
      for (const { operation: op } of messages) {
        if (op.kind === "complete") continue;
        if (!messages.some(({ operation: c }) => c.kind === "complete" && c.occurrence === op.occurrence && c.child === op.child)) continue;
        this.db.prepare("INSERT OR IGNORE INTO settlements VALUES (?, ?, ?, ?)").run(op.occurrence, op.kind, op.child, op.kind === "approve" ? 5 : 0);
      }
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  balance() { return Number(this.db.prepare("SELECT coalesce(sum(reward), 0) AS balance FROM settlements").get()!.balance); }
  close() { this.db.close(); }
}
const roots: string[] = [];
const open: Replica[] = [];
afterEach(() => { for (const peer of open.splice(0)) peer.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "paydirt-peer-spike-")); roots.push(root);
  const kid = keys(), parent1 = keys(), parent2 = keys();
  const members = new Map<string, Member>([["kid", { key: kid.publicKey, role: "child", child: "child1" }], ["p1", { key: parent1.publicKey, role: "parent" }], ["p2", { key: parent2.publicKey, role: "parent" }]]);
  const peer = (name: string, epoch = 1) => { const replica = new Replica(join(root, name), members, epoch); open.push(replica); return replica; };
  const message = (id: string, device: string, kind: Operation["kind"], child = "child1", occurrence = "daily-2026-11-06") => envelope({ id, device, epoch: 1, kind, child, occurrence }, device === "kid" ? kid.privateKey : device === "p1" ? parent1.privateKey : parent2.privateKey);
  return { peer, message, members };
}
describe("server-free feasibility model (not device acceptance)", () => {
  it("persists offline completion, catches up parent replicas, and settles simultaneous approvals once across restart", () => {
    const { peer, message } = fixture();
    const kid = peer("kid.db"), parent1 = peer("parent1.db"), parent2 = peer("parent2.db");
    kid.receive(message("1", "kid", "complete"));
    expect(parent1.exportFor()).toHaveLength(0);
    for (const op of kid.exportFor()) { parent1.receive(op); parent2.receive(op); }
    parent1.receive(message("2", "p1", "approve")); parent2.receive(message("3", "p2", "approve"));
    for (const op of parent2.exportFor()) { parent1.receive(op); parent1.receive(op); }
    parent1.settle(); expect(parent1.balance()).toBe(5);
    parent1.close(); open.splice(open.indexOf(parent1), 1);
    const restarted = peer("parent1.db"); restarted.settle(); expect(restarted.balance()).toBe(5);
  });
  it("keeps a committed rejection stable when a delayed competing approval arrives", () => {
    const { peer, message } = fixture(); const authority = peer("authority.db");
    authority.receive(message("1", "kid", "complete")); authority.receive(message("3", "p2", "reject"));
    authority.settle(); authority.receive(message("2", "p1", "approve")); authority.settle();
    expect(authority.balance()).toBe(0);
  });
  it("rejects forged authority, cross-child writes, replay collisions, and revoked devices", () => {
    const { peer, message, members } = fixture(); const authority = peer("authority.db");
    expect(() => authority.receive(message("1", "kid", "approve"))).toThrow("Role violation");
    expect(() => authority.receive(message("1", "kid", "complete", "child2"))).toThrow("Role violation");
    const forged = message("1", "kid", "complete"); forged.operation.device = "p1";
    expect(() => authority.receive(forged)).toThrow("Untrusted");
    authority.receive(message("2", "kid", "complete"));
    expect(() => authority.receive(message("2", "kid", "complete", "child1", "other"))).toThrow("collision");
    members.delete("kid"); expect(() => authority.receive(message("3", "kid", "complete"))).toThrow("Untrusted");
    const recovered = peer("recovered.db", 2);
    expect(() => recovered.receive(message("4", "p1", "approve"))).toThrow("Untrusted");
  });
  it("filters sibling operations out of a child catch-up export", () => {
    const { peer, message } = fixture(); const authority = peer("authority.db");
    authority.receive(message("1", "p1", "approve", "child1")); authority.receive(message("2", "p1", "approve", "child2"));
    expect(authority.exportFor("child1").map((e) => e.operation.child)).toEqual(["child1"]);
  });
});
