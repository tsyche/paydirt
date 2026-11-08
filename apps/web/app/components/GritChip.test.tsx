import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { GritChip } from "./GritChip";
it("uses the mobile cash symbol while preserving the balance control's accessible name", () => {
  const html = renderToStaticMarkup(createElement(GritChip, { household: null, kids: [] }));
  expect(html).toContain('data-icon="cash"');
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('aria-label="Grit: ');
  expect(html).not.toContain("🪙");
});
