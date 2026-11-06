import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecurringDueFields } from "./RecurringDueFields";
it("describes recurring deadlines in household time on the parent web form", () => {
  const html = renderToStaticMarkup(createElement(RecurringDueFields, { cadence: "weekly", time: "20:00", day: 2, onTime: () => {}, onDay: () => {} }));
  expect(html).toContain("household time");
  expect(html).not.toContain("server-local");
});
describe("recurring deadline day controls", () => {
  it.each(["daily", "weekly", "monthly"])("shows only the applicable %s day selector", (cadence) => {
    const html = renderToStaticMarkup(createElement(RecurringDueFields, { cadence, time: "20:00", day: 2, onTime: () => {}, onDay: () => {} }));
    expect(html.includes("Due weekday")).toBe(cadence === "weekly");
    expect(html.includes("Due day of month")).toBe(cadence === "monthly");
  });
});
