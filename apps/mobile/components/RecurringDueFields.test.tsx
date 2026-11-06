import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  Pressable: ({ children }: { children: ReactNode }) => createElement("button", null, children),
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("@react-native-community/datetimepicker", () => ({ DateTimePickerAndroid: { open: vi.fn() } }));
vi.mock("react-native-paper", () => ({
  Text: ({ children }: { children: ReactNode }) => createElement("span", null, children),
  TextInput: ({ label }: { label: string }) => createElement("input", { "aria-label": label }),
  Button: ({ children }: { children: ReactNode }) => createElement("button", null, children),
}));
import { RecurringDueFields } from "./RecurringDueFields";
it("describes recurring deadlines in household time on the parent mobile form", () => {
  const html = renderToStaticMarkup(createElement(RecurringDueFields, { cadence: "weekly", time: "20:00", day: "2", onTime: () => {}, onDay: () => {} }));
  expect(html).toContain("household time");
  expect(html).not.toContain("server-local");
});
