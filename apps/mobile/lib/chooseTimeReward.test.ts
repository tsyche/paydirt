import { describe, expect, it, vi } from "vitest";
import type { Chore } from "@paydirt/shared";

const alert = vi.hoisted(() => vi.fn());
vi.mock("react-native", () => ({ Alert: { alert } }));
import { chooseTimeReward } from "./chooseTimeReward";

describe("submission-time earned-minute choice", () => {
  it.each(["bucks", "time", "both"])("always banks and never prompts for %s chores", async (pay_mode) => {
    expect(await chooseTimeReward({ pay_mode } as Chore)).toBe("bank");
    expect(await chooseTimeReward(undefined)).toBe("bank");
    expect(alert).not.toHaveBeenCalled();
  });
});
