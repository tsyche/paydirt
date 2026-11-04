import { describe, expect, it } from "vitest";
import { deliveryDays, deliverySummary, setDeliveryDay } from "./deliverySchedule";

describe("delivery schedule editing", () => {
  it("preserves unrelated days when adding and resetting an exception", () => {
    const initial = '{"3":"17:00-20:00"}';
    const next = setDeliveryDay(initial, 5, "none");
    expect(deliveryDays(next)).toEqual({ "3": "17:00-20:00", "5": "none" });
    expect(deliveryDays(setDeliveryDay(next, 3, ""))).toEqual({ "5": "none" });
  });
  it("names explicit modes and formats windows for the day summary", () => {
    expect(deliverySummary("none")).toBe("No delivery");
    expect(deliverySummary("all")).toBe("All day");
    expect(deliverySummary("", "Use household")).toBe("Use household");
    expect(deliverySummary("06:00-07:00,15:00-20:00")).toBe("6:00 AM – 7:00 AM, 3:00 PM – 8:00 PM");
  });
});
