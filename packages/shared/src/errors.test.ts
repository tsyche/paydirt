import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

const pbError = (status: number, response: object) => Object.assign(new Error("raw"), { status, response });

describe("errorMessage", () => {
  it("uses the server message from a PocketBase error", () => {
    expect(errorMessage(pbError(400, { message: "Insufficient balance to approve this spend request." }))).toBe(
      "Insufficient balance to approve this spend request.",
    );
  });

  it("prefers a field error over the generic message", () => {
    expect(
      errorMessage(pbError(400, { message: "Failed to update record.", data: { avatar: { message: "File too big." } } })),
    ).toBe("File too big.");
  });

  it("explains a dead connection", () => {
    expect(errorMessage(pbError(0, {}))).toMatch(/reach the server/);
  });

  it("falls back for 403/404 without a message", () => {
    expect(errorMessage(pbError(403, {}))).toMatch(/not allowed/);
    expect(errorMessage(pbError(404, {}))).toMatch(/no longer exists/);
  });

  it("handles plain errors, strings, and unknowns", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("nope")).toBe("nope");
    expect(errorMessage(undefined)).toBe("Something went wrong. Try again.");
  });
});
