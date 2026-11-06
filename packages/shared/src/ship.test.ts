import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repo = resolve(import.meta.dirname, "../../..");
const dump = JSON.parse(execFileSync("just", ["--dump", "--dump-format", "json"], { cwd: repo, encoding: "utf8" }));
const ship = dump.recipes.ship.body.map((line: string[]) => line.join("")).join("\n");
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function runShip(state: "tracked" | "untracked" | "clean", failStage = "") {
  const root = mkdtempSync(join(tmpdir(), "paydirt-ship-test-"));
  roots.push(root);
  mkdirSync(join(root, "bin"));
  mkdirSync(join(root, "scripts"));
  writeFileSync(join(root, "scripts/tablet-connect.sh"), "#!/usr/bin/env bash\nexit 0\n");
  const commands = {
    git: `#!/usr/bin/env bash
case "$1" in
  status) printf '%s\\n' "$SHIP_TEST_STATUS" ;;
  diff) [ "$SHIP_TEST_STATUS" != " M app.ts" ] ;;
esac
`,
    just: `#!/usr/bin/env bash
echo "$*" >> "$SHIP_TEST_CALLS"
if [ "$1" = "$SHIP_TEST_FAIL" ]; then exit 7; fi
`,
    adb: "#!/usr/bin/env bash\necho 'List of devices attached'\n",
  };
  for (const [name, text] of Object.entries(commands)) {
    writeFileSync(join(root, "bin", name), text);
    chmodSync(join(root, "bin", name), 0o755);
  }
  const result = spawnSync("bash", ["-c", ship], {
    cwd: root, encoding: "utf8", env: {
      ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}`,
      SHIP_TEST_STATUS: state === "tracked" ? " M app.ts" : state === "untracked" ? "?? new.ts" : "",
      SHIP_TEST_FAIL: failStage, SHIP_TEST_CALLS: join(root, "calls"),
    },
  });
  return { ...result, calls: () => readFileSync(join(root, "calls"), "utf8").trim().split("\n") };
}

describe("ship with uncommitted work", () => {
  it.each(["tracked", "untracked"] as const)("warns and continues with %s files", (state) => {
    const result = runShip(state);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Uncommitted changes");
    expect(result.stdout).toContain("continuing");
    expect(result.calls()).toEqual(["update-service", "release-apk"]);
  });
  it("does not warn for a clean tree", () => {
    const result = runShip("clean");
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("Uncommitted changes");
  });
  it.each(["update-service", "release-apk"])("still stops when %s fails", (stage) => {
    const result = runShip("tracked", stage);
    expect(result.status).toBe(7);
    expect(result.calls()).toEqual(stage === "update-service" ? ["update-service"] : ["update-service", "release-apk"]);
  });
});
