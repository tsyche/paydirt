import * as ImagePicker from "expo-image-picker";
import { Collections } from "@paydirt/shared";
import { client } from "./client";

export type PhotoCompleteResult = "done" | "cancelled" | "no-permission";

/**
 * Take a photo and mark the assignment completed with it attached.
 * Uploads via the FormData URI pattern — fetch(uri).blob() crashes on Android.
 */
export async function takePhotoAndComplete(assignmentId: string): Promise<PhotoCompleteResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== "granted") return "no-permission";
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7 });
  if (result.canceled) return "cancelled";

  const asset = result.assets[0];
  const formData = new FormData();
  formData.append("status", "completed");
  formData.append("completed_at", new Date().toISOString());
  formData.append("photo", {
    uri: asset.uri,
    type: asset.mimeType ?? "image/jpeg",
    name: "proof.jpg",
  } as unknown as Blob);
  await client.pb.collection(Collections.Assignments).update(assignmentId, formData);
  return "done";
}
