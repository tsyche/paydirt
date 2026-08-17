import { Banner } from "react-native-paper";
import { reachability } from "../lib/client";
import { useReachability } from "../lib/useReachability";

/**
 * Plain "can't reach home" state for when the backend is unreachable — swap
 * this in wherever a screen used to just toast a raw fetch error. The last
 * data a screen loaded stays on screen underneath; this only adds the banner.
 * Retries automatically (see reachability.ts); "Retry now" just skips the wait.
 */
export function OfflineBanner() {
  const status = useReachability();

  return (
    <Banner
      visible={status === "offline"}
      icon="wifi-off"
      actions={[{ label: "Retry now", onPress: () => reachability.retryNow() }]}
    >
      Can&apos;t reach home right now. Showing your last update — we&apos;ll keep trying.
    </Banner>
  );
}
