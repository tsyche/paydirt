import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  AndroidImportance: { HIGH: 4, LOW: 2 },
}));
import * as Notifications from "expo-notifications";
import { setupNotificationChannels } from "./notifications";

describe("Android notification channel setup", () => {
  it("uses the system alert sound without looking for a bundled file called default", async () => {
    await setupNotificationChannels();
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith("paydirt-alerts", {
      name: "PayDirt Alerts", importance: 4,
      vibrationPattern: [0, 250, 250, 250], lightColor: "#2f7d4f",
    });
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith("paydirt-service", {
      name: "PayDirt Background", importance: 2, showBadge: false,
    });
  });
});
