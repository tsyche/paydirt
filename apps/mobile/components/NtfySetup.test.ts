import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("notification setup dialog structure", () => {
  it("gives Paper concrete dialog children that can receive its layout styles", () => {
    const source = readFileSync(new URL("./NtfySetup.tsx", import.meta.url), "utf8");
    const file = ts.createSourceFile("NtfySetup.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let dialogs = 0;
    function visit(node: ts.Node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === "Dialog") {
        dialogs++;
        const children = node.children.filter((child) => !ts.isJsxText(child) || child.text.trim());
        // Paper clones these children with `style`; Fragment cannot receive it.
        expect(children.every((child) => ts.isJsxElement(child) &&
          child.openingElement.tagName.getText(file).startsWith("Dialog."))).toBe(true);
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
    expect(dialogs).toBeGreaterThan(0);
  });
});
