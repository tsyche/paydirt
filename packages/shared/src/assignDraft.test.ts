import { describe, expect, it } from "vitest";
import { parseAssignDraft, serializeAssignDraft } from "./assignDraft";

describe("assign draft", () => {
  it("round-trips picks and drops empty chores", () => {
    const raw = serializeAssignDraft({ c1: new Set(["k1", "k2"]), c2: new Set() });
    const back = parseAssignDraft(raw);
    expect([...back.c1!]).toEqual(["k1", "k2"]);
    expect(back.c2).toBeUndefined();
  });

  it.each([null, undefined, "", "not json", "[]", "5", '{"c":"k1"}', '{"c":[1,2]}'])("tolerates bad input %p", (raw) => {
    expect(parseAssignDraft(raw)).toEqual({});
  });

  it("keeps only string ids", () => {
    expect([...parseAssignDraft('{"c":["k1",2,null]}').c!]).toEqual(["k1"]);
  });
});
