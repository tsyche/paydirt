import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReachabilityMonitor, isNetworkError } from "./reachability";

describe("createReachabilityMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts optimistically online before the first check resolves", () => {
    const monitor = createReachabilityMonitor("http://example.test/api/health", {
      fetchImpl: vi.fn(() => new Promise<Response>(() => {})), // never resolves
    });
    expect(monitor.getStatus()).toBe("online");
    monitor.stop();
  });

  it("flips to offline when the health check fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Network request failed"));
    const monitor = createReachabilityMonitor("http://example.test/api/health", { fetchImpl });

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(monitor.getStatus()).toBe("offline");
    monitor.stop();
  });

  it("flips to offline when the health check resolves non-ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
    const monitor = createReachabilityMonitor("http://example.test/api/health", { fetchImpl });

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(monitor.getStatus()).toBe("offline");
    monitor.stop();
  });

  it("recovers to online once the backend is reachable again, and notifies subscribers", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValue({ ok: true });
    const monitor = createReachabilityMonitor("http://example.test/api/health", {
      fetchImpl,
      offlineIntervalMs: 1000,
    });
    const seen: string[] = [];
    monitor.subscribe((status) => seen.push(status));

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(monitor.getStatus()).toBe("offline");

    // Next poll (scheduled at the offline cadence) picks up the recovery.
    await vi.advanceTimersByTimeAsync(1000);
    expect(monitor.getStatus()).toBe("online");

    expect(seen).toEqual(["offline", "online"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    monitor.stop();
  });

  it("polls less often once online than while offline", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const monitor = createReachabilityMonitor("http://example.test/api/health", {
      fetchImpl,
      offlineIntervalMs: 1000,
      onlineIntervalMs: 20_000,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(monitor.getStatus()).toBe("online");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // The next check shouldn't fire yet at the (faster) offline cadence.
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // ...but does fire once the slower online cadence elapses.
    await vi.advanceTimersByTimeAsync(19_000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    monitor.stop();
  });

  it("treats a hung check as offline once the timeout elapses (no reply, not a rejection)", async () => {
    // A private LAN IP probed from outside the house often doesn't refuse the
    // connection — it just goes silent. Simulate that: the mock never settles
    // on its own, only in reaction to the abort signal, like real fetch does.
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;
    const monitor = createReachabilityMonitor("http://example.test/api/health", {
      fetchImpl,
      timeoutMs: 5000,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(4999);
    expect(monitor.getStatus()).toBe("online"); // no verdict yet — still hanging

    await vi.advanceTimersByTimeAsync(1);
    expect(monitor.getStatus()).toBe("offline"); // timeout fired, aborted, counted as offline

    monitor.stop();
  });

  it("retryNow() checks immediately without waiting for the poll interval", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const monitor = createReachabilityMonitor("http://example.test/api/health", {
      fetchImpl,
      offlineIntervalMs: 60_000,
    });

    monitor.retryNow();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    monitor.stop();
  });

  it("stops polling once stop() is called", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Network request failed"));
    const monitor = createReachabilityMonitor("http://example.test/api/health", {
      fetchImpl,
      offlineIntervalMs: 1000,
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    monitor.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops future notifications", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Network request failed"));
    const monitor = createReachabilityMonitor("http://example.test/api/health", { fetchImpl });
    const listener = vi.fn();
    const unsubscribe = monitor.subscribe(listener);
    unsubscribe();

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(listener).not.toHaveBeenCalled();
    monitor.stop();
  });
});

describe("isNetworkError", () => {
  it("treats a raw fetch TypeError as a network error", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new TypeError("Network request failed"))).toBe(true);
  });

  it("treats a PocketBase ClientResponseError with status 0 as a network error", () => {
    expect(isNetworkError({ status: 0, isAbort: false })).toBe(true);
  });

  it("does not treat an aborted/cancelled request as a network error", () => {
    expect(isNetworkError({ status: 0, isAbort: true })).toBe(false);
  });

  it("does not treat a real HTTP error status as a network error", () => {
    expect(isNetworkError({ status: 400, isAbort: false })).toBe(false);
    expect(isNetworkError(new Error("Validation failed"))).toBe(false);
  });

  it("handles non-object, non-error values gracefully", () => {
    expect(isNetworkError("some string")).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});
