import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Show notifications even when the app is in the foreground (the background
// service suppresses them when the screen is active, but keep this permissive
// so in-app toasts and banners both work).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function setupNotificationChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("paydirt-alerts", {
    name: "PayDirt Alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2f7d4f",
    sound: "default",
  });
  // Low-importance channel for the persistent foreground-service indicator.
  await Notifications.setNotificationChannelAsync("paydirt-service", {
    name: "PayDirt Background",
    importance: Notifications.AndroidImportance.LOW,
    showBadge: false,
  });
}

export async function showLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      android: { channelId: "paydirt-alerts" },
    },
    trigger: null,
  });
}
