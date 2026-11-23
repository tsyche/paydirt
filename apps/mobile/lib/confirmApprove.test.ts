import { beforeEach, describe, expect, it, vi } from "vitest";

type Button = { text: string; onPress?: () => void };
const dialog = vi.hoisted(() => ({
  calls: [] as { message: string; buttons: Button[] }[],
  tap: "" as string,
}));
vi.mock("react-native", () => ({
  Alert: {
    alert: (_title: string, message: string, buttons: Button[]) => {
      dialog.calls.push({ message, buttons });
      buttons.find((b) => b.text === dialog.tap)?.onPress?.();
    },
  },
}));
import { confirmApprove } from "./confirmApprove";

const timeChore = { name: "Tidy", pay_mode: "time", reward_minutes: 30 } as const;
const bucksChore = { name: "Feed dog", pay_mode: "bucks", reward: 5 } as const;

describe("confirmApprove", () => {
  beforeEach(() => { dialog.calls.length = 0; dialog.tap = ""; });

  it("skips the dialog when nothing pays screen time", async () => {
    expect(await confirmApprove([{ chore: bucksChore }])).toBe(true);
    expect(dialog.calls).toHaveLength(0);
  });

  it("names the minutes and Bank choice, and resolves false on Cancel", async () => {
    dialog.tap = "Cancel";
    expect(await confirmApprove([{ chore: timeChore, kidName: "Margot", timeChoice: "bank" }])).toBe(false);
    expect(dialog.calls[0].message).toContain("Margot: 30 min (Tidy) — Bank");
  });

  it("resolves true only after Approve is tapped", async () => {
    dialog.tap = "Approve";
    expect(await confirmApprove([{ chore: timeChore, timeChoice: "use" }])).toBe(true);
    expect(dialog.calls[0].message).toContain("Use now");
  });
});
