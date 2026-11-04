import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("test-all credential isolation", () => {
  it("overrides inherited credentials before bootstrapping its fixtures", () => {
    const justfile = readFileSync(new URL("../../../justfile", import.meta.url), "utf8");
    const recipe = justfile.split("\ntest-all:\n")[1];
    if (!recipe) throw new Error("Missing test-all recipe");
    // Execute only initialization, before temp files, processes, or API calls.
    const initialization = recipe.slice(0, recipe.indexOf("    EDIR="));
    const output = execFileSync("bash", ["-c", `${initialization}
      printf '%s\\n' "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" "$SEED_PASSWORD"
    `], {
      encoding: "utf8",
      env: {
        ...process.env,
        PB_ADMIN_EMAIL: "different@example.invalid",
        PB_ADMIN_PASSWORD: "unrelated-admin-password",
        SEED_PASSWORD: "unrelated-user-password",
      },
    });
    expect(output.trim().split("\n")).toEqual([
      "admin@paydirt.local", "password123", "password123",
    ]);
  });
});
