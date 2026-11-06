import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  View: ({ children, accessibilityLabel }: { children: ReactNode; accessibilityLabel?: string }) =>
    createElement("div", { "aria-label": accessibilityLabel }, children),
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("react-native-paper", () => {
  const Container = ({ children }: { children: ReactNode }) => createElement("section", null, children);
  return {
    Card: Object.assign(Container, { Content: Container }),
    Text: ({ children }: { children: ReactNode }) => createElement("span", null, children),
    Icon: () => null,
    ProgressBar: ({ progress }: { progress: number }) => createElement("progress", { value: progress, max: 1 }),
    useTheme: () => ({ colors: {
      primary: "#2f7d4f", primaryContainer: "#d4eddb", onPrimaryContainer: "#123322",
      surface: "#fff", surfaceVariant: "#eee", onSurface: "#222", onSurfaceVariant: "#555",
      outlineVariant: "#ccc", secondaryContainer: "#dde", onSecondaryContainer: "#223",
    } }),
  };
});
import { MyBank } from "./MyBank";

const props = {
  balance: 100, currency: "Grit", goodsRate: 10, screenRate: 2, streak: 3,
  assignments: [{ id: "a", status: "completed", expand: { chore: { reward: 20, pay_mode: "bucks" } } }],
  goals: [{ id: "goal", name: "New bike", target: 150, achieved: false }],
  requests: [{ id: "spend", amount: 30, status: "pending" }],
  grants: [{ id: "grant", minutes: 30, grant_delivered_seconds: 900, grant_status: "queued" }],
} as ComponentProps<typeof MyBank>;
const render = (extra: Partial<typeof props> = {}) =>
  renderToStaticMarkup(createElement(MyBank, { ...props, ...extra })).replace(/<[^>]+>/g, " ");

describe("My Bank reward information", () => {
  it.each([false, true])("preserves available funds, estimates, conversions, and banked remainder (simple=%s)", (simple) => {
    const text = render({ simple });
    expect(text).toMatch(/70\s+Grit/);
    expect(text).toContain("$7.00");
    expect(text).toContain("35 min");
    expect(text).toMatch(/20\s+Grit/);
    expect(text).toContain("15 min banked");
    expect(text).toContain("New bike");
    expect(text).toContain("150");
  });
  it("does not invent a money conversion when the household has no money rate", () => {
    const text = render({ goodsRate: 0, goals: [] });
    expect(text).not.toContain("$");
    expect(text).toContain("No savings goal yet");
  });
});
