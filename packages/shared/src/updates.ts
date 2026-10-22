// Pure helpers for the expo-updates publish pipeline (no I/O — unit-tested).
// The Android FileDownloader accepts a non-multipart JSON manifest body
// (protocol 0 or 1) and multipart only for directives.

import crypto from "node:crypto";

/**
 * Convert a full SHA-256 hex digest to the UUID form expo-updates uses for
 * manifest ids (first 8-4-4-4-12 of the hex string).
 */
export function sha256HexToUuid(hex: string): string {
  if (!/^[a-f0-9]{64}$/.test(hex)) {
    throw new Error(`Not a SHA-256 hex digest: ${hex}`);
  }
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Manifest update id = UUID form of SHA-256(metadata.json bytes). */
export function updateIdFromMetadataJson(metadataBuffer: Buffer): string {
  return sha256HexToUuid(crypto.createHash("sha256").update(metadataBuffer).digest("hex"));
}

/** Asset key = md5 hex of file contents (optionally suffixed with .ext for non-launch). */
export function assetKey(
  content: Buffer,
  opts: { launch?: boolean; ext?: string | null } = {},
): string {
  const md5 = crypto.createHash("md5").update(content).digest("hex");
  if (opts.launch) return `${md5}.bundle`;
  if (opts.ext) return `${md5}.${String(opts.ext).replace(/^\./, "")}`;
  return md5;
}

/** Asset hash field = base64url(SHA-256(content)) — no padding, URL-safe alphabet. */
export function assetHash(content: Buffer): string {
  return crypto
    .createHash("sha256")
    .update(content)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function mimeForExt(ext: string | null | undefined): string {
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ttf: "font/ttf",
    otf: "font/otf",
    woff: "font/woff",
    woff2: "font/woff2",
    hbc: "application/octet-stream",
    bundle: "application/javascript",
    js: "application/javascript",
    json: "application/json",
  };
  return map[String(ext || "").toLowerCase()] || "application/octet-stream";
}

/**
 * Build the on-disk manifest.json the PocketBase hook serves to clients.
 * `assetEntries` is [{ content, ext, launch, relativePathInExport }] already read
 * from the expo export output; keys/hashes are derived here so tests can assert
 * the exact wire format.
 */
export interface AssetEntry {
  content: Buffer;
  ext?: string | null;
  launch?: boolean;
  abs?: string;
}

export interface BuildServerManifestArgs {
  metadataBuffer: Buffer;
  createdAt: string;
  runtimeVersion: string;
  assetEntries: AssetEntry[];
}

export function buildServerManifest({
  metadataBuffer,
  createdAt,
  runtimeVersion,
  assetEntries,
}: BuildServerManifestArgs) {
  const id = updateIdFromMetadataJson(metadataBuffer);
  const launch = assetEntries.find((a) => a.launch);
  if (!launch) {
    throw new Error("buildServerManifest: at least one launch asset required");
  }
  const launchKey = assetKey(launch.content, { launch: true });
  const assets = assetEntries
    .filter((a) => !a.launch)
    .map((a) => {
      const ext = String(a.ext || "").replace(/^\./, "");
      return {
        hash: assetHash(a.content),
        key: assetKey(a.content, { ext }),
        contentType: mimeForExt(ext),
        fileExtension: ext ? `.${ext}` : "",
        // Path on disk under the update dir (hook rewrites url to absolute).
        diskKey: assetKey(a.content, { ext }),
      };
    });

  return {
    id,
    createdAt,
    runtimeVersion,
    launchAsset: {
      hash: assetHash(launch.content),
      key: launchKey,
      contentType: "application/javascript",
      fileExtension: ".bundle",
      diskKey: launchKey,
    },
    assets,
    metadata: {},
    extra: {},
  };
}

export interface ManifestDecisionArgs {
  protocolVersion: number;
  platform: string;
  runtimeVersion: string;
  hasUpdateDir: boolean;
  hasRollback: boolean;
  currentUpdateId: string;
  embeddedUpdateId: string;
  manifestId: string;
}

/**
 * Decide the response mode for a manifest request (mirrors the hook logic so
 * we can unit-test the decision table without a running PocketBase).
 * mode: "manifest" | "no-update" | "rollback" | "error"
 */
export function decideManifestResponse({
  protocolVersion,
  platform,
  runtimeVersion,
  hasUpdateDir,
  hasRollback,
  currentUpdateId,
  embeddedUpdateId,
  manifestId,
}: ManifestDecisionArgs) {
  if (platform !== "android" && platform !== "ios") {
    return { mode: "error", status: 400, message: "Unsupported platform." };
  }
  if (!runtimeVersion) {
    return { mode: "error", status: 400, message: "No expo-runtime-version header." };
  }
  if (!hasUpdateDir) {
    return { mode: "error", status: 404, message: "No updates for runtime version." };
  }
  if (hasRollback) {
    if (protocolVersion < 1) {
      return { mode: "error", status: 406, message: "Rollbacks require protocol version 1." };
    }
    if (currentUpdateId && embeddedUpdateId && currentUpdateId === embeddedUpdateId) {
      return { mode: "no-update", status: 204 };
    }
    return { mode: "rollback", status: 200, protocolVersion: 1 };
  }
  if (protocolVersion >= 1 && currentUpdateId && manifestId && currentUpdateId === manifestId) {
    return { mode: "no-update", status: 204 };
  }
  return { mode: "manifest", status: 200 };
}
