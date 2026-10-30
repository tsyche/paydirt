import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

import {
  buildSubscribeLink,
  buildTestUrl,
  ensureTopic,
} from "./ntfy-onboarding";

describe("buildSubscribeLink", () => {
  it("builds an https ntfy:// deep link that auto-subscribes in the ntfy app", () => {
    expect(buildSubscribeLink("https://ntfy.sh", "paydirt-parent1")).toBe(
      "ntfy://ntfy.sh/paydirt-parent1?display=PayDirt",
    );
  });

  it("adds secure=false for plain-http servers and strips trailing slashes", () => {
    expect(buildSubscribeLink("http://ntfy.home.lan/", "topic-a")).toBe(
      "ntfy://ntfy.home.lan/topic-a?display=PayDirt&secure=false",
    );
  });

  it("URL-encodes the topic", () => {
    expect(buildSubscribeLink("https://ntfy.sh", "a b/c")).toContain("a%20b%2Fc");
  });
});

describe("buildTestUrl", () => {
  it("posts to endpoint/topic without double slashes", () => {
    expect(buildTestUrl("https://ntfy.sh/", "paydirt-parent1")).toBe(
      "https://ntfy.sh/paydirt-parent1",
    );
  });
});

describe("ensureTopic", () => {
  it("keeps an existing topic (trimmed)", () => {
    expect(ensureTopic("  paydirt-parent1 \n")).toBe("paydirt-parent1");
  });

  it("generates a paydirt-prefixed topic when missing, and each call differs", () => {
    const a = ensureTopic("");
    const b = ensureTopic(undefined);
    expect(a).toMatch(/^paydirt-.{20,}$/);
    expect(b).toMatch(/^paydirt-.{20,}$/);
    expect(a).not.toBe(b);
  });
});
