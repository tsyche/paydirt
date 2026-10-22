#!/usr/bin/env node
// Mark the newest published update for a runtime version as rolled back.
// Drops a `rollback` marker into pb_data/updates/<runtimeVersion>/<newest-epoch>/.
// Protocol v1 clients then receive a rollBackToEmbedded directive on next check.
//
// Usage:
//   node scripts/rollback-update.mjs              # current app.json version, set
//   node scripts/rollback-update.mjs 1.0.0        # explicit runtime version, set
//   node scripts/rollback-update.mjs 1.0.0 clear  # remove the marker instead
//   node scripts/rollback-update.mjs --clear      # current version, clear

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const updatesRoot = process.env.PAYDIRT_UPDATES_DIR
  ? path.resolve(process.env.PAYDIRT_UPDATES_DIR)
  : path.join(repoRoot, "pocketbase/pb_data/updates");

function readAppVersion() {
  const appJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "apps/mobile/app.json"), "utf8"),
  );
  return appJson.expo.version;
}

const args = process.argv.slice(2).filter((a) => a !== "");
const clear = args.includes("clear") || args.includes("--clear");
const runtimeArg = args.find((a) => a !== "clear" && a !== "--clear");
const runtimeVersion = runtimeArg || readAppVersion();

const versionRoot = path.join(updatesRoot, runtimeVersion);
if (!fs.existsSync(versionRoot)) {
  console.error(`No updates directory for runtime version ${runtimeVersion} at ${versionRoot}`);
  process.exit(1);
}

const epochs = fs
  .readdirSync(versionRoot)
  .filter((name) => fs.statSync(path.join(versionRoot, name)).isDirectory())
  .sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0));

if (epochs.length === 0) {
  console.error(`No published updates under ${versionRoot}`);
  process.exit(1);
}

const newest = path.join(versionRoot, epochs[0]);
const marker = path.join(newest, "rollback");

if (clear) {
  if (fs.existsSync(marker)) {
    fs.rmSync(marker);
    console.log(`Cleared rollback marker in ${newest}`);
  } else {
    console.log(`No rollback marker in ${newest}`);
  }
} else {
  fs.writeFileSync(marker, new Date().toISOString());
  console.log(`Rollback marker written → ${marker}`);
  console.log(`Protocol v1 clients will roll back to the embedded bundle on next check.`);
  console.log(`Clear with: node scripts/rollback-update.mjs ${runtimeVersion} clear`);
}
