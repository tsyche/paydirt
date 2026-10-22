import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { createResumeScheduler } from "@paydirt/shared";
import { client, reachability } from "./client";

/**
 * Rebuild the realtime SSE socket and re-fetch when the app comes back to the
 * foreground or the backend becomes reachable again. The SDK's own reconnect
 * only runs on EventSource errors, which RN half-open sockets don't fire —
 * without this, events silently stop after backgrounding or a network blip
 * until the screen remounts (the "tens of minutes of stale UI" smoke-test
 * finding, 2026-10-21).
 *
 * `onResume` is the screen's reload — events aren't replayed across a socket
 * rebuild, so a catch-up fetch rides along with every resume.
 */
export function useRealtimeResume(onResume: () => void): void {
  const resumeRef = useRef(onResume);
  resumeRef.current = onResume;

  useEffect(() => {
    const scheduler = createResumeScheduler(
      () => {
        client.resumeRealtime();
        resumeRef.current();
      },
      {
        initialAppState: AppState.currentState ?? "active",
        initialReachability: reachability.getStatus(),
      },
    );

    const appStateSub = AppState.addEventListener("change", (state) =>
      scheduler.notifyAppState(state),
    );
    const reachabilityUnsub = reachability.subscribe((status) =>
      scheduler.notifyReachability(status),
    );

    return () => {
      appStateSub.remove();
      reachabilityUnsub();
      scheduler.dispose();
    };
  }, []);
}
