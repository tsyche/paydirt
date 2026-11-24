import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const memoryLow = (text: string) => text.match(/^MemoryLow=(\S+)$/m)?.[1];

describe("PayDirt memory protection on the host", () => {
  const unit = read("pocketbase/paydirt.service");
  const slice = read("pocketbase/system.slice-paydirt-memory.conf");
  const hostApply = read("scripts/host-apply.sh");

  it("sets MemoryLow on the unit and an equal value on system.slice", () => {
    // A service's memory.low is capped by its parent's; system.slice defaults to 0.
    expect(memoryLow(unit)).toBe("256M");
    expect(slice).toMatch(/^\[Slice\]$/m);
    expect(memoryLow(slice)).toBe(memoryLow(unit));
  });

  it("stages and installs the slice drop-in before daemon-reload", () => {
    expect(read("scripts/update-service.sh")).toContain('"$repo_dir/pocketbase/system.slice-paydirt-memory.conf"');
    const install = hostApply.indexOf(
      "system.slice-paydirt-memory.conf /etc/systemd/system/system.slice.d/50-paydirt-memory.conf",
    );
    expect(install).toBeGreaterThan(-1);
    expect(install).toBeLessThan(hostApply.indexOf("sudo systemctl daemon-reload"));
  });
});
