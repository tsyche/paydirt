import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Exercise the real recipe with fake tools: never connect, build, or install.
function runRecipe(devices: string, connectStatus: number, installStatus = 0, recipeName = "push-remote") {
  const directory = mkdtempSync(join(tmpdir(), "paydirt-push-test-"));
  try {
    const tools: Record<string, string> = {
      bash: `exit ${connectStatus}`,
      adb: `if [ "$1" = devices ]; then printf '%s\\n' "$TEST_DEVICES"; else exit ${installStatus}; fi`,
      just: `printf 'BUILD_CALLED %s\\n' "$*"`,
      git: `exit 0`,
    };
    for (const [name, body] of Object.entries(tools)) {
      const file = join(directory, name);
      writeFileSync(file, `#!/bin/sh\n${body}\n`);
      chmodSync(file, 0o700);
    }
    const source = readFileSync(new URL("../../../justfile", import.meta.url), "utf8");
    const section = source.split(`\n${recipeName}:\n`)[1];
    if (!section) throw new Error("Missing push-remote recipe");
    const recipe = section.split(/\n# /)[0]!;
    return spawnSync("/bin/bash", ["-c", recipe], {
      encoding: "utf8",
      cwd: directory,
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, TEST_DEVICES: devices },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("push-remote recipe", () => {
  it.each([0, 1])("skips without building when no device is reachable (connect status %s)", (connectStatus) => {
    const result = runRecipe("List of devices attached", connectStatus);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("skipping direct APK install");
    expect(result.stdout).not.toContain("BUILD_CALLED");
  });

  it("ignores emulators and offline physical devices", () => {
    const result = runRecipe("emulator-5554 device\n192.0.2.1:5555 offline", 0);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("BUILD_CALLED");
  });

  it("still fails when installation on a connected physical device fails", () => {
    const result = runRecipe("192.0.2.1:5555 device", 0, 1);
    expect(result.stdout).toContain("BUILD_CALLED");
    expect(result.status).not.toBe(0);
  });
});

describe("ship recipe", () => {
  it("updates the server and publishes the APK even when no devices connect", () => {
    const result = runRecipe("List of devices attached", 1, 0, "ship");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("BUILD_CALLED update-service");
    expect(result.stdout).toContain("BUILD_CALLED release-apk");
    expect(result.stdout).toContain("No APKs installed directly");
  });
});
