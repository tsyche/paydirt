import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ width: 900, deviceType: 2, actions: new Map<string, () => void>(), alert: vi.fn() }));
vi.mock("expo-device", () => ({ get deviceType() { return boundary.deviceType; }, DeviceType: { TABLET: 2 } }));
vi.mock("react-native", () => ({
  useWindowDimensions: () => ({ width: boundary.width }),
  Alert: { alert: boundary.alert },
  View: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));
vi.mock("react-native-paper", () => ({
  Appbar: { Action: ({ accessibilityLabel, onPress }: { accessibilityLabel: string; onPress: () => void }) => {
    boundary.actions.set(accessibilityLabel, onPress);
    return createElement("button", null, accessibilityLabel);
  } },
  Badge: () => createElement("span", null, "Unread"),
  Menu: Object.assign(({ anchor }: { anchor: ReactNode }) => anchor, { Item: () => null }),
}));
import { HeaderNavigation } from "./HeaderNavigation";
const props = () => ({ unread: false, onInbox: vi.fn(), onTheme: vi.fn(), onLogout: vi.fn(), onSettings: vi.fn() });
beforeEach(() => { boundary.width = 900; boundary.deviceType = 2; boundary.actions.clear(); boundary.alert.mockClear(); });
describe("responsive header navigation", () => {
  it.each([[1, 900], [2, 767], [0, 1200]])("keeps overflow for device %s at width %s", (device, width) => {
    boundary.deviceType = device; boundary.width = width;
    const html = renderToStaticMarkup(createElement(HeaderNavigation, props()));
    expect(html).toContain("Menu");
    expect(boundary.actions.has("Sign out")).toBe(false);
  });
  it("orders tablet actions, preserves unread feedback, and dispatches navigation", () => {
    boundary.width = 768;
    const handlers = props();
    renderToStaticMarkup(createElement(HeaderNavigation, { ...handlers, unread: true }));
    expect([...boundary.actions.keys()]).toEqual(["Alerts, new alerts", "Theme and colors", "Household settings", "Sign out"]);
    boundary.actions.get("Alerts, new alerts")!();
    boundary.actions.get("Theme and colors")!();
    boundary.actions.get("Household settings")!();
    expect(handlers.onInbox).toHaveBeenCalledOnce();
    expect(handlers.onTheme).toHaveBeenCalledOnce();
    expect(handlers.onSettings).toHaveBeenCalledOnce();
    boundary.actions.get("Sign out")!();
    expect(handlers.onLogout).not.toHaveBeenCalled();
    const buttons = boundary.alert.mock.calls[0]![2];
    expect(buttons[0].style).toBe("cancel");
    buttons[1].onPress();
    expect(handlers.onLogout).toHaveBeenCalledOnce();
  });
  it("does not expose parent settings to a kid", () => {
    renderToStaticMarkup(createElement(HeaderNavigation, { ...props(), onSettings: undefined }));
    expect(boundary.actions.has("Household settings")).toBe(false);
  });
});
