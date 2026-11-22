import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newestBackup } from "./restoreDrill";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe("pulled backup selection", () => {
  it("uses modification time across different archive prefixes and ignores non-files", async () => {
    const root = await mkdtemp(join(tmpdir(), "paydirt-backup-select-"));
    roots.push(root);
    await writeFile(join(root, "z-old.zip"), "old");
    await utimes(join(root, "z-old.zip"), 1, 1);
    await writeFile(join(root, "a-new.zip"), "new");
    await writeFile(join(root, "ignored.json"), "{}");
    await mkdir(join(root, "directory.zip"));
    expect(await newestBackup(root)).toBe(join(root, "a-new.zip"));
  });

  it("explains how to supply a backup when the directory is empty", async () => {
    const root = await mkdtemp(join(tmpdir(), "paydirt-backup-select-"));
    roots.push(root);
    await expect(newestBackup(root)).rejects.toThrow("just backup-pull");
    await expect(newestBackup(join(root, "missing"))).rejects.toThrow("just backup-pull");
  });
});
