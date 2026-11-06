// Invoked only by paydirt-fl.service, while holding the shared grant.lock.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { processFamilyLinkQueue } from "../packages/shared/src/familylinkQueue.ts";

const cli = fileURLToPath(new URL("./familylink-grant.mjs", import.meta.url));
try {
  await processFamilyLinkQueue(
    process.env.FL_QUEUE_DIR ?? "/var/lib/paydirt/familylink/queue",
    async (job) => {
      try {
        const output = execFileSync(process.execPath, [
          "--experimental-strip-types", cli, "grant", String(job.seconds), job.childId, job.deviceId,
          job.validUntil || "",
        ], { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8", timeout: 60_000, killSignal: "SIGKILL" });
        return { code: 0, deliveredSeconds: JSON.parse(output).deliveredSeconds };
      } catch (error) {
        return (error as { status?: number }).status === 2 ? 2 : 1;
      }
    },
    process.env.FL_AUTOMATION_ENABLED === "1",
  );
} catch {
  console.error("Family Link worker stopped; pending jobs remain on disk.");
  process.exitCode = 1;
}
