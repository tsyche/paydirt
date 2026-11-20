import { afterAll, beforeAll, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer, type ServerResponse } from "node:http";
import PocketBase from "pocketbase";
import { PaydirtClient } from "./client";
import { processNotificationQueue } from "./notificationQueue";

const repo = resolve(import.meta.dirname, "../../..");
const root = mkdtempSync(join(tmpdir(), "paydirt-notifications-"));
const queue = join(root, "push");
let server: ChildProcess;
let parent: PaydirtClient;
let kid: PaydirtClient;
let admin: PocketBase;
let endpoint: string;
const held: ServerResponse[] = [];
const received: string[] = [];
const push = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => { received.push(body); held.push(res); });
});

beforeAll(async () => {
  await new Promise<void>((done) => push.listen(0, "127.0.0.1", done));
  endpoint = `http://127.0.0.1:${(push.address() as { port: number }).port}/push`;
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
    stdio: "ignore", env: { ...process.env, NTFY_DISABLED: "", NTFY_QUEUE_DIR: queue, NTFY_SERVER: endpoint },
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
  rmSync(queue, { recursive: true, force: true });
  mkdirSync(join(queue, "pending"), { recursive: true });
}, 20_000);

afterAll(async () => {
  for (const response of held) response.end("ok");
  push.closeAllConnections();
  await new Promise<void>((done) => push.close(() => done()));
  if (server?.exitCode === null) {
    const exited = new Promise<void>((done) => server.once("exit", () => done()));
    server.kill();
    await exited;
  }
  rmSync(root, { recursive: true, force: true });
});

it.each(["chore", "spend"] as const)("commits a %s approval and exposes its updated state without waiting for a stalled push endpoint", async (kind) => {
  received.length = 0;
  held.length = 0;
  const chore = await parent.createChore({ household: parent.currentUser!.household, name: "Latency fixture", reward: 10,
    type: "oneoff", created_by: parent.currentUser!.id, active: true });
  const assignment = await parent.assignChore(chore.id, kid.currentUser!.id);
  await kid.markComplete(assignment.id);
  await admin.collection("users").update(kid.currentUser!.id, { up_endpoint: endpoint });
  const spend = kind === "spend" ? await kid.submitSpendRequest(kid.currentUser!.id, 1, "Latency fixture") : undefined;
  const approval = spend
    ? parent.approveSpendRequest(spend.id, parent.currentUser!.id)
    : parent.approveAssignment(assignment.id);
  let timer: ReturnType<typeof setTimeout>;
  const outcome = await Promise.race([
    approval.then(() => "approved"),
    new Promise<string>((done) => { timer = setTimeout(() => done("blocked by push"), 1000); }),
  ]);
  clearTimeout(timer!);
  // Release the network boundary so the unfixed implementation can finish.
  for (const response of held) response.end("ok");
  await approval;
  expect(outcome).toBe("approved");
  if (spend) {
    expect((await kid.pb.collection("spend_requests").getOne(spend.id)).status).toBe("approved");
  } else {
    expect((await kid.getConversationAssignment(assignment.id)).status).toBe("approved");
  }
  expect(received).toEqual([]);
  const files = readdirSync(join(queue, "pending"));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) expect(statSync(join(queue, "pending", file)).mode & 0o777).toBe(0o600);
  const jobs = files.map((file) => JSON.parse(readFileSync(join(queue, "pending", file), "utf8")));
  const expected = jobs.filter((job) => job.url === endpoint).map((job) => JSON.parse(job.body));
  expect(expected.length).toBeGreaterThan(0);
  expect(expected.some((payload) => payload.type === "chore_assigned")).toBe(false);
  // Exercise the actual worker against the same stalled network boundary.
  const delivered = processNotificationQueue(queue);
  try {
    for (let i = 0; i < 100 && received.length < expected.length; i++) {
      await new Promise((done) => setTimeout(done, 10));
    }
    expect(received.map((body) => JSON.parse(body))).toEqual(expect.arrayContaining(expected));
    expect(received).toHaveLength(expected.length);
  } finally {
    for (const response of held) response.end("ok");
    await delivered;
  }
  expect(readdirSync(join(queue, "pending"))).toEqual([]);
  expect(readdirSync(join(queue, "processing"))).toEqual([]);
});
