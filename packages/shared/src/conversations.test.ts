import { expect, it } from "vitest";
import { conversationSource } from "./conversations";
it("only routes validated occurrence-specific conversation sources", () => {
  expect(conversationSource("assignments:abc123def456ghi:conversation")).toBe("abc123def456ghi");
  expect(conversationSource("assignments:abc123def456ghi")).toBe("abc123def456ghi");
  for (const source of [undefined, "assignments:../../private:conversation", "spend_requests:abc123def456ghi:conversation"]) expect(conversationSource(source)).toBeNull();
});
