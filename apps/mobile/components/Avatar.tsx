import { Image, StyleSheet, Text } from "react-native";
import { avatarUrl, type User } from "@paydirt/shared";
import { client } from "../lib/client";

/** Uploaded avatar image if the user has one, else their emoji (or `fallback`). */
export function Avatar({
  user,
  size,
  fallback = "🧒",
}: {
  user: Pick<User, "id" | "avatar" | "avatar_emoji" | "collectionId" | "collectionName">;
  size: number;
  fallback?: string;
}) {
  const uri = avatarUrl(client.pb, user, size > 100 ? "300x300" : "100x100");
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return <Text style={[styles.emoji, { fontSize: size }]}>{user.avatar_emoji || fallback}</Text>;
}

const styles = StyleSheet.create({
  emoji: { textAlign: "center" },
});
