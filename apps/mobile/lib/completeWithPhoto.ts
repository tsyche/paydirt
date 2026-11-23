import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Collections } from "@paydirt/shared";
import { client, pbUrl } from "./client";

async function cancelTimerReminder(assignmentId: string) {
  try { await Notifications.cancelScheduledNotificationAsync(`chore-timer-${assignmentId}`); }
  catch { /* Notification cleanup must not undo a successful submission. */ }
}

export async function completeWithoutPhoto(assignmentId: string, timeChoice: "bank" | "use" = "bank", note = "") {
  const assignment = await client.markComplete(assignmentId, undefined, timeChoice, note);
  await cancelTimerReminder(assignmentId);
  return assignment;
}

export type PhotoCompleteResult = "done" | "cancelled" | "no-permission";

type PendingPhoto = { assignmentId: string; timeChoice: "bank" | "use"; note: string; at: number };
const PENDING_KEY = "paydirt-pending-photo";
// A camera result older than this is not worth submitting automatically.
const PENDING_MAX_AGE_MS = 60 * 60 * 1000;

async function uploadPhoto(assignmentId: string, uri: string, mimeType: string | undefined, timeChoice: "bank" | "use", note: string) {
  const res = await FileSystem.uploadAsync(
    `${pbUrl}/api/collections/${Collections.Assignments}/records/${assignmentId}`,
    uri,
    {
      httpMethod: "PATCH",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "photo",
      mimeType: mimeType ?? "image/jpeg",
      parameters: {
        status: "completed",
        time_choice: timeChoice,
        submission_note: note.trim(),
        completed_at: new Date().toISOString(),
      },
      headers: {
        Authorization: client.pb.authStore.token,
        Accept: "application/json",
      },
    },
  );

  if (res.status >= 400) {
    throw new Error(`Photo upload failed (${res.status}): ${res.body}`);
  }

  await cancelTimerReminder(assignmentId);
}

/**
 * Take a photo and mark the assignment completed with it attached.
 *
 * Uploads via expo-file-system's native multipart uploader instead of the
 * PocketBase SDK's fetch path. Both prior approaches failed on real devices:
 * FormData/{uri} descriptors and base64 data URIs die in JS fetch on Android
 * (content:// URIs, ClientResponseError 0 = fetch threw with no HTTP response).
 * Native uploadAsync hands the file URI to OkHttp directly and never touches
 * Hermes fetch for the body.
 *
 * Android may kill the app while the camera is open, losing the result and
 * relaunching to the same screen. The submission context is saved first so
 * recoverPendingPhoto() can finish the upload on the next launch.
 */
export async function takePhotoAndComplete(assignmentId: string, timeChoice: "bank" | "use" = "bank", note = ""): Promise<PhotoCompleteResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== "granted") return "no-permission";
  const pending: PendingPhoto = { assignmentId, timeChoice, note, at: Date.now() };
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending)).catch(() => {});
  let result;
  try { result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7 }); }
  finally { await AsyncStorage.removeItem(PENDING_KEY).catch(() => {}); }
  if (result.canceled) return "cancelled";

  const asset = result.assets[0];
  await uploadPhoto(assignmentId, asset.uri, asset.mimeType, timeChoice, note);
  return "done";
}

/**
 * Finish a photo submission whose camera result survived an app kill.
 * Call once after sign-in. Returns true when a photo was uploaded.
 */
export async function recoverPendingPhoto(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PENDING_KEY).catch(() => null);
  if (!raw) return false;
  // Clear first: a failed recovery must not retry forever.
  await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
  let pending: PendingPhoto;
  try { pending = JSON.parse(raw) as PendingPhoto; } catch { return false; }
  if (!pending.assignmentId || Date.now() - pending.at > PENDING_MAX_AGE_MS) return false;
  const result = await ImagePicker.getPendingResultAsync();
  if (!result || "code" in result || result.canceled || !result.assets?.[0]) return false;
  const asset = result.assets[0];
  await uploadPhoto(pending.assignmentId, asset.uri, asset.mimeType, pending.timeChoice, pending.note);
  return true;
}
