import { describe, expect, it } from "vitest";
import { IDLE, dialogVisible, updateReducer } from "./updateFlow";

describe("updateReducer", () => {
  it("walks idle -> downloading -> ready", () => {
    let s = updateReducer(IDLE, { type: "start" });
    expect(s).toEqual({ phase: "downloading", percent: 0 });
    s = updateReducer(s, { type: "progress", percent: 42.4 });
    expect(s).toEqual({ phase: "downloading", percent: 42 });
    s = updateReducer(s, { type: "ready" });
    expect(s).toEqual({ phase: "ready" });
  });

  it("restores 'ready' straight from idle (finished APK found after an app restart)", () => {
    expect(updateReducer(IDLE, { type: "ready" })).toEqual({ phase: "ready" });
  });

  it("ignores a second start while downloading or ready (duplicate taps)", () => {
    const dl = updateReducer(updateReducer(IDLE, { type: "start" }), { type: "progress", percent: 50 });
    expect(updateReducer(dl, { type: "start" })).toBe(dl);
    const ready = updateReducer(dl, { type: "ready" });
    expect(updateReducer(ready, { type: "start" })).toBe(ready);
  });

  it("allows a retry after failure and clamps progress", () => {
    const failed = updateReducer(updateReducer(IDLE, { type: "start" }), { type: "failed", reason: 1004 });
    expect(failed).toEqual({ phase: "failed", reason: 1004 });
    const again = updateReducer(failed, { type: "start" });
    expect(again).toEqual({ phase: "downloading", percent: 0 });
    expect(updateReducer(again, { type: "progress", percent: 140 })).toEqual({ phase: "downloading", percent: 100 });
  });

  it("drops late progress once not downloading", () => {
    expect(updateReducer(IDLE, { type: "progress", percent: 10 })).toBe(IDLE);
  });

  it("dismiss clears a failure but never cancels a download or ready state", () => {
    expect(updateReducer({ phase: "failed", reason: 1 }, { type: "dismiss" })).toBe(IDLE);
    const dl = { phase: "downloading", percent: 5 } as const;
    expect(updateReducer(dl, { type: "dismiss" })).toBe(dl);
    expect(updateReducer({ phase: "ready" }, { type: "dismiss" })).toEqual({ phase: "ready" });
  });
});

describe("dialogVisible", () => {
  it("honours Hide/Later for downloading and ready, but always shows failures", () => {
    expect(dialogVisible({ phase: "downloading", percent: 3 }, true)).toBe(false);
    expect(dialogVisible({ phase: "downloading", percent: 3 }, false)).toBe(true);
    expect(dialogVisible({ phase: "ready" }, true)).toBe(false);
    expect(dialogVisible({ phase: "ready" }, false)).toBe(true);
    expect(dialogVisible({ phase: "failed", reason: 1 }, true)).toBe(true);
    expect(dialogVisible(IDLE, false)).toBe(false);
  });
});
