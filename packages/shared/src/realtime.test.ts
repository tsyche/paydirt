import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createResumeScheduler,
  resumeRealtime,
  type PbLike,
  type RealtimeLike,
} from "./realtime";

function fakePb(hooks: Partial<RealtimeLike> = {}): PbLike & {
  connectCalls: number;
} {
  const pb = {
    connectCalls: 0,
    realtime: {
      connect: () => {
        pb.connectCalls += 1;
        return hooks.connect ? hooks.connect() : Promise.resolve();
      },
    },
  };
  return pb;
}

describe("resumeRealtime", () => {
  it("calls connect exactly once", () => {
    const pb = fakePb();
    resumeRealtime(pb);
    expect(pb.connectCalls).toBe(1);
  });

  it("handles a void return (SDK mid-reconnect-loop)", () => {
    const pb = fakePb({ connect: () => undefined });
    expect(() => resumeRealtime(pb)).not.toThrow();
    expect(pb.connectCalls).toBe(1);
  });

  it("swallows an async connect rejection (offline is fine)", async () => {
    const pb = fakePb({
      connect: () => Promise.reject(new Error("connect timed out")),
    });

    expect(() => resumeRealtime(pb)).not.toThrow();
    // The internal .catch owns the rejection; give it a microtask to run.
    await Promise.resolve();
    expect(pb.connectCalls).toBe(1);
  });
});

describe("createResumeScheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires on transition into active, not on staying active", () => {
    const onResume = vi.fn();
    const s = createResumeScheduler(onResume, { initialAppState: "active" });

    s.notifyAppState("active");
    vi.runAllTimers();
    expect(onResume).not.toHaveBeenCalled();

    s.notifyAppState("background");
    s.notifyAppState("active");
    vi.runAllTimers();
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("fires on the very first transition away from the seeded state", () => {
    const onResume = vi.fn();
    const s = createResumeScheduler(onResume, { initialAppState: "background" });

    s.notifyAppState("active");
    vi.runAllTimers();
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("fires on offline → online but not on staying online", () => {
    const onResume = vi.fn();
    const s = createResumeScheduler(onResume, { initialReachability: "online" });

    s.notifyReachability("online");
    vi.runAllTimers();
    expect(onResume).not.toHaveBeenCalled();

    s.notifyReachability("offline");
    s.notifyReachability("online");
    vi.runAllTimers();
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("does not fire on online → offline", () => {
    const onResume = vi.fn();
    const s = createResumeScheduler(onResume, { initialReachability: "online" });

    s.notifyReachability("offline");
    vi.runAllTimers();
    expect(onResume).not.toHaveBeenCalled();
  });

  it("coalesces simultaneous app-activity and reconnect triggers into one resume", () => {
    const onResume = vi.fn();
    const s = createResumeScheduler(onResume, {
      initialAppState: "background",
      initialReachability: "offline",
    });

    // Coming back to the foreground: both fire in the same tick.
    s.notifyAppState("active");
    s.notifyReachability("online");
    vi.runAllTimers();
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("fires again for a later, separate reconnect", () => {
    const onResume = vi.fn();
    const s = createResumeScheduler(onResume, {
      initialAppState: "active",
      initialReachability: "online",
    });

    s.notifyReachability("offline");
    s.notifyReachability("online");
    vi.runAllTimers();

    s.notifyReachability("offline");
    s.notifyReachability("online");
    vi.runAllTimers();

    expect(onResume).toHaveBeenCalledTimes(2);
  });

  it("dispose cancels a pending resume and ignores later notifies", () => {
    const onResume = vi.fn();
    const s = createResumeScheduler(onResume, { initialAppState: "background" });

    s.notifyAppState("active");
    s.dispose();
    vi.runAllTimers();
    expect(onResume).not.toHaveBeenCalled();

    s.notifyAppState("background");
    s.notifyAppState("active");
    vi.runAllTimers();
    expect(onResume).not.toHaveBeenCalled();
  });
});
