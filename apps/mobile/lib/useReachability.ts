import { useSyncExternalStore } from "react";
import { reachability } from "./client";
import type { ReachabilityStatus } from "./reachability";

/** Live "online" | "offline" status of the shared reachability poller. */
export function useReachability(): ReachabilityStatus {
  return useSyncExternalStore(reachability.subscribe, reachability.getStatus, reachability.getStatus);
}
