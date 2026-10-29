// Node-only filesystem queue. The caller holds the shared grant.lock for this
// entire run, including recovery. grant() is the Google/browser boundary.
import { mkdir, readdir, readFile, rename, unlink, writeFile, access, open } from "node:fs/promises";
import { join, dirname } from "node:path";

export interface FamilyLinkJob {
  id: string;
  childId: string;
  deviceId: string;
  seconds: number;
}

async function exists(file: string) {
  try { await access(file); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function syncPath(path: string) {
  const handle = await open(path, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

function validJob(value: unknown, id: string): value is FamilyLinkJob {
  if (!value || typeof value !== "object") return false;
  const job = value as FamilyLinkJob;
  return job.id === id && /^\d{10,30}$/.test(job.childId) &&
    /^[a-z0-9]{20,80}$/.test(job.deviceId) &&
    [900, 1800, 2700, 3600].includes(job.seconds);
}

export async function processFamilyLinkQueue(
  directory: string,
  grant: (job: FamilyLinkJob) => Promise<number>,
  enabled: boolean,
) {
  const pending = join(directory, "pending");
  const processing = join(directory, "processing");
  const results = join(directory, "results");
  for (const path of [pending, processing, results]) await mkdir(path, { recursive: true, mode: 0o700 });
  await syncPath(directory);
  await syncPath(dirname(directory));

  async function receipt(id: string, status: "granted" | "manual", error = "") {
    const file = join(results, `${id}.json`);
    await writeFile(`${file}.tmp`, JSON.stringify({ id, status, error }), { mode: 0o600, flush: true });
    await rename(`${file}.tmp`, file);
    await syncPath(results);
  }

  // A lost worker may have reached Google. Never replay an uncertain write.
  for (const name of await readdir(processing)) {
    if (!/^[a-z0-9]{15}\.json$/.test(name)) continue;
    const id = name.slice(0, -5);
    if (!await exists(join(results, name))) await receipt(id, "manual", "interrupted");
    await unlink(join(processing, name));
  }

  // A service activation drains everything present. The path unit reactivates
  // for jobs arriving after the final directory scan.
  for (;;) {
    const names = (await readdir(pending)).filter((n) => /^[a-z0-9]{15}\.json$/.test(n)).sort();
    if (!names.length) return;
    for (const name of names) {
      const id = name.slice(0, -5);
      const source = join(pending, name);
      if (await exists(join(results, name))) {
        await unlink(source);
        continue;
      }
      const claimed = join(processing, name);
      await rename(source, claimed);
      // Persist the claim before contacting Google, including across host
      // power loss. Recovery must see either the claim or its receipt.
      await syncPath(claimed);
      await syncPath(processing);
      await syncPath(pending);
      let job: unknown;
      let browserFailed = false;
      try { job = JSON.parse(await readFile(claimed, "utf8")); } catch { /* Invalid request. */ }
      if (!validJob(job, id)) {
        await receipt(id, "manual", "invalid_request");
      } else if (!enabled) {
        await receipt(id, "manual", "disabled");
      } else {
        let exitCode = 1;
        try { exitCode = await grant(job); } catch { /* Uncertain outcome. */ }
        browserFailed = exitCode !== 0;
        await receipt(id, exitCode === 0 ? "granted" : "manual",
          exitCode === 2 ? "session_expired" : exitCode === 0 ? "" : "failed");
      }
      await unlink(claimed);
      // Leave the service after a browser failure/timeout. systemd reaps its
      // entire cgroup before the path unit starts another grant.
      if (browserFailed) return;
    }
  }
}
