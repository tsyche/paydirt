import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApprovalFeedback } from "./ApprovalFeedback";

describe("approval feedback form", () => {
  it("keeps approval optional, labelled, bounded, and explicit about the payout", () => {
    const html = renderToStaticMarkup(createElement(ApprovalFeedback, {
      choreName: "Laundry", rewardLabel: "15 min. Screen-time grants cannot be undone.",
      onApprove: async () => {},
    }));
    expect(html).toContain("Approve with feedback");
    expect(html).toContain("Feedback for your child (optional)");
    expect(html).toContain('maxLength="500"');
    expect(html).toContain("Screen-time grants cannot be undone.");
    expect(html).toContain('type="button"');
    expect(html).toContain('type="submit"');
    expect(html).not.toContain('required=""');
  });
});
