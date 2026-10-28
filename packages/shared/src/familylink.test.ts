import { describe, expect, it } from "vitest";
import {
  FL_ORIGIN,
  FamilyLinkAuthError,
  addFamilyLinkBonus,
  assertFamilyLinkId,
  buildAuthorization,
  buildAppliedTimeLimitsUrl,
  buildGrantBody,
  buildGrantUrl,
  classifyGrantStatus,
  parseGrantSeconds,
  remainingBonusSeconds,
  sapisidHash,
} from "./familylink";
import type { FamilyLinkRequest } from "./familylink";

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

  it("sends SAPISIDHASH only, ignoring 1P/3P cookies (matches the web app)", () => {
    const auth = buildAuthorization(
      [
        { name: "__Secure-1PAPISID", value: "TEST1P/xyz" },
        { name: "SAPISID", value: "TESTSAPISID/abc" },
        { name: "__Secure-3PAPISID", value: "TEST1P/xyz" },
      ],
      FL_ORIGIN,
      TS,
    );
    expect(auth).toBe("SAPISIDHASH 1700000000_e45f587fa81dac7a54b3b7222cceed4651367879");
  });
});

describe("buildGrantUrl", () => {
  it("packs headers into $httpHeaders in the captured order, CRLF-terminated", () => {
    const url = new URL(buildGrantUrl("111", API_KEY, "SAPISIDHASH 1_ab"));
    expect(url.origin).toBe("https://kidsmanagement-pa.clients6.google.com");
    expect(url.pathname).toBe("/kidsmanagement/v1/people/111/timeLimitOverrides:batchCreate");
    expect(url.searchParams.get("$httpHeaders")).toBe(
      "Content-Type: application/json+protobuf\r\nX-Goog-AuthUser: 0\r\n" +
        `Authorization: SAPISIDHASH 1_ab\r\nX-Goog-Api-Key: ${API_KEY}\r\n`,
    );
  });
});

describe("buildAppliedTimeLimitsUrl", () => {
  it("uses the observed read endpoint with the same authentication container", () => {
    const url = new URL(buildAppliedTimeLimitsUrl("111", API_KEY, "SAPISIDHASH 1_ab"));
    expect(url.pathname).toBe("/kidsmanagement/v1/people/111/appliedTimeLimits");
    expect(url.origin).toBe("https://kidsmanagement-pa.clients6.google.com");
    expect(url.search).toBe(new URL(buildGrantUrl("111", API_KEY, "SAPISIDHASH 1_ab")).search);
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

const CHILD_ID = "1".repeat(21);
const DEVICE_ID = "a".repeat(44);
const GRANT = {
  childId: CHILD_ID,
  deviceId: DEVICE_ID,
  apiKey: API_KEY,
  authorization: "SAPISIDHASH 1_test",
  seconds: 900,
};

// Minimal projection of the real appliedTimeLimits response captured 2026-10-28.
// IDs are anonymized; unrelated fields are omitted. The retained timestamps and
// duration matched the dashboard's 1 h 36 min 41 s countdown (5801.174 s).
function observedLimits(): [unknown[], [unknown[], ...unknown[][]]] {
  const override: unknown[] = Array(14).fill(null);
  override[1] = "1793229204372";
  override[2] = 10;
  override[3] = DEVICE_ID;
  override[13] = [["7336", 102000000]];
  const row: unknown[] = Array(26).fill(null);
  row[0] = override;
  row[25] = DEVICE_ID;
  return [[null, "1793230739300"], [row]];
}

function network(payload: unknown, readStatus = 200, writeStatus = 200) {
  const calls: { url: string; init: Parameters<FamilyLinkRequest>[1] }[] = [];
  const request: FamilyLinkRequest = async (url, init) => {
    calls.push({ url, init });
    return init.method === "GET"
      ? { status: readStatus, text: JSON.stringify(payload) }
      : { status: writeStatus, text: "" };
  };
  return { calls, request };
}

describe("remainingBonusSeconds", () => {
  it("matches the real dashboard countdown using Google's timestamp", () => {
    expect(remainingBonusSeconds(observedLimits(), DEVICE_ID)).toBe(5802);
  });

  it("selects the requested device instead of another device's bonus", () => {
    const payload = observedLimits();
    const other = structuredClone(payload[1][0]);
    other[25] = "b".repeat(44);
    payload[1].unshift(other);
    payload[1][1]![0] = null;
    expect(remainingBonusSeconds(payload, DEVICE_ID)).toBe(0);
  });

  it("clamps an expired active bonus to zero", () => {
    const payload = observedLimits();
    payload[0][1] = "1793236540475";
    expect(remainingBonusSeconds(payload, DEVICE_ID)).toBe(0);
  });

  it.each([
    ["missing server time", (p: ReturnType<typeof observedLimits>) => { p[0][1] = null; }],
    ["missing device", (p: ReturnType<typeof observedLimits>) => { p[1].splice(0); }],
    ["duplicate device", (p: ReturnType<typeof observedLimits>) => { p[1].push(p[1][0]); }],
    ["missing override", (p: ReturnType<typeof observedLimits>) => { p[1][0][0] = undefined; }],
    ["unknown override type", (p: ReturnType<typeof observedLimits>) => {
      (p[1][0][0] as unknown[])[2] = 9;
    }],
    ["wrong override device", (p: ReturnType<typeof observedLimits>) => {
      (p[1][0][0] as unknown[])[3] = "b".repeat(44);
    }],
    ["missing duration", (p: ReturnType<typeof observedLimits>) => {
      (p[1][0][0] as unknown[])[13] = null;
    }],
    ["negative duration", (p: ReturnType<typeof observedLimits>) => {
      (p[1][0][0] as unknown[])[13] = [["-1"]];
    }],
    ["fractional seconds field", (p: ReturnType<typeof observedLimits>) => {
      (p[1][0][0] as unknown[])[13] = [["1.5"]];
    }],
    ["out-of-range nanos", (p: ReturnType<typeof observedLimits>) => {
      (p[1][0][0] as unknown[])[13] = [["600", 1e9]];
    }],
    ["overflowing duration", (p: ReturnType<typeof observedLimits>) => {
      (p[1][0][0] as unknown[])[13] = [[String(Number.MAX_SAFE_INTEGER)]];
    }],
  ])("rejects %s rather than treating unreadable time as zero", (_label, mutate) => {
    const payload = observedLimits();
    mutate(payload);
    expect(() => remainingBonusSeconds(payload, DEVICE_ID)).toThrow();
  });
});

describe("addFamilyLinkBonus", () => {
  it("retains ten paid minutes when another fifteen minutes are purchased", async () => {
    const payload = observedLimits();
    payload[0][1] = "1793229204372";
    (payload[1][0][0] as unknown[])[13] = [["600"]];
    const { request, calls } = network(payload);

    const result = await addFamilyLinkBonus(request, GRANT);

    const posted = JSON.parse(calls.at(-1)!.init.body!);
    expect(posted[2][0][13]).toEqual([["1500", 0]]);
    expect(calls.map((call) => call.init.method)).toEqual(["GET", "POST"]);
    expect(new URL(calls[0]!.url).pathname).toBe(
      `/kidsmanagement/v1/people/${CHILD_ID}/appliedTimeLimits`,
    );
    expect(result).toEqual({ status: 200, remainingSeconds: 600, totalSeconds: 1500 });
  });

  it("rounds the observed remaining bonus up to preserve fractional paid seconds", async () => {
    const { request, calls } = network(observedLimits());
    const result = await addFamilyLinkBonus(request, GRANT);
    expect(result.totalSeconds).toBe(6702);
    expect(JSON.parse(calls.at(-1)!.init.body!)[2][0][13]).toEqual([["6702", 0]]);
  });

  it.each([401, 403, 500])("does not write after a failed read (%i)", async (status) => {
    const { request, calls } = network(observedLimits(), status);
    await expect(addFamilyLinkBonus(request, GRANT)).rejects.toThrow(
      status === 500 ? Error : FamilyLinkAuthError,
    );
    expect(calls.map((call) => call.init.method)).toEqual(["GET"]);
  });

  it.each([null, [], [[null, "1793230739300"], []]])(
    "does not write when the read payload is unusable (%j)",
    async (payload) => {
      const { request, calls } = network(payload);
      await expect(addFamilyLinkBonus(request, GRANT)).rejects.toThrow();
      expect(calls.map((call) => call.init.method)).toEqual(["GET"]);
    },
  );

  it("rejects invalid JSON without exposing the response or sending a grant", async () => {
    let calls = 0;
    const request: FamilyLinkRequest = async () => {
      calls++;
      return { status: 200, text: "private Google response" };
    };
    await expect(addFamilyLinkBonus(request, GRANT)).rejects.toThrow(
      "Invalid Family Link bonus response",
    );
    expect(calls).toBe(1);
  });

  it("hides authenticated URLs from network errors and does not retry", async () => {
    let calls = 0;
    const request: FamilyLinkRequest = async (url) => {
      calls++;
      throw new Error(`Network failed: ${url}`);
    };
    await expect(addFamilyLinkBonus(request, GRANT)).rejects.toThrow(
      /^Family Link bonus read request failed$/,
    );
    expect(calls).toBe(1);
  });

  it.each([401, 403, 500])("reports a failed write (%i) without retrying it", async (status) => {
    const { request, calls } = network(observedLimits(), 200, status);
    await expect(addFamilyLinkBonus(request, GRANT)).rejects.toThrow(
      status === 500 ? Error : FamilyLinkAuthError,
    );
    expect(calls.map((call) => call.init.method)).toEqual(["GET", "POST"]);
  });

  it("preserves accumulated time beyond the per-purchase four-hour maximum", async () => {
    const payload = observedLimits();
    payload[0][1] = "1793229204372";
    (payload[1][0][0] as unknown[])[13] = [["14400"]];
    const { request, calls } = network(payload);
    expect((await addFamilyLinkBonus(request, GRANT)).totalSeconds).toBe(15300);
    expect(JSON.parse(calls.at(-1)!.init.body!)[2][0][13]).toEqual([["15300", 0]]);
  });

  it("reads fresh state for each sequential purchase, including no active bonus", async () => {
    const payload = observedLimits();
    payload[1][0][0] = null;
    const methods: string[] = [];
    const request: FamilyLinkRequest = async (_url, init) => {
      methods.push(init.method);
      if (init.method === "POST") {
        const override = JSON.parse(init.body!)[2][0];
        override[1] = payload[0][1];
        payload[1][0][0] = override;
      }
      return { status: 200, text: JSON.stringify(payload) };
    };
    expect((await addFamilyLinkBonus(request, GRANT)).totalSeconds).toBe(900);
    expect((await addFamilyLinkBonus(request, GRANT)).totalSeconds).toBe(1800);
    expect(methods).toEqual(["GET", "POST", "GET", "POST"]);
  });
});
