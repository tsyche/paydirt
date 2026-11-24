// Realtime resume support. The PocketBase SDK auto-reconnects its SSE socket
// when EventSource fires an error, but on React Native half-open sockets
// (backgrounded app, OS killing the connection, Wi-Fi → cell switches) often
// die silently — no error event, so the SDK believes it is still connected and
// events stop flowing until the screen remounts. Android can also just kill
// the socket while backgrounded. The fix is to force a rebuild on the two
// signals we already have: AppState returning to "active" and the reachability
// monitor flipping offline → online.

/**
 * Minimal shape of the SDK's RealtimeService that a resume needs. Structural,
 * so tests can pass a fake without constructing a real PocketBase client.
 * `connect` is typed `| void` because the SDK's own connect() returns nothing
 * while a reconnect loop is already in flight.
 */
export interface RealtimeLike {
  connect: () => Promise<void> | void;
}

export interface PbLike {
  realtime: RealtimeLike;
}

/**
 * Force the realtime SSE connection to rebuild. The SDK's `connect()` runs
 * `disconnect(true)` first — tearing down the current socket while keeping the
 * registered subscription listeners — then opens a fresh EventSource and
 * re-submits every subscription once it connects. Existing `subscribe()`
 * callers therefore keep receiving events without re-subscribing. Best-effort:
 * failures are swallowed — pull-to-refresh still works.
 *
 * (The SDK's `disconnect()` is typed private, but `connect()` performs the
 * same teardown itself — no cast needed for the happy path.)
 */
export function resumeRealtime(pb: PbLike): void {
  void Promise.resolve(pb.realtime.connect()).catch(() => {});
}

export type ResumeAppState = "active" | "background" | "inactive" | "unknown" | string;
export type ResumeReachability = "online" | "offline";

export interface ResumeScheduler {
  /** Feed an AppState change. Fires onResume on a transition into "active". */
  notifyAppState: (state: ResumeAppState) => void;
  /** Feed a reachability status. Fires onResume on an offline → online flip. */
  notifyReachability: (status: ResumeReachability) => void;
  dispose: () => void;
}

export interface ResumeSchedulerOptions {
  /** Seed so the first real change is compared against reality, not unknown. */
  initialAppState?: ResumeAppState;
  initialReachability?: ResumeReachability;
  /**
   * Window in which multiple triggers (e.g. AppState "active" and the
   * reachability poller reporting online in the same instant) coalesce into a
   * single resume instead of rebuilding the socket twice.
   */
  coalesceMs?: number;
}

const DEFAULT_COALESCE_MS = 500;

/**
 * Decides when to resume: transition into AppState "active", or reachability
 * offline → online. Duplicate triggers within `coalesceMs` collapse into one
 * call. Pure timer logic — no React, no React Native — so it unit-tests with
 * plain vitest fake timers.
 */
export function createResumeScheduler(
  onResume: () => void,
  opts: ResumeSchedulerOptions = {},
): ResumeScheduler {
  const coalesceMs = opts.coalesceMs ?? DEFAULT_COALESCE_MS;
  let lastAppState: ResumeAppState = opts.initialAppState ?? "active";
  let lastReachability: ResumeReachability = opts.initialReachability ?? "online";
  let pending: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function schedule() {
    if (disposed || pending !== null) return;
    pending = setTimeout(() => {
      pending = null;
      if (!disposed) onResume();
    }, coalesceMs);
  }

  return {
    notifyAppState(state) {
      if (disposed) return;
      const wasInactive = lastAppState !== "active";
      lastAppState = state;
      if (state === "active" && wasInactive) schedule();
    },
    notifyReachability(status) {
      if (disposed) return;
      const wasOffline = lastReachability === "offline";
      lastReachability = status;
      if (status === "online" && wasOffline) schedule();
    },
    dispose() {
      disposed = true;
      if (pending !== null) {
        clearTimeout(pending);
        pending = null;
      }
    },
  };
}

/** Serialize full-screen refreshes triggered by mutations and realtime events. */
export function createRefreshQueue(load: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let pending: Promise<void> | null = null;
  function refresh(): Promise<void> {
    if (pending) return pending;
    if (running) {
      // Events during a read need one fresh read, after this transaction's burst.
      pending = running.catch(() => {}).then(() =>
        new Promise<void>((resolve) => setTimeout(resolve, 100)),
      ).then(() => {
        pending = null;
        return refresh();
      });
      return pending;
    }
    // Each caller waits for its own fresh read, not all future realtime events.
    running = Promise.resolve().then(load).finally(() => { running = null; });
    return running;
  }
  return refresh;
}

/** Poll only while a visible screen has queued delivery; never overlap requests. */
export function pollGrantResults(refresh: () => Promise<void>, isActive: () => boolean): () => void {
  let running = false;
  let stopped = false;
  const tick = () => {
    if (stopped || running || !isActive()) return;
    running = true;
    void refresh().catch(() => {}).finally(() => { running = false; });
  };
  const timer = setInterval(tick, 5000);
  tick();
  return () => { stopped = true; clearInterval(timer); };
}
