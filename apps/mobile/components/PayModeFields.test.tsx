import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mock native UI primitives, not our form or business validation.
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("react-native-paper", () => ({
  useTheme: () => ({ colors: { onSurfaceVariant: "#666" } }),
  Text: ({ children }: { children: ReactNode }) => createElement("span", null, children),
  SegmentedButtons: () => null,
  TextInput: ({ label, error }: { label: string; error?: boolean }) => createElement("input", { "aria-label": label, "aria-invalid": !!error }),
  HelperText: ({ children, visible, type }: { children: ReactNode; visible?: boolean; type: string }) =>
    visible === false ? null : createElement("p", { role: type === "error" ? "alert" : undefined }, children),
}));
import { PayModeFields } from "./PayModeFields";

function render(minutes: string) {
  return renderToStaticMarkup(createElement(PayModeFields, {
    mode: "time", reward: "10", minutes, currencyName: "Grit",
    onMode: () => {}, onReward: () => {}, onMinutes: () => {},
  }));
}
describe("mobile bonus minute feedback", () => {
  it("shows a persistent error when two minutes is entered", () => {
    const html = render("2");
    expect(html).toContain('role="alert"');
    expect(html).toContain("at least 5 minutes");
    expect(html).toContain('aria-invalid="true"');
  });
  it("explains five-minute steps for seven minutes", () => {
    expect(render("7")).toContain("steps of 5");
  });
  it("shows the minimum before entry and clears the error for five minutes", () => {
    expect(render("")).toContain("Minimum 5 minutes");
    expect(render("5")).not.toContain('role="alert"');
  });
});
