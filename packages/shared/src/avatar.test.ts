import PocketBase from "pocketbase";
import { describe, expect, it } from "vitest";
import { avatarUrl, parseGoodsRateOverride } from "./avatar";

const pb = new PocketBase("http://pb.test:3111");
const base = { id: "u1", collectionId: "_pb_users_auth_", collectionName: "users" };

describe("avatarUrl", () => {
  it("returns empty string when no file is uploaded", () => {
    expect(avatarUrl(pb, base)).toBe("");
    expect(avatarUrl(pb, { ...base, avatar: "" })).toBe("");
  });

  it("builds the PocketBase file URL", () => {
    expect(avatarUrl(pb, { ...base, avatar: "kid_ab12.png" })).toBe(
      "http://pb.test:3111/api/files/_pb_users_auth_/u1/kid_ab12.png",
    );
  });

  it("appends the thumb when requested", () => {
    expect(avatarUrl(pb, { ...base, avatar: "kid_ab12.png" }, "100x100")).toBe(
      "http://pb.test:3111/api/files/_pb_users_auth_/u1/kid_ab12.png?thumb=100x100",
    );
  });
});

describe("parseGoodsRateOverride", () => {
  it("treats blank, junk, zero and negatives as no override", () => {
    for (const v of ["", "  ", "abc", "0", "-5"]) expect(parseGoodsRateOverride(v)).toBeNull();
  });

  it("parses positive numbers", () => {
    expect(parseGoodsRateOverride("12")).toBe(12);
    expect(parseGoodsRateOverride("7.5")).toBe(7.5);
  });
});
