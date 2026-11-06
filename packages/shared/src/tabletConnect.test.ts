import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("tablet connection recovery", () => {
  it("treats offline devices as a normal result and tries fixed ports once", () => {
    const root = mkdtempSync(join(tmpdir(), "paydirt-adb-test-"));
    roots.push(root);
    writeFileSync(join(root, "adb"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$TABLET_TEST_LOG"
if [ "$1" = "connect" ]; then echo "failed to connect to $2"; exit 1; fi
`);
    chmodSync(join(root, "adb"), 0o755);
    const result = spawnSync("bash", [
      new URL("../../../scripts/tablet-connect.sh", import.meta.url).pathname,
    ], {
      encoding: "utf8",
      env: {
        ...process.env, PATH: `${root}:${process.env.PATH}`,
        DEPLOY_DEVICES: "192.168.20.164:5555 192.168.10.133:5555",
        TABLET_TEST_LOG: join(root, "calls"),
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("0 ready, 2 unavailable");
    expect(readFileSync(join(root, "calls"), "utf8").split("\n").filter((call) => call.startsWith("connect ")))
      .toEqual(["connect 192.168.20.164:5555", "connect 192.168.10.133:5555"]);
  });

  it.each(["_adb-tls-connect._tcp", "_adb._tcp."])("recovers a discovered %s endpoint and pins port 5555", (service) => {
    const root = mkdtempSync(join(tmpdir(), "paydirt-adb-test-"));
    roots.push(root);
    // ADB is the device/network boundary; execute the real connection script.
    writeFileSync(join(root, "adb"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$TABLET_TEST_LOG"
case "$1" in
  devices)
    echo "List of devices attached"
    if [ -f "$TABLET_TEST_STATE" ]; then printf '%s\\tdevice\\n' "$(cat "$TABLET_TEST_STATE")"; fi ;;
  mdns)
    echo "List of discovered mdns services"
    echo "pairing _adb-tls-pairing._tcp 192.168.20.164:39999"
    echo "tablet $TABLET_TEST_SERVICE 192.168.20.164:37123" ;;
  connect)
    if [ "$2" = "192.168.20.164:37123" ] || [ -f "$TABLET_TEST_PINNED" ]; then
      echo "$2" > "$TABLET_TEST_STATE"
      echo "connected to $2"
    else echo "failed to connect to $2"; exit 1; fi ;;
  -s)
    if [ "$2" = "192.168.20.164:37123" ] && [ "$3" = "tcpip" ]; then
      touch "$TABLET_TEST_PINNED"
    else exit 1; fi ;;
  disconnect) rm -f "$TABLET_TEST_STATE" ;;
esac
`);
    writeFileSync(join(root, "sleep"), "#!/usr/bin/env bash\nexit 0\n");
    chmodSync(join(root, "adb"), 0o755);
    chmodSync(join(root, "sleep"), 0o755);
    const output = execFileSync("bash", [
      new URL("../../../scripts/tablet-connect.sh", import.meta.url).pathname,
    ], {
      encoding: "utf8",
      env: {
        ...process.env, PATH: `${root}:${process.env.PATH}`, DEPLOY_DEVICES: "192.168.20.164:5555",
        TABLET_TEST_LOG: join(root, "calls"), TABLET_TEST_STATE: join(root, "state"),
        TABLET_TEST_PINNED: join(root, "pinned"), TABLET_TEST_SERVICE: service,
      },
    });
    expect(output).toContain("connected to 192.168.20.164:5555");
    expect(readFileSync(join(root, "state"), "utf8").trim()).toBe("192.168.20.164:5555");
    const calls = readFileSync(join(root, "calls"), "utf8");
    expect(calls).toContain("connect 192.168.20.164:37123");
    expect(calls).not.toContain("connect 192.168.20.164:39999");
  });
});
