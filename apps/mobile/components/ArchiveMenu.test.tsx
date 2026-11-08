import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ archive: undefined as undefined | (() => void), open: undefined as undefined | (() => void) }));
vi.mock("react-native-paper", () => ({
  IconButton: ({ icon, accessibilityLabel, disabled, onPress }: { icon: string; accessibilityLabel: string; disabled: boolean; onPress: () => void }) => {
    boundary.open = onPress;
    return createElement("button", { "aria-label": accessibilityLabel, disabled, "data-icon": icon });
  },
  Menu: Object.assign(({ anchor, children }: { anchor: ReactNode; children: ReactNode }) => createElement("div", null, anchor, children), {
    Item: ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled: boolean }) => {
      boundary.archive = onPress;
      return createElement("button", { disabled, "data-in-menu": true }, title);
    },
  }),
}));
import { ArchiveMenu } from "./ArchiveMenu";
beforeEach(() => { boundary.archive = undefined; boundary.open = undefined; });
it("shows more actions rather than an archive icon, with Archive available inside the menu", () => {
  const archive = vi.fn();
  const html = renderToStaticMarkup(createElement(ArchiveMenu, { label: "A completed chore", disabled: false, onArchive: archive }));
  expect(html).toContain('aria-label="More actions for A completed chore"');
  expect(html).toContain('data-icon="dots-vertical"');
  expect(html).not.toContain('data-icon="archive-outline"');
  expect(html).toContain('data-in-menu="true"');
  expect(archive).not.toHaveBeenCalled();
  boundary.open!(); expect(archive).not.toHaveBeenCalled();
  boundary.archive!(); expect(archive).toHaveBeenCalledOnce();
});
it("disables both the overflow and Archive action during a request", () => {
  const html = renderToStaticMarkup(createElement(ArchiveMenu, { label: "Alert", disabled: true, onArchive: vi.fn() }));
  expect(html.match(/disabled=""/g)).toHaveLength(2);
});
