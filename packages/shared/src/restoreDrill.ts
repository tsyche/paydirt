import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Pick the newest pulled ZIP by modification time, independent of its name. */
export async function newestBackup(dir: string): Promise<string> {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") throw new Error("No pulled backups found. Run just backup-pull first.");
    throw error;
  });
  const candidates = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".zip"))
    .map(async (entry) => {
      const path = join(dir, entry.name);
      return { path, modified: (await stat(path)).mtimeMs };
    }));
  candidates.sort((a, b) => b.modified - a.modified || b.path.localeCompare(a.path));
  if (!candidates[0]) throw new Error("No pulled backups found. Run just backup-pull first.");
  return candidates[0].path;
}

// Python's standard ZIP reader avoids a new dependency. Reject links/traversal
// before extracting anything, and keep restored credentials/files private.
const extractZip = `
import os, pathlib, stat, sys, zipfile
os.umask(0o077)
archive, destination = sys.argv[1:]
with zipfile.ZipFile(archive) as source:
    seen = set()
    for item in source.infolist():
        path = pathlib.PurePosixPath(item.filename)
        mode = stat.S_IFMT(item.external_attr >> 16)
        if (path.is_absolute() or ".." in path.parts or "\\\\" in item.filename
            or ":" in item.filename or mode not in (0, stat.S_IFREG, stat.S_IFDIR)
            or str(path) in seen):
            raise ValueError("Unsafe or duplicate backup member")
        seen.add(str(path))
    source.extractall(destination)
    for root, dirs, files in os.walk(destination):
        os.chmod(root, 0o700)
        for name in files: os.chmod(os.path.join(root, name), 0o600)
if not pathlib.Path(destination, "data.db").is_file():
    raise ValueError("Backup has no data.db")
`;

async function freePort(): Promise<number> {
  // Never use the normal web/PocketBase/test-all ports (3110–3112).
  for (let port = 3113; port <= 3119; port++) {
    const server = createServer();
    const available = await new Promise<boolean>((done, fail) => {
      server.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") done(false);
        else fail(error);
      });
      server.listen(port, "127.0.0.1", () => done(true));
    });
    if (available) {
      await new Promise<void>((done, fail) => server.close((error) => error ? fail(error) : done()));
      return port;
    }
  }
  throw new Error("No free restore-drill port in 3113–3119.");
}

async function stop(server: ChildProcess | undefined): Promise<void> {
  if (!server?.pid || server.exitCode !== null || server.signalCode !== null) return;
  await new Promise<void>((done) => {
    const force = setTimeout(() => server.kill("SIGKILL"), 3000);
    server.once("exit", () => { clearTimeout(force); done(); });
    server.kill("SIGTERM");
  });
}

export interface RestoreDrillOptions {
  archive: string;
  binary: string;
  /** For legacy archives only: the known creating version, not a guess. */
  backupVersion?: string;
}

/** Restore only into a private temporary copy. No SSH, production URLs,
 * current app hooks/migrations, notifications, or Family Link workers run.
 */
export async function restoreDrill(options: RestoreDrillOptions) {
  const archive = resolve(options.archive);
  const binary = resolve(options.binary);
  const version = execFileSync(binary, ["--version"], { encoding: "utf8" }).match(/\b\d+\.\d+\.\d+\b/)?.[0];
  if (!version) throw new Error("Cannot determine PocketBase binary version.");
  const work = await mkdtemp(join(tmpdir(), "paydirt-restore-drill-"));
  const data = join(work, "data");
  let server: ChildProcess | undefined;
  const abort = new AbortController();
  const interrupted = () => abort.abort(new Error("Restore drill interrupted."));
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  try {
    await mkdir(data, { mode: 0o700 });
    try {
      execFileSync("python3", ["-c", extractZip, archive, data], { stdio: "pipe" });
    } catch {
      throw new Error("Cannot extract backup: invalid ZIP, unsafe member, or missing data.db.");
    }
    let recorded: string | undefined;
    try {
      const metadata = JSON.parse(await readFile(join(data, "paydirt-backup.json"), "utf8"));
      if (typeof metadata.pocketbaseVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(metadata.pocketbaseVersion)) {
        throw new Error("Invalid version.");
      }
      recorded = metadata.pocketbaseVersion;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Invalid backup version metadata.");
    }
    if (recorded && options.backupVersion && recorded !== options.backupVersion) {
      throw new Error("Supplied backup version conflicts with the archive metadata.");
    }
    const expected = recorded || options.backupVersion;
    if (!expected) throw new Error("Backup version is unrecorded. Supply its known version with --backup-version (do not guess).");
    if (expected !== version) throw new Error(`Backup requires PocketBase ${expected}; the local binary is ${version}.`);
    const db = new DatabaseSync(join(data, "data.db"), { readOnly: true });
    try {
      const integrity = db.prepare("PRAGMA quick_check").all();
      if (integrity.length !== 1 || integrity[0]?.quick_check !== "ok") throw new Error("Backup SQLite integrity check failed.");
      // Reject an unrelated/new database before the binary can initialize it.
      db.prepare("SELECT id, balance FROM users LIMIT 1").all();
      db.prepare("SELECT user, amount FROM currency_transactions LIMIT 1").all();
    } finally { db.close(); }
    abort.signal.throwIfAborted();
    const empty = join(work, "empty");
    await mkdir(empty, { mode: 0o700 });
    const hooks = join(work, "safety-hooks");
    await mkdir(hooks, { mode: 0o700 });
    // The snapshot may contain remote-backup/email settings. Disable those in
    // the copy as well as excluding the application's own hooks/workers.
    await writeFile(join(hooks, "isolation.pb.js"),
      'onBootstrap((e) => { e.next(); const s = e.app.settings(); s.backups.cron = ""; s.backups.s3.enabled = false; s.smtp.enabled = false; e.app.save(s); });\n',
      { mode: 0o600 });
    const args = ["--dir", data, "--automigrate=false", "--hooksWatch=false",
      "--hooksDir", hooks, "--migrationsDir", empty, "--publicDir", empty];
    const email = "restore-drill@paydirt.local";
    const password = randomBytes(32).toString("hex");
    // This account exists only in the disposable copy; source auth is untouched.
    try {
      execFileSync(binary, ["superuser", "upsert", email, password, ...args], { stdio: "pipe", timeout: 5000 });
    } catch {
      throw new Error("Cannot initialize the disposable restore account.");
    }
    const port = await freePort();
    const url = `http://127.0.0.1:${port}`;
    server = spawn(binary, ["serve", ...args, "--http", `127.0.0.1:${port}`], {
      stdio: "ignore",
      env: { ...process.env, NTFY_DISABLED: "1", FL_AUTOMATION_ENABLED: "0" },
    });
    let startError = false;
    server.on("error", () => { startError = true; });
    let healthy = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      abort.signal.throwIfAborted();
      if (startError || server.exitCode !== null || server.signalCode !== null) break;
      try { healthy = (await fetch(url + "/api/health", { signal: AbortSignal.timeout(500) })).ok; } catch { /* Startup. */ }
      if (healthy) break;
      await new Promise((done) => setTimeout(done, 50));
    }
    if (!healthy) throw new Error("Restored PocketBase did not start.");
    let summary: string;
    try {
      summary = execFileSync(process.execPath, [resolve(import.meta.dirname, "../../../pocketbase/verify-ledger.mjs")], {
        encoding: "utf8", timeout: 15_000, stdio: "pipe",
        env: { ...process.env, PB_URL: url, PB_ADMIN_EMAIL: email, PB_ADMIN_PASSWORD: password },
      });
    } catch {
      // The ordinary verifier prints names/deltas; keep those private here.
      throw new Error("Restored ledger verification FAILED. No balances were changed.");
    }
    const counts = summary.match(/Ledger OK — (\d+) users, (\d+) transactions/);
    if (!counts) throw new Error("Ledger verifier returned no success summary.");
    return { archive: basename(archive), version, port, users: Number(counts[1]), transactions: Number(counts[2]) };
  } finally {
    process.removeListener("SIGINT", interrupted);
    process.removeListener("SIGTERM", interrupted);
    try { await stop(server); }
    finally { await rm(work, { recursive: true, force: true }); }
  }
}
