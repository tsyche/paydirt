#!/usr/bin/env node
// Publish a JS-only OTA update for the current app version.
//
// Run with: node --experimental-strip-types scripts/publish-update.mjs
// (Node 26+ strips the .ts import of the shared pure helpers.)
//
// 1. `npx expo export --platform android` into a temp dir
// 2. Hash assets / build server manifest.json (pure helpers from @paydirt/shared)
// 3. Copy into pocketbase/pb_data/updates/<runtimeVersion>/<epochMillis>/
//
// Usage (from repo root, after editing JS/TS only — native changes need a new APK):
//   node --experimental-strip-types scripts/publish-update.mjs
//   RUNTIME_VERSION=1.0.0 node --experimental-strip-types scripts/publish-update.mjs
//
// Requires: PocketBase NOT required (files land on disk; next manifest request picks them up).
// Clients on protocol v1 with a matching Expo-Current-Update-Id get HTTP 204.

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assetHash,
  assetKey,
  buildServerManifest,
  mimeForExt,
} from "../packages/shared/src/updates.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mobileDir = path.join(repoRoot, "apps/mobile");
const updatesRoot = process.env.PAYDIRT_UPDATES_DIR
  ? path.resolve(process.env.PAYDIRT_UPDATES_DIR)
  : path.join(repoRoot, "pocketbase/pb_data/updates");

function readAppVersion() {
  const appJson = JSON.parse(fs.readFileSync(path.join(mobileDir, "app.json"), "utf8"));
  return appJson.expo.version;
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function md5File(file) {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

function mimeForPath(p) {
  return mimeForExt(path.extname(p).replace(/^\./, ""));
}

function collectExportAssets(exportDir) {
  const metadataPath = path.join(exportDir, "metadata.json");
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`expo export did not produce metadata.json at ${metadataPath}`);
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  const platformMeta = metadata.fileMetadata?.android;
  if (!platformMeta) {
    throw new Error("metadata.json has no android section — did you pass --platform android?");
  }

  // Launch asset (Hermes bundle or raw JS) — content-addressed under assets/.
  const launchRel = platformMeta.bundle; // e.g. "assets/hbc/....hbc" or similar
  const launchAbs = path.join(exportDir, launchRel);
  if (!fs.existsSync(launchAbs)) {
    throw new Error(`Launch asset missing: ${launchAbs}`);
  }

  const entries = [
    {
      content: fs.readFileSync(launchAbs),
      launch: true,
      ext: "bundle",
      abs: launchAbs,
    },
  ];

  for (const a of platformMeta.assets || []) {
    // a.path is "assets/<hash>" (no extension); a.ext is the type (png, etc.)
    const abs = path.join(exportDir, a.path);
    if (!fs.existsSync(abs)) {
      console.warn(`  skip missing asset ${a.path}`);
      continue;
    }
    entries.push({
      content: fs.readFileSync(abs),
      launch: false,
      ext: a.ext,
      abs,
    });
  }
  return { metadata, metadataBuffer: fs.readFileSync(metadataPath), entries };
}

function main() {
  const runtimeVersion = process.env.RUNTIME_VERSION || readAppVersion();
  const createdAt = new Date().toISOString();
  const epoch = Date.now();

  console.log(`Publishing OTA update  runtimeVersion=${runtimeVersion}  epoch=${epoch}`);

  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "paydirt-export-"));
  try {
    console.log("Running expo export --platform android ...");
    execFileSync(
      "npx",
      ["expo", "export", "--platform", "android", "--output-dir", exportDir, "--clear"],
      { cwd: mobileDir, stdio: "inherit" },
    );

    const { metadataBuffer, entries } = collectExportAssets(exportDir);
    const serverManifest = buildServerManifest({
      metadataBuffer,
      createdAt,
      runtimeVersion,
      assetEntries: entries,
    });

    const outDir = path.join(updatesRoot, runtimeVersion, String(epoch));
    const assetsDir = path.join(outDir, "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    for (const e of entries) {
      const key = e.launch
        ? assetKey(e.content, { launch: true })
        : assetKey(e.content, { ext: e.ext });
      fs.copyFileSync(e.abs, path.join(assetsDir, key));
    }

    // Persist expo export metadata + app config for reference / future tooling.
    fs.writeFileSync(path.join(outDir, "metadata.json"), metadataBuffer);
    const expoConfig = JSON.parse(
      execFileSync("npx", ["expo", "config", "--json", "--type", "public"], {
        cwd: mobileDir,
        encoding: "utf8",
      }),
    );
    fs.writeFileSync(path.join(outDir, "expoConfig.json"), JSON.stringify(expoConfig, null, 2));
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(serverManifest, null, 2));

    console.log(`\nPublished → ${outDir}`);
    console.log(`  update id:  ${serverManifest.id}`);
    console.log(`  launch:     ${serverManifest.launchAsset.key}`);
    console.log(`  assets:     ${serverManifest.assets.length}`);
    console.log(`\nRestart PocketBase if the hook wasn't loaded yet, then on-device:`);
    console.log(`  curl -H 'expo-runtime-version: ${runtimeVersion}' \\`);
    console.log(`       -H 'expo-platform: android' \\`);
    console.log(`       http://<lan-ip>:3111/api/updates/manifest`);
  } finally {
    fs.rmSync(exportDir, { recursive: true, force: true });
  }
}

main();
