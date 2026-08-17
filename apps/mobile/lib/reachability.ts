// Backend reachability tracking. Real deployments point EXPO_PUBLIC_POCKETBASE_URL
// at a LAN IP (see client.ts) — a kid outside the house on cell data will get an
// unreachable server. Rather than every screen doing its own fetch-and-catch, this
// module owns a single poller that screens subscribe to via useReachability().
export type ReachabilityStatus = "online" | "offline";

export interface ReachabilityMonitor {
  getStatus: () => ReachabilityStatus;
  subscribe: (listener: (status: ReachabilityStatus) => void) => () => void;
  /** Check right now, outside the normal poll cadence (e.g. a user tapped "Retry"). */
  retryNow: () => void;
  start: () => void;
  stop: () => void;
}

interface ReachabilityOptions {
  /** Poll cadence while offline — fast, so a reconnect is picked up quickly. */
  offlineIntervalMs?: number;
  /** Poll cadence while online — slow; just a sanity check the connection is still good. */
  onlineIntervalMs?: number;
  /**
   * How long to wait for a single check before giving up and calling it offline.
   * Matters most on the exact scenario this exists for: a private LAN IP probed
   * from outside the house often doesn't refuse the connection, it just goes
   * silent — plain `fetch` has no built-in timeout and could hang far longer
   * than a user will wait for a "can't reach home" banner to appear.
   */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_OFFLINE_INTERVAL_MS = 4_000;
const DEFAULT_ONLINE_INTERVAL_MS = 20_000;
const DEFAULT_TIMEOUT_MS = 5_000;

/** healthUrl should be the full URL to probe, e.g. `${pbUrl}/api/health`. */
export function createReachabilityMonitor(
  healthUrl: string,
  opts: ReachabilityOptions = {},
): ReachabilityMonitor {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const offlineIntervalMs = opts.offlineIntervalMs ?? DEFAULT_OFFLINE_INTERVAL_MS;
  const onlineIntervalMs = opts.onlineIntervalMs ?? DEFAULT_ONLINE_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Optimistic default: assume online until the first check says otherwise, so we
  // don't flash an offline banner on every cold start before the probe resolves.
  let status: ReachabilityStatus = "online";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let started = false;
  const listeners = new Set<(status: ReachabilityStatus) => void>();

  function setStatus(next: ReachabilityStatus) {
    if (next === status) return;
    status = next;
    for (const listener of listeners) listener(status);
  }

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function scheduleNext() {
    clearTimer();
    timer = setTimeout(() => void check(), status === "online" ? onlineIntervalMs : offlineIntervalMs);
  }

  async function check() {
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(healthUrl, { signal: controller.signal });
      setStatus(res.ok ? "online" : "offline");
    } catch {
      setStatus("offline");
    } finally {
      clearTimeout(abortTimer);
    }
    if (started) scheduleNext();
  }

  return {
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    retryNow() {
      void check();
    },
    start() {
      if (started) return;
      started = true;
      void check();
    },
    stop() {
      started = false;
      clearTimer();
    },
  };
}

/**
 * True if `e` looks like a connectivity failure (backend unreachable) rather than
 * e.g. a validation error the server rejected. Screens use this to skip piling a
 * raw error toast on top of the offline banner, which already says the same thing.
 */
export function isNetworkError(e: unknown): boolean {
  // Raw fetch throws TypeError for connectivity failures ("Failed to fetch" on
  // web, "Network request failed" on React Native).
  if (e instanceof TypeError) return true;
  // The PocketBase SDK wraps connectivity failures in ClientResponseError with
  // status 0 (as opposed to a real HTTP status or an aborted/cancelled request).
  if (e && typeof e === "object") {
    const err = e as { status?: number; isAbort?: boolean };
    if (typeof err.status === "number" && err.status === 0 && !err.isAbort) return true;
  }
  return false;
}
