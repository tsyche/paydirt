import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import PocketBase from "pocketbase";

describe("local backup restore drill (real PocketBase)", () => {
  const repo = resolve(import.meta.dirname, "../../..");
  const root = mkdtempSync(join(tmpdir(), "paydirt-restore-test-"));
  const data = join(root, "source");
  const work = join(root, "work");
  const binary = join(repo, "pocketbase/pocketbase");
  const archive = join(data, "backups/fixture.zip");
  const version = execFileSync(binary, ["--version"], { encoding: "utf8" }).match(/\d+\.\d+\.\d+/)![0];
  let source: ChildProcess | undefined;
  let admin: PocketBase;
  let superusers: number;

  beforeAll(async () => {
    mkdirSync(work);
    const reservation = createServer();
    await new Promise<void>((done) => reservation.listen(0, "127.0.0.1", done));
    const port = (reservation.address() as { port: number }).port;
    await new Promise<void>((done) => reservation.close(() => done()));
    const url = `http://127.0.0.1:${port}`;
    const hooks = join(root, "hooks");
    cpSync(join(repo, "pocketbase/pb_hooks"), hooks, { recursive: true });
    const args = ["--dir", data, "--migrationsDir", join(repo, "pocketbase/pb_migrations")];
    execFileSync(binary, ["migrate", "up", ...args], { stdio: "ignore" });
    execFileSync(binary, ["superuser", "upsert", "admin@paydirt.local", "password123", ...args], { stdio: "ignore" });
    source = spawn(binary, ["serve", ...args, "--hooksWatch=false", "--hooksDir", hooks, "--http", `127.0.0.1:${port}`], {
      stdio: "ignore", env: { ...process.env, NTFY_DISABLED: "1", FL_AUTOMATION_ENABLED: "0" },
    });
    let healthy = false;
    for (let i = 0; i < 100; i++) {
      try { healthy = (await fetch(url + "/api/health")).ok; } catch { /* Startup. */ }
      if (healthy) break;
      await new Promise((done) => setTimeout(done, 50));
    }
    if (!healthy) throw new Error("Fixture PocketBase did not start.");
    execFileSync(process.execPath, [join(repo, "pocketbase/seed.mjs")], { stdio: "ignore", env: { ...process.env, PB_URL: url } });
    admin = new PocketBase(url);
    await admin.collection("_superusers").authWithPassword("admin@paydirt.local", "password123");
    superusers = (await admin.collection("_superusers").getFullList()).length;
    await admin.backups.create("fixture.zip");
    for (let i = 0; i < 100 && !existsSync(archive); i++) await new Promise((done) => setTimeout(done, 50));
    expect(existsSync(archive)).toBe(true);
  }, 20_000);

  afterAll(async () => {
    if (source?.exitCode === null) {
      const exited = new Promise<void>((done) => source!.once("exit", () => done()));
      source.kill();
      await exited;
    }
    rmSync(root, { recursive: true, force: true });
  });

  async function run(file: string, args: string[] = []) {
    const result = await new Promise<{ code: number | null; output: string }>((done, fail) => {
      const child = spawn("just", ["--justfile", join(repo, "justfile"), "restore-drill", file, ...args], {
        cwd: repo, env: { ...process.env, TMPDIR: work, PB_URL: "http://127.0.0.1:1" },
      });
      let output = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { output += chunk; });
      child.on("error", fail);
      child.on("exit", (code) => done({ code, output }));
    });
    expect(readdirSync(work)).toEqual([]);
    return result;
  }

  function altered(mode: "legacy" | "version" | "drift") {
    const output = join(root, mode + ".zip");
    execFileSync("python3", ["-c", `
import json, pathlib, sqlite3, sys, tempfile, zipfile
source, target, mode = sys.argv[1:]
with tempfile.TemporaryDirectory() as temp, zipfile.ZipFile(source) as original, zipfile.ZipFile(target, "w") as changed:
    for item in original.infolist():
        if mode == "legacy" and item.filename == "paydirt-backup.json": continue
        content = original.read(item.filename)
        if mode == "version" and item.filename == "paydirt-backup.json":
            content = json.dumps({"pocketbaseVersion": "0.0.0"}).encode()
        if mode == "drift" and item.filename == "data.db":
            path = pathlib.Path(temp, "data.db"); path.write_bytes(content)
            db = sqlite3.connect(path)
            db.execute("UPDATE users SET balance = balance + 1 WHERE id = (SELECT id FROM users LIMIT 1)")
            db.commit(); db.close(); content = path.read_bytes()
        changed.writestr(item, content)
`, archive, output, mode]);
    return output;
  }

  it("boots a real backup, verifies the ledger, avoids a busy port and preserves the source", async () => {
    const digest = () => createHash("sha256").update(readFileSync(archive)).digest("hex");
    const before = digest();
    const named = join(root, "backup with spaces.zip");
    cpSync(archive, named);
    const occupied = createServer();
    const bound = await new Promise<boolean>((done, fail) => {
      occupied.on("error", (error: NodeJS.ErrnoException) => error.code === "EADDRINUSE" ? done(false) : fail(error));
      occupied.listen(3113, "127.0.0.1", () => done(true));
    });
    try {
      const result = await run(named);
      expect(result.output).toContain("Restore drill PASS");
      expect(result.output).toContain("Ledger OK");
      expect(result.output).not.toContain("loopback port 3113");
      expect(result.code).toBe(0);
      const port = Number(result.output.match(/loopback port (\d+)/)?.[1]);
      expect(port).toBeGreaterThanOrEqual(3113);
      expect(port).toBeLessThanOrEqual(3119);
      const released = createServer();
      await new Promise<void>((done, fail) => { released.once("error", fail); released.listen(port, "127.0.0.1", done); });
      await new Promise<void>((done) => released.close(() => done()));
      expect(digest()).toBe(before);
      expect((await admin.collection("_superusers").getFullList()).length).toBe(superusers);
    } finally {
      if (bound) await new Promise<void>((done) => occupied.close(() => done()));
    }
  });

  it("fails on ledger drift without correcting it or leaking household details", async () => {
    const result = await run(altered("drift"));
    expect(result.code).toBe(1);
    expect(result.output).toContain("Restored ledger verification FAILED");
    expect(result.output).not.toContain("cached=");
  });

  it("requires a known version for legacy backups and rejects mismatched metadata", async () => {
    const legacy = altered("legacy");
    expect((await run(legacy)).output).toContain("version is unrecorded");
    expect((await run(legacy, ["--backup-version", version])).code).toBe(0);
    const mismatch = await run(altered("version"));
    expect(mismatch.code).toBe(1);
    expect(mismatch.output).toContain("Backup requires PocketBase 0.0.0");
  });

  it("rejects invalid archives and unsafe paths before restoring", async () => {
    const corrupt = join(root, "corrupt.zip");
    writeFileSync(corrupt, "not a zip");
    expect((await run(corrupt)).code).toBe(1);
    const unsafe = join(root, "unsafe.zip");
    execFileSync("python3", ["-c", 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],"w"); z.writestr("../escaped","no"); z.close()', unsafe]);
    expect((await run(unsafe)).output).toContain("unsafe member");
    expect(existsSync(join(work, "escaped"))).toBe(false);
  });
});
