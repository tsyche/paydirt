import { Alert } from "react-native";
import { approveTimePrompt } from "@paydirt/shared";

/** Mirrors web's confirmApprove: asks first only when an approval pays screen time. */
export function confirmApprove(items: Parameters<typeof approveTimePrompt>[0]): Promise<boolean> {
  const prompt = approveTimePrompt(items);
  if (prompt === null) return Promise.resolve(true);
  return new Promise((resolve) => Alert.alert("Approve chore", prompt, [
    { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
    { text: "Approve", onPress: () => resolve(true) },
  ], { cancelable: false }));
}
