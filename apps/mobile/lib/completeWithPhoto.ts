import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Collections } from "@paydirt/shared";
import { client, pbUrl } from "./client";

export type PhotoCompleteResult = "done" | "cancelled" | "no-permission";

/**
 * Take a photo and mark the assignment completed with it attached.
 *
 * Uploads via expo-file-system's native multipart uploader instead of the
 * PocketBase SDK's fetch path. Both prior approaches failed on real devices:
 * FormData/{uri} descriptors and base64 data URIs die in JS fetch on Android
 * (content:// URIs, ClientResponseError 0 = fetch threw with no HTTP response).
 * Native uploadAsync hands the file URI to OkHttp directly and never touches
 * Hermes fetch for the body.
 */
export async function takePhotoAndComplete(assignmentId: string): Promise<PhotoCompleteResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== "granted") return "no-permission";
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7 });
  if (result.canceled) return "cancelled";

  const asset = result.assets[0];
  const res = await FileSystem.uploadAsync(
    `${pbUrl}/api/collections/${Collections.Assignments}/records/${assignmentId}`,
    asset.uri,
    {
      httpMethod: "PATCH",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "photo",
      mimeType: asset.mimeType ?? "image/jpeg",
      parameters: {
        status: "completed",
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

  return "done";
}
