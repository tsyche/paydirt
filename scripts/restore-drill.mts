import { resolve } from "node:path";
import { newestBackup, restoreDrill } from "../packages/shared/src/restoreDrill.ts";

try {
  const args = process.argv.slice(2);
  const versionIndex = args.indexOf("--backup-version");
  let backupVersion: string | undefined;
  if (versionIndex !== -1) {
    backupVersion = args[versionIndex + 1];
    if (!backupVersion || !/^\d+\.\d+\.\d+$/.test(backupVersion)) throw new Error("--backup-version requires x.y.z.");
    args.splice(versionIndex, 2);
  }
  if (args.length > 1 || args.some((arg) => arg.startsWith("-"))) {
    throw new Error("Usage: just restore-drill [backup.zip] [--backup-version x.y.z]");
  }
  const repo = resolve(import.meta.dirname, "..");
  const archive = args[0] || await newestBackup(resolve(repo, "backups/host"));
  const result = await restoreDrill({ archive, binary: resolve(repo, "pocketbase/pocketbase"), backupVersion });
  console.log(`Restore drill PASS — ${result.archive}; PocketBase ${result.version}; loopback port ${result.port}.`);
  console.log(`Ledger OK — ${result.users} users, ${result.transactions} transactions, all balances match.`);
  console.log("Temporary server stopped and restored data removed. Source archive unchanged.");
} catch (error) {
  console.error(`Restore drill FAILED — ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
}
