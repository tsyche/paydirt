import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  ScrollView: ({ children }: { children: ReactNode }) => createElement("main", null, children),
}));
vi.mock("react-native-paper", () => {
  const Container = ({ children }: { children: ReactNode }) => createElement("section", null, children);
  const Dialog = Object.assign(Container, { Title: Container, Actions: Container, ScrollArea: Container });
  return {
    Portal: Container, Dialog,
    Button: ({ children, disabled }: { children: ReactNode; disabled?: boolean }) => createElement("button", { disabled }, children),
    HelperText: ({ children, visible }: { children: ReactNode; visible: boolean }) => visible ? createElement("p", { role: "alert" }, children) : null,
  };
});
import { ChoreCreateDialog } from "./ChoreCreateDialog";

const props = {
  visible: true, title: "Review chore idea", actionLabel: "Create and approve",
  busy: false, canCreate: true, error: "", onCancel: () => {}, onCreate: () => {},
  children: createElement("input", { defaultValue: "Wash the car" }),
};

describe("suggested chore review dialog", () => {
  it("shows the editable suggestion and pinned save/cancel controls", () => {
    const html = renderToStaticMarkup(createElement(ChoreCreateDialog, props));
    expect(html).toContain("Review chore idea");
    expect(html).toContain("Wash the car");
    expect(html.indexOf("Cancel")).toBeLessThan(html.indexOf("<main>"));
    expect(html.indexOf("Create and approve")).toBeLessThan(html.indexOf("<main>"));
  });
  it("keeps submit errors visible and prevents another save while busy", () => {
    const html = renderToStaticMarkup(createElement(ChoreCreateDialog, { ...props, busy: true, error: "Set a reward above 0." }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Set a reward above 0.");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  it("does not render a cancelled dialog", () => {
    expect(renderToStaticMarkup(createElement(ChoreCreateDialog, { ...props, visible: false }))).toBe("");
  });
  it("mounts the composer outside tab conditions, so Approvals can open it", () => {
    const text = readFileSync(new URL("../screens/ParentHome.tsx", import.meta.url), "utf8");
    const file = ts.createSourceFile("ParentHome.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let found = false;
    function visit(node: ts.Node, gated: boolean) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === "ChoreCreateDialog") {
        found = true;
        expect(gated).toBe(false);
      }
      const tabGate = ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        /\btab\s*===/.test(node.left.getText(file));
      ts.forEachChild(node, (child) => visit(child, gated || tabGate));
    }
    visit(file, false);
    expect(found).toBe(true);
  });
});
