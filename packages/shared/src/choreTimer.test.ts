import { expect, it } from "vitest";
import { timerEvidence } from "./choreTimer";

it("labels timer proof at submission time, including later reviews", () => {
  expect(timerEvidence({})).toBe("");
  expect(timerEvidence({ timer_minutes: 30 })).toBe("Timer not used");
  const started = { timer_minutes: 30, timer_started_at: "2026-11-21 12:00:00Z" };
  expect(timerEvidence({ ...started, completed_at: "2026-11-21 12:10:00Z" })).toBe("Timer incomplete");
  expect(timerEvidence({ ...started, completed_at: "2026-11-21 12:30:00Z" })).toBe("Timer completed");
  expect(timerEvidence({ ...started, completed_at: "invalid" })).toBe("Timer incomplete");
});
