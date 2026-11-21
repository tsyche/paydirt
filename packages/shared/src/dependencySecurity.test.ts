import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repo = resolve(import.meta.dirname, "../../..");
const require = createRequire(resolve(repo, "package.json"));
const forge = require("node-forge") as { ed25519: {
  generateKeyPair(options: { seed: Buffer }): { publicKey: Buffer; privateKey: Buffer };
  sign(options: { message: string; encoding: string; privateKey: Buffer }): Buffer;
  verify(options: { message: string; encoding: string; publicKey: Buffer; signature: Buffer }): boolean;
} };

describe("toolchain dependency security", () => {
  it("rejects forged Ed25519 signatures under an identity key while accepting a real signature", () => {
    // GHSA-6889-vf6x-f3g5: no private key is needed for this forged signature.
    const identity = Buffer.alloc(32);
    identity[0] = 1;
    const signature = Buffer.alloc(64);
    signature[0] = 1;
    expect(forge.ed25519.verify({ message: "admin=true", encoding: "utf8", publicKey: identity, signature })).toBe(false);
    const key = forge.ed25519.generateKeyPair({ seed: Buffer.alloc(32, 7) });
    const signed = forge.ed25519.sign({ message: "valid", encoding: "utf8", privateKey: key.privateKey });
    expect(forge.ed25519.verify({ message: "valid", encoding: "utf8", publicKey: key.publicKey, signature: signed })).toBe(true);
  });

  it("bounds optimized glob preprocessing for repeated globstar/parent segments", () => {
    // Isolate CPU/memory amplification from the test runner (GHSA-g3hv-75wg-m249).
    const result = spawnSync(process.execPath, ["--max-old-space-size=128", "-e", `
      const { Minimatch } = require("minimatch");
      const normal = new Minimatch("**/*.ts", { optimizationLevel: 2 });
      if (!normal.match("src/file.ts") || normal.match("src/file.js")) process.exit(1);
      try {
        new Minimatch(("**/../a/b/").repeat(14) + "target", { optimizationLevel: 2, braceExpandMax: 32 });
        process.exit(1);
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
      }
    `], { cwd: repo, timeout: 2000, maxBuffer: 32_768, encoding: "utf8" });
    expect(result.error?.message ?? result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
