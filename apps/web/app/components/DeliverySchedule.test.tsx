import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeliverySchedule } from "./DeliverySchedule";

describe("weekly delivery editor", () => {
  it("renders seven named day summaries and explicit delivery choices", () => {
    const html = renderToStaticMarkup(createElement(DeliverySchedule, {
      value: { grant_weekday_window: "15:00-20:00", grant_weekend_window: "", grant_day_windows: '{"3":"17:00-20:00","5":"none"}' },
      onChange: () => {},
    }));
    expect(html).toContain("Wednesday · 5:00 PM");
    expect(html).toContain("Friday · No delivery");
    expect(html).toContain("Sunday · All day");
    expect(html).toContain("Specific hours");
    expect(html.match(/class="settings-group"/g)).toHaveLength(8);
  });
  it("makes inheritance visible for kid schedules", () => {
    const html = renderToStaticMarkup(createElement(DeliverySchedule, {
      kid: true, value: { grant_weekday_window: "", grant_weekend_window: "", grant_day_windows: "" },
      onChange: () => {},
    }));
    expect(html).toContain("Monday · Use household");
    expect(html).toContain("Use default hours");
  });
});
