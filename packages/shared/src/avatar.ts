import type PocketBase from "pocketbase";
import type { User } from "./types";

/** Thumb sizes configured on the users.avatar field (migration 1717000021). */
export type AvatarThumb = "100x100" | "300x300";

/**
 * URL of the user's uploaded avatar image, or "" when none is set (callers
 * fall back to avatar_emoji). Pass a thumb for small spots to save bandwidth.
 */
export function avatarUrl(
  pb: Pick<PocketBase, "files">,
  user: Pick<User, "id" | "avatar" | "collectionId" | "collectionName">,
  thumb?: AvatarThumb,
): string {
  if (!user.avatar) return "";
  const record = {
    id: user.id,
    collectionId: user.collectionId ?? "users",
    collectionName: user.collectionName ?? "users",
  };
  return pb.files.getURL(record, user.avatar, thumb ? { thumb } : undefined);
}
