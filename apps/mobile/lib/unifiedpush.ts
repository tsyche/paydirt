import { NativeModules } from "react-native";
import { File, Paths } from "expo-file-system";
import { client } from "./client";

// UnifiedPushReceiver.kt writes the endpoint here when ntfy confirms registration.
// Paths.document maps to context.filesDir on Android, so both sides share the file.
const endpointFile = () => new File(Paths.document, "up_endpoint.txt");

// Reads the UP endpoint written by the native BroadcastReceiver and syncs it
// to PocketBase. Returns true if an endpoint was found and saved.
// Called on kid login — ensures the server always has the current endpoint.
export async function syncUnifiedPushEndpoint(userId: string): Promise<boolean> {
  try {
    const file = endpointFile();
    if (!file.exists) return false;
    const endpoint = (await file.text()).trim();
    if (!endpoint) return false;
    // Skip if already synced. Updating the child's own auth record makes the
    // PocketBase SDK save it back to the authStore, which fires onChange →
    // App re-renders with a new user identity → the [user] effect re-runs this
    // function → endless PATCH/realtime/reload loop (flashing spinner).
    if (client.currentUser?.up_endpoint === endpoint) return true;
    await client.pb.collection("users").update(userId, { up_endpoint: endpoint });
    return true;
  } catch {
    return false;
  }
}

// Re-sends the REGISTER broadcast to ntfy via the native module. Registration
// otherwise only happens at app startup, so installing ntfy (or missing its
// distributor-approval prompt) after launch left no way to retry.
export async function requestNtfyRegistration(): Promise<void> {
  try {
    await NativeModules.PayDirtNative?.registerWithNtfy?.();
  } catch {
    // best effort — the caller surfaces failure via the endpoint never appearing
  }
}

// Polls for the endpoint file after (re-)registering. ntfy answers the REGISTER
// broadcast asynchronously — a single read right after tapping the button races
// it and reports a false negative.
export async function waitForUnifiedPushEndpoint(
  userId: string,
  { attempts = 8, delayMs = 1500 }: { attempts?: number; delayMs?: number } = {},
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await syncUnifiedPushEndpoint(userId)) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}
