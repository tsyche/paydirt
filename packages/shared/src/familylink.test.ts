import { describe, expect, it } from "vitest";
import {
  FL_ORIGIN,
  FamilyLinkAuthError,
  assertFamilyLinkId,
  buildAuthorization,
  buildGrantBody,
  buildGrantUrl,
  classifyGrantStatus,
  parseGrantSeconds,
  sapisidHash,
} from "./familylink";

const TS = 1700000000;
const API_KEY = "AIza" + "A".repeat(35);

describe("parseGrantSeconds", () => {
  it("accepts whole seconds within range", () => {
    expect(parseGrantSeconds("60")).toBe(60);
    expect(parseGrantSeconds("1800")).toBe(1800);
    expect(parseGrantSeconds("14400")).toBe(14400);
  });

  it.each([undefined, "", "abc", "30.5", "-60", "1e3", "59", "14401"])("rejects %s", (raw) => {
    expect(() => parseGrantSeconds(raw)).toThrow();
  });
});

describe("assertFamilyLinkId", () => {
  it("accepts well-formed ids", () => {
    expect(assertFamilyLinkId("childId", "111980705623865713298")).toBe("111980705623865713298");
    expect(assertFamilyLinkId("deviceId", "aannnppas5cyejg4ck2emjemszzc6ofeld5vhh4bwq3a")).toBeTruthy();
    expect(assertFamilyLinkId("apiKey", API_KEY)).toBe(API_KEY);
  });

  it.each([
    ["childId", undefined],
    ["childId", "123/../x"],
    ["deviceId", "ABC&x=1aaaaaaaaaaaaaaaaaaa"],
    ["apiKey", "not-a-key"],
  ] as const)("rejects %s=%s", (kind, value) => {
    expect(() => assertFamilyLinkId(kind, value)).toThrow(`Invalid or missing ${kind}`);
  });
});

describe("buildGrantBody", () => {
  it("matches the captured JSPB shape", () => {
    expect(buildGrantBody("111", "dev", 1800)).toBe(
      '[null,"111",[[null,null,10,"dev",null,null,null,null,null,null,null,null,null,[["1800",0]]]],[1]]',
    );
  });
});

describe("sapisidHash", () => {
  it("matches an independently computed SHA-1 vector", () => {
    // printf '%s' '1700000000 TESTSAPISID/abc https://familylink.google.com' | shasum -a 1
    expect(sapisidHash("SAPISIDHASH", "TESTSAPISID/abc", FL_ORIGIN, TS)).toBe(
      "SAPISIDHASH 1700000000_e45f587fa81dac7a54b3b7222cceed4651367879",
    );
  });
});

describe("buildAuthorization", () => {
  it("throws an auth error without SAPISID", () => {
    expect(() => buildAuthorization([{ name: "NID", value: "x" }], FL_ORIGIN, TS)).toThrow(
      FamilyLinkAuthError,
    );
  });

  it("uses SAPISID alone when no 1P/3P cookies exist", () => {
    expect(buildAuthorization([{ name: "SAPISID", value: "TESTSAPISID/abc" }], FL_ORIGIN, TS)).toBe(
      "SAPISIDHASH 1700000000_e45f587fa81dac7a54b3b7222cceed4651367879",
    );
  });

  it("appends 1P/3P hashes in order when present", () => {
    const auth = buildAuthorization(
      [
        { name: "__Secure-3PAPISID", value: "TEST1P/xyz" },
        { name: "SAPISID", value: "TESTSAPISID/abc" },
        { name: "__Secure-1PAPISID", value: "TEST1P/xyz" },
      ],
      FL_ORIGIN,
      TS,
    );
    expect(auth).toBe(
      "SAPISIDHASH 1700000000_e45f587fa81dac7a54b3b7222cceed4651367879 " +
        "SAPISID1PHASH 1700000000_27730f440b80c8b67c63f8229766dced1e50a6ce " +
        "SAPISID3PHASH 1700000000_27730f440b80c8b67c63f8229766dced1e50a6ce",
    );
  });
});

describe("buildGrantUrl", () => {
  it("packs headers into $httpHeaders, CRLF-terminated and URL-encoded", () => {
    const url = new URL(buildGrantUrl("111", API_KEY, "SAPISIDHASH 1_ab"));
    expect(url.origin).toBe("https://kidsmanagement-pa.clients6.google.com");
    expect(url.pathname).toBe("/kidsmanagement/v1/people/111/timeLimitOverrides:batchCreate");
    expect(url.searchParams.get("$httpHeaders")).toBe(
      `X-Goog-Api-Key: ${API_KEY}\r\nAuthorization: SAPISIDHASH 1_ab\r\n` +
        "X-Goog-AuthUser: 0\r\nContent-Type: application/json+protobuf\r\n",
    );
  });
});

describe("classifyGrantStatus", () => {
  it.each([
    [200, "ok"],
    [204, "ok"],
    [401, "auth"],
    [403, "auth"],
    [400, "error"],
    [500, "error"],
    [0, "error"],
  ] as const)("%i → %s", (status, outcome) => {
    expect(classifyGrantStatus(status)).toBe(outcome);
  });
});
