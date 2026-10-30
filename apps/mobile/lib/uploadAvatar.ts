import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Collections } from "@paydirt/shared";
import { client, pbUrl } from "./client";

export type AvatarUploadResult = "done" | "cancelled" | "no-permission";

/**
 * Pick a photo from the library and set it as a user's avatar. Uses the native
 * multipart uploader for the same reason as completeWithPhoto: JS fetch can't
 * stream Android content:// URIs.
 */
export async function pickAndUploadAvatar(userId: string): Promise<AvatarUploadResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== "granted") return "no-permission";
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled) return "cancelled";

  const asset = result.assets[0];
  const res = await FileSystem.uploadAsync(
    `${pbUrl}/api/collections/${Collections.Users}/records/${userId}`,
    asset.uri,
    {
      httpMethod: "PATCH",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "avatar",
      mimeType: asset.mimeType ?? "image/jpeg",
      headers: { Authorization: client.pb.authStore.token, Accept: "application/json" },
    },
  );
  if (res.status >= 400) throw new Error(`Avatar upload failed (${res.status}): ${res.body}`);
  return "done";
}
