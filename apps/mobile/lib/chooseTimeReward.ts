import { Alert } from "react-native";
import type { Chore } from "@paydirt/shared";

/** Choice is submitted with proof; approval is still the only earning event. */
export function chooseTimeReward(chore?: Chore): Promise<"bank" | "use" | null> {
  if (!chore || !["time", "both"].includes(chore.pay_mode || "")) return Promise.resolve("bank");
  return new Promise((resolve) => {
    Alert.alert("Your earned time", "After parent approval: save your minutes, or use whole 15-minute blocks (any remainder stays saved). Use now queues for the next allowed window if needed.", [
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      { text: "Use now", onPress: () => resolve("use") },
      { text: "Bank", onPress: () => resolve("bank") },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}
