import { describe, expect, it, vi } from "vitest";

vi.mock("expo-file-system", () => ({
  File: vi.fn(),
  Paths: { document: "/fake/doc/dir" },
}));

import { isAccessibilityServiceEnabled } from "./accessibility-service";
import { File } from "expo-file-system";

describe("isAccessibilityServiceEnabled", () => {
  it("returns true when flag file exists", () => {
    vi.mocked(File).mockImplementation(function () {
      return { exists: true } as InstanceType<typeof File>;
    });
    expect(isAccessibilityServiceEnabled()).toBe(true);
  });

  it("returns false when flag file does not exist", () => {
    vi.mocked(File).mockImplementation(function () {
      return { exists: false } as InstanceType<typeof File>;
    });
    expect(isAccessibilityServiceEnabled()).toBe(false);
  });
});
