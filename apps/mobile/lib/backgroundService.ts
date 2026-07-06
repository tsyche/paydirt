import AsyncStorage from "@react-native-async-storage/async-storage";

const PB_URL_KEY = "pb_url";

// Background polling was replaced by UnifiedPush (ntfy) notifications.
// These stubs keep App.tsx call sites working without the removed package.

export async function storePbUrl(url: string) {
  await AsyncStorage.setItem(PB_URL_KEY, url);
}

export async function startBackgroundService() {
  // no-op — ntfy handles push notifications
}

export async function stopBackgroundService() {
  // no-op — ntfy handles push notifications
}
