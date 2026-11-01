import { describe, expect, it } from "vitest";
import { REPLY_OPTIONS, replyLabel } from "./broadcastReply";

describe("broadcast replies", () => {
  it("labels known codes with emoji and passes unknown ones through", () => {
    expect(replyLabel("ok")).toBe("👍 OK");
    expect(replyLabel("later")).toBe("⏰ Later");
    expect(replyLabel("mystery")).toBe("mystery");
  });
  it("has unique codes", () => {
    expect(new Set(REPLY_OPTIONS.map((o) => o.code)).size).toBe(REPLY_OPTIONS.length);
  });
});
