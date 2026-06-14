import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Collections } from "@paydirt/shared";
import { client } from "./client";

export type PhotoCompleteResult = "done" | "cancelled" | "no-permission";

/**
 * Take a photo and mark the assignment completed with it attached.
 * Uses base64 data URI via JSON — more reliable than FormData on Android,
 * where content:// URIs from the camera can't be read by the native HTTP client.
 * PocketBase accepts "data:{mime};base64,{data}" for file fields in JSON.
 */
export async function takePhotoAndComplete(assignmentId: string): Promise<PhotoCompleteResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== "granted") return "no-permission";
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7 });
  if (result.canceled) return "cancelled";

  const asset = result.assets[0];
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mimeType = asset.mimeType ?? "image/jpeg";

  await client.pb.collection(Collections.Assignments).update(assignmentId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    photo: `data:${mimeType};base64,${base64}`,
  });

  return "done";
}
