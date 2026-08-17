import EventSource from "react-native-sse";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PocketBase, { AsyncAuthStore } from "pocketbase";
import { PaydirtClient } from "@paydirt/shared";
import { createReachabilityMonitor } from "./reachability";

// PocketBase realtime subscriptions ride on SSE, and React Native has no
// native EventSource — install the polyfill before the SDK is used.
(globalThis as { EventSource?: unknown }).EventSource = EventSource;

// On a physical device, 127.0.0.1 is the device itself.
// Set EXPO_PUBLIC_POCKETBASE_URL in apps/mobile/.env before running `just prebuild`:
//   EXPO_PUBLIC_POCKETBASE_URL=http://192.168.1.50:8090  (your server's LAN IP)
// Or use `just adb-tunnel` over USB and keep the 127.0.0.1 default.
export const pbUrl =
  process.env.EXPO_PUBLIC_POCKETBASE_URL ?? "http://10.0.2.2:8090";

// AsyncAuthStore persists the auth token across restarts (via AsyncStorage)
// and makes it readable by the background notification service.
const store = new AsyncAuthStore({
  save: async (serialized) => AsyncStorage.setItem("pb_auth", serialized),
  initial: AsyncStorage.getItem("pb_auth"),
  clear: async () => AsyncStorage.removeItem("pb_auth"),
});

export const client = new PaydirtClient(new PocketBase(pbUrl, store));

// Single shared reachability poller — see reachability.ts for why. Screens read
// its status via the useReachability() hook instead of probing individually.
export const reachability = createReachabilityMonitor(`${pbUrl}/api/health`);
reachability.start();
