import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("react-native-paper", () => ({
  Button: ({ children, disabled }: { children: ReactNode; disabled: boolean }) => createElement("button", { disabled }, children),
}));
import { HelpRequestButton } from "./HelpRequestButton";

describe("help request control", () => {
  it.each([false, true])("offers the next available action when requested=%s", (requested) => {
    const html = renderToStaticMarkup(createElement(HelpRequestButton, { requested, onChange: async () => {} }));
    expect(html).toContain(requested ? "Cancel help request" : "I need help");
    expect(html).not.toContain('disabled=""');
  });
});
