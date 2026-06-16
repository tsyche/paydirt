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
    await client.pb.collection("users").update(userId, { up_endpoint: endpoint });
    return true;
  } catch {
    return false;
  }
}
