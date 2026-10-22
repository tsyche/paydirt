import { describe, expect, it } from "vitest";
import {
  assetHash,
  assetKey,
  buildServerManifest,
  decideManifestResponse,
  mimeForExt,
  sha256HexToUuid,
  updateIdFromMetadataJson,
} from "./updates";

const META = Buffer.from(JSON.stringify({ version: 0, fileMetadata: {} }));

describe("sha256HexToUuid", () => {
  it("maps a known digest to the 8-4-4-4-12 UUID form", () => {
    // sha256("test") — matches Expo's convertSHA256HashToUUID example shape
    const hex = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
    expect(sha256HexToUuid(hex)).toBe("9f86d081-884c-7d65-9a2f-eaa0c55ad015");
  });

  it("rejects non-sha256 input", () => {
    expect(() => sha256HexToUuid("deadbeef")).toThrow();
  });
});

describe("updateIdFromMetadataJson", () => {
  it("is stable for identical metadata bytes", () => {
    const a = updateIdFromMetadataJson(META);
    const b = updateIdFromMetadataJson(Buffer.from(META));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("changes when metadata changes", () => {
    const other = updateIdFromMetadataJson(Buffer.from(JSON.stringify({ version: 1 })));
    expect(other).not.toBe(updateIdFromMetadataJson(META));
  });
});

describe("assetKey / assetHash", () => {
  it("launch assets get a .bundle suffix on the md5 key", () => {
    const key = assetKey(Buffer.from("bundle-bytes"), { launch: true });
    expect(key).toMatch(/^[a-f0-9]{32}\.bundle$/);
  });

  it("static assets get their extension appended", () => {
    const key = assetKey(Buffer.from("png"), { ext: "png" });
    expect(key).toMatch(/^[a-f0-9]{32}\.png$/);
  });

  it("asset hashes are base64url without padding", () => {
    const h = assetHash(Buffer.from("test"));
    expect(h).not.toMatch(/[+/=]/);
    expect(h).toMatch(/^[A-Za-z0-9_-]+$/);
    // sha256("test") base64, URL-safe
    expect(h).toBe("n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg");
  });
});

describe("mimeForExt", () => {
  it("maps common Expo asset extensions", () => {
    expect(mimeForExt("png")).toBe("image/png");
    expect(mimeForExt("bundle")).toBe("application/javascript");
    expect(mimeForExt(null)).toBe("application/octet-stream");
  });
});

describe("buildServerManifest", () => {
  const launch = { content: Buffer.from("JS_BUNDLE"), launch: true, ext: "bundle" };
  const png = { content: Buffer.from("PNGDATA"), launch: false, ext: "png" };

  it("builds a wire-format manifest with derived keys", () => {
    const m = buildServerManifest({
      metadataBuffer: META,
      createdAt: "2026-10-21T00:00:00.000Z",
      runtimeVersion: "1.0.0",
      assetEntries: [png, launch],
    });
    expect(m.runtimeVersion).toBe("1.0.0");
    expect(m.launchAsset.key).toMatch(/\.bundle$/);
    expect(m.assets).toHaveLength(1);
    expect(m.assets[0]!.contentType).toBe("image/png");
    expect(m.assets[0]!.key).toMatch(/\.png$/);
    expect(m.id).toBe(updateIdFromMetadataJson(META));
  });

  it("requires a launch asset", () => {
    expect(() =>
      buildServerManifest({
        metadataBuffer: META,
        createdAt: "x",
        runtimeVersion: "1",
        assetEntries: [png],
      }),
    ).toThrow(/launch/);
  });
});

describe("decideManifestResponse", () => {
  const base = {
    protocolVersion: 0,
    platform: "android",
    runtimeVersion: "1.0.0",
    hasUpdateDir: true,
    hasRollback: false,
    currentUpdateId: "",
    embeddedUpdateId: "",
    manifestId: "aaa-bbb",
  };

  it("serves the manifest on protocol 0 even if ids match", () => {
    expect(decideManifestResponse({ ...base, currentUpdateId: "aaa-bbb" }).mode).toBe("manifest");
  });

  it("returns 204 no-update on protocol 1 when client is current", () => {
    const r = decideManifestResponse({
      ...base,
      protocolVersion: 1,
      currentUpdateId: "aaa-bbb",
    });
    expect(r.mode).toBe("no-update");
    expect(r.status).toBe(204);
  });

  it("rejects unsupported platform and missing runtime version", () => {
    expect(decideManifestResponse({ ...base, platform: "web" }).status).toBe(400);
    expect(decideManifestResponse({ ...base, runtimeVersion: "" }).status).toBe(400);
  });

  it("404s when no update dir exists for the runtime", () => {
    expect(decideManifestResponse({ ...base, hasUpdateDir: false }).status).toBe(404);
  });

  it("serves rollback only on protocol v1, and 204 when already on embedded", () => {
    const rb = { ...base, hasRollback: true };
    expect(decideManifestResponse({ ...rb, protocolVersion: 0 }).status).toBe(406);
    expect(decideManifestResponse({ ...rb, protocolVersion: 1 }).mode).toBe("rollback");
    expect(
      decideManifestResponse({
        ...rb,
        protocolVersion: 1,
        currentUpdateId: "emb",
        embeddedUpdateId: "emb",
      }).mode,
    ).toBe("no-update");
  });
});
