import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResubmissionInfo } from "./ResubmissionInfo";
import { PartialCredit } from "./PartialCredit";
import type { Chore } from "@paydirt/shared";

describe("approval card controls", () => {
  it("distinguishes previous feedback from the child's reply and escapes both", () => {
    const html = renderToStaticMarkup(createElement(ResubmissionInfo, {
      previousFeedback: "<script>Redo the corners</script>", childReply: "I cleaned them again.",
    }));
    expect(html).toContain("Resubmitted");
    expect(html).toContain("Your previous feedback");
    expect(html).toContain("Child’s reply");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("I cleaned them again.");
  });
  it("keeps the partial-credit reward preview and percentage choices behind an identifiable control", () => {
    const html = renderToStaticMarkup(createElement(PartialCredit, {
      chore: { reward: 20, pay_mode: "bucks" } as Chore, currency: "Grit", onApprove: () => {},
    }));
    expect(html).toContain('class="percent-icon"');
    expect(html).toContain("Partial credit");
    expect(html).toContain("Credit percent");
    expect(html).toContain("10 Grit + 0 min");
    expect(html).toContain("Closes the chore; no remainder owed.");
  });
});
