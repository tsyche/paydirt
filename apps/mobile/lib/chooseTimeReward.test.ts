import { describe, expect, it, vi } from "vitest";
import type { Chore } from "@paydirt/shared";

const alert = vi.hoisted(() => vi.fn());
vi.mock("react-native", () => ({ Alert: { alert } }));
import { chooseTimeReward } from "./chooseTimeReward";

describe("submission-time earned-minute choice", () => {
  it("skips the picker for Grit-only chores", async () => {
    expect(await chooseTimeReward({ pay_mode: "bucks" } as Chore)).toBe("bank");
    expect(alert).not.toHaveBeenCalled();
  });
  it.each(["time", "both"])("offers Bank, Use now, and cancellation for %s chores", async (pay_mode) => {
    for (const [label, expected] of [["Bank", "bank"], ["Use now", "use"], ["Cancel", null]]) {
      const result = chooseTimeReward({ pay_mode } as Chore);
      const [, message, buttons] = alert.mock.lastCall!;
      expect(message).toContain("15-minute blocks");
      expect(message).toContain("next allowed window");
      buttons.find((b: { text: string }) => b.text === label).onPress();
      expect(await result).toBe(expected);
    }
  });
});
