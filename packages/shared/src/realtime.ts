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
