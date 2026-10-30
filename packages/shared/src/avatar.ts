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

/** Accent colours a parent can give a kid (users.color). */
export const AVATAR_COLORS = ["#e53935", "#8e24aa", "#1e88e5", "#00897b", "#f4511e", "#f9a825"];

/** Per-kid goods-rate override from a text field: blank, non-numeric or <= 0 means "use the household rate" (null). */
export function parseGoodsRateOverride(input: string): number | null {
  const rate = parseFloat(input);
  return isNaN(rate) || rate <= 0 ? null : rate;
}
