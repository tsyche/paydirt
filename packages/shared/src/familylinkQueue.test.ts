import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, chmod } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { processFamilyLinkQueue, type FamilyLinkJob } from "./familylinkQueue";

const roots: string[] = [];
const job: FamilyLinkJob = {
  id: "a12345678901234", childId: "123456789012", deviceId: "a".repeat(30), seconds: 900,
};
async function setup(part = "pending", value: unknown = job) {
  const root = await mkdtemp(join(tmpdir(), "paydirt-queue-"));
  roots.push(root);
  await mkdir(join(root, part), { recursive: true });
  await writeFile(join(root, part, `${job.id}.json`), JSON.stringify(value));
  return root;
}
async function result(root: string, id = job.id) {
  return JSON.parse(await readFile(join(root, "results", `${id}.json`), "utf8"));
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Family Link queue worker", () => {
  it("runs the real worker entry point with automation disabled", async () => {
    const root = await setup();
    execFileSync(process.execPath, [
      "--experimental-strip-types",
      new URL("../../../scripts/familylink-worker.mts", import.meta.url).pathname,
    ], { stdio: "pipe", env: { ...process.env, FL_QUEUE_DIR: root, FL_AUTOMATION_ENABLED: "0" } });
    expect(await result(root)).toMatchObject({ status: "manual", error: "disabled" });
  });

  it("drains jobs serially, records success, and never replays a receipt", async () => {
    const root = await setup();
    const second = { ...job, id: "b12345678901234", seconds: 1800 };
    await writeFile(join(root, "pending", `${second.id}.json`), JSON.stringify(second));
    const calls: string[] = [];
    let active = 0;
    await processFamilyLinkQueue(root, async (value) => {
      expect(active++).toBe(0);
      calls.push(value.id);
      await new Promise((done) => setTimeout(done, 5));
      active--;
      return 0;
    }, true);
    expect(calls).toEqual([job.id, second.id]);
    expect(await result(root)).toEqual({ id: job.id, status: "granted", error: "" });
    expect(await readdir(join(root, "pending"))).toEqual([]);
    expect(await readdir(join(root, "processing"))).toEqual([]);
    // A second publish of the same spend must not buy more time.
    await writeFile(join(root, "pending", `${job.id}.json`), JSON.stringify(job));
    await processFamilyLinkQueue(root, async () => { throw new Error("duplicate grant"); }, true);
    expect(await result(root)).toMatchObject({ status: "granted" });
  });

  it.each([2, 1])("records exit %s as manual review without retrying", async (code) => {
    const root = await setup();
    let calls = 0;
    const grant = async () => { calls++; return code; };
    await processFamilyLinkQueue(root, grant, true);
    await processFamilyLinkQueue(root, grant, true);
    expect(calls).toBe(1);
    expect(await result(root)).toMatchObject({
      status: "manual", error: code === 2 ? "session_expired" : "failed",
    });
  });

  it("does not retry a claimed job after interruption", async () => {
    const root = await setup("processing");
    let called = false;
    await processFamilyLinkQueue(root, async () => { called = true; return 0; }, true);
    expect(called).toBe(false);
    expect(await result(root)).toMatchObject({ status: "manual", error: "interrupted" });
  });

  it("ends the service run after a failed browser before attempting another grant", async () => {
    const root = await setup();
    const second = { ...job, id: "b12345678901234" };
    await writeFile(join(root, "pending", `${second.id}.json`), JSON.stringify(second));
    let calls = 0;
    await processFamilyLinkQueue(root, async () => { calls++; return 1; }, true);
    expect(calls).toBe(1);
    expect(await readdir(join(root, "pending"))).toEqual([`${second.id}.json`]);
    expect(await result(root)).toMatchObject({ status: "manual", error: "failed" });
  });

  it("preserves a receipt when interrupted before removing the claimed job", async () => {
    const root = await setup("processing");
    await mkdir(join(root, "results"));
    await writeFile(join(root, "results", `${job.id}.json`),
      JSON.stringify({ id: job.id, status: "granted", error: "" }));
    await processFamilyLinkQueue(root, async () => { throw new Error("replay"); }, true);
    expect(await result(root)).toMatchObject({ status: "granted" });
  });

  it.each([
    { ...job, seconds: 1 },
    { ...job, id: "other" },
    { ...job, childId: "bad" },
    { ...job, deviceId: "--flag" },
    null,
  ])("rejects malformed jobs before reaching Google: %j", async (value) => {
    const root = await setup("pending", value);
    let calls = 0;
    await processFamilyLinkQueue(root, async () => { calls++; return 0; }, true);
    expect(calls).toBe(0);
    expect(await result(root)).toMatchObject({ status: "manual", error: "invalid_request" });
  });

  it("does not grant queued work when automation is disabled", async () => {
    const root = await setup();
    let calls = 0;
    await processFamilyLinkQueue(root, async () => { calls++; return 0; }, false);
    expect(calls).toBe(0);
    expect(await result(root)).toMatchObject({ status: "manual", error: "disabled" });
  });

  it("stops before Google when receipt lookup fails with a filesystem error", async () => {
    const root = await setup();
    const results = join(root, "results");
    await mkdir(results);
    await writeFile(join(results, `${job.id}.json`), JSON.stringify({ id: job.id, status: "granted" }));
    await chmod(results, 0);
    let calls = 0;
    try {
      await expect(processFamilyLinkQueue(root, async () => { calls++; return 0; }, true)).rejects.toThrow();
      expect(calls).toBe(0);
    } finally {
      await chmod(results, 0o700);
    }
  });
});
