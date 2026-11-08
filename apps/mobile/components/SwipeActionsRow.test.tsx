import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ handlers: {} as Record<string, (_: unknown, g: { dx: number; dy: number }) => unknown> }));
vi.mock("react-native", () => {
  const View = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  return { View, Animated: { View, Value: class { setValue() {} }, spring: () => ({ start() {} }) }, PanResponder: { create: (handlers: typeof boundary.handlers) => { boundary.handlers = handlers; return { panHandlers: {} }; } } };
});
vi.mock("react-native-paper", () => ({ Text: ({ children }: { children: ReactNode }) => createElement("span", null, children), useTheme: () => ({ colors: { secondaryContainer: "white", surface: "white" } }) }));
import { SwipeActionsRow } from "./SwipeActionsRow";
beforeEach(() => { boundary.handlers = {}; });
const gesture = (dx: number, dy = 0) => ({ dx, dy });
it.each([-90, 90])("dispatches the correct directional action for dx=%s", (dx) => {
  const archive = vi.fn(), edit = vi.fn();
  renderToStaticMarkup(createElement(SwipeActionsRow, { children: "Chore", onArchive: archive, onEdit: edit }));
  expect(boundary.handlers.onMoveShouldSetPanResponder!(null, gesture(dx))).toBe(true);
  boundary.handlers.onPanResponderRelease!(null, gesture(dx));
  expect(archive).toHaveBeenCalledTimes(dx < 0 ? 1 : 0);
  expect(edit).toHaveBeenCalledTimes(dx > 0 ? 1 : 0);
});
it("does not hijack a right swipe or archive when editing is unavailable", () => {
  const archive = vi.fn();
  renderToStaticMarkup(createElement(SwipeActionsRow, { children: "History", onArchive: archive }));
  expect(boundary.handlers.onMoveShouldSetPanResponder!(null, gesture(90))).toBe(false);
  boundary.handlers.onPanResponderRelease!(null, gesture(90));
  expect(archive).not.toHaveBeenCalled();
});
it.each([{ dx: -90, dy: 100, disabled: false }, { dx: -40, dy: 0, disabled: false }, { dx: -90, dy: 0, disabled: true }])("ignores vertical/short/busy gestures: %o", ({ dx, dy, disabled }) => {
  const archive = vi.fn(), edit = vi.fn();
  renderToStaticMarkup(createElement(SwipeActionsRow, { children: "Chore", onArchive: archive, onEdit: edit, disabled }));
  boundary.handlers.onPanResponderRelease!(null, gesture(dx, dy));
  expect(archive).not.toHaveBeenCalled(); expect(edit).not.toHaveBeenCalled();
});
