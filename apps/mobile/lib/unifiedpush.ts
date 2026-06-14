import * as FileSystem from "expo-file-system";
import { client } from "./client";

// UnifiedPushReceiver.kt writes the endpoint here when ntfy confirms registration.
// On Android bare workflow, FileSystem.documentDirectory == context.filesDir,
// so both sides read/write the same file.
const ENDPOINT_FILE = FileSystem.documentDirectory + "up_endpoint.txt";

// Reads the UP endpoint written by the native BroadcastReceiver and syncs it
// to PocketBase. Returns true if an endpoint was found and saved.
// Called on kid login — ensures the server always has the current endpoint.
export async function syncUnifiedPushEndpoint(userId: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(ENDPOINT_FILE);
    if (!info.exists) return false;
    const endpoint = (await FileSystem.readAsStringAsync(ENDPOINT_FILE)).trim();
    if (!endpoint) return false;
    await client.pb.collection("users").update(userId, { up_endpoint: endpoint });
    return true;
  } catch {
    return false;
  }
}
