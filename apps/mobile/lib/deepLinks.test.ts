import { describe, expect, it } from "vitest";

import { parseNotificationType, tabForNotificationType } from "./deepLinks";

describe("parseNotificationType", () => {
  it("extracts type from a paydirt notification deep link", () => {
    expect(parseNotificationType("paydirt://notification?type=spend_approved")).toBe(
      "spend_approved",
    );
  });

  it("returns null for a plain cold start (no url)", () => {
    expect(parseNotificationType(null)).toBeNull();
    expect(parseNotificationType(undefined)).toBeNull();
  });

  it("returns null for a link with no query string", () => {
    expect(parseNotificationType("paydirt://notification")).toBeNull();
  });

  it("returns null for a link with a query string but no type param", () => {
    expect(parseNotificationType("paydirt://notification?foo=bar")).toBeNull();
  });

  it("returns null for a link with an empty type value", () => {
    expect(parseNotificationType("paydirt://notification?type=")).toBeNull();
  });

  it("returns null for a url from a different scheme/host", () => {
    expect(parseNotificationType("https://example.com?type=spend_approved")).toBeNull();
    expect(parseNotificationType("paydirt://other?type=spend_approved")).toBeNull();
  });

  it("decodes URI-encoded type values", () => {
    expect(parseNotificationType("paydirt://notification?type=spend%5Fapproved")).toBe(
      "spend_approved",
    );
  });

  it("picks type out from among multiple query params", () => {
    expect(parseNotificationType("paydirt://notification?foo=bar&type=spend_approved&baz=qux")).toBe(
      "spend_approved",
    );
  });
});

describe("tabForNotificationType", () => {
  it("maps spend_approved to the approvals tab", () => {
    expect(tabForNotificationType("spend_approved")).toBe("approvals");
  });

  it("returns null for an unrecognized type", () => {
    expect(tabForNotificationType("something_new")).toBeNull();
  });

  it("returns null for a missing type", () => {
    expect(tabForNotificationType(null)).toBeNull();
    expect(tabForNotificationType(undefined)).toBeNull();
    expect(tabForNotificationType("")).toBeNull();
  });
});
