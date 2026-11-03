import { describe, expect, it } from "vitest";
import { KUDOS_DEFAULT_BUCKS, kudosDefaultBucks } from "./kudos";

describe("kudosDefaultBucks", () => {
  it("uses the product default until a household configures a positive amount", () => {
    expect(kudosDefaultBucks(undefined)).toBe(KUDOS_DEFAULT_BUCKS);
    expect(kudosDefaultBucks({ kudos_default_bucks: 0 })).toBe(KUDOS_DEFAULT_BUCKS);
    expect(kudosDefaultBucks({ kudos_default_bucks: 125 })).toBe(125);
  });
});
