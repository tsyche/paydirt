import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import {
  useFonts,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";
import type { User } from "@paydirt/shared";
import { client, pbUrl } from "./lib/client";
import { Login } from "./screens/Login";
import { KidHome } from "./screens/KidHome";
import { SimpleKidHome } from "./screens/SimpleKidHome";
import { ParentHome } from "./screens/ParentHome";
import { AppearanceProvider, useAppearance } from "./lib/appearance";
import {
  requestNotificationPermissions,
  setupNotificationChannels,
} from "./lib/notifications";
import {
  startBackgroundService,
  stopBackgroundService,
  storePbUrl,
} from "./lib/backgroundService";
import { syncUnifiedPushEndpoint } from "./lib/unifiedpush";
import { parseNotificationType } from "./lib/deepLinks";
import { NtfySetup } from "./components/NtfySetup";

// A notification tap, tagged with a nonce so the same type/tab re-triggers navigation
// even if it's identical to the last one (e.g. two "spend_approved" taps in a row).
type NotificationRoute = { type: string | null; nonce: number };

function AppContent() {
  const { theme, scheme } = useAppearance();
  const [fontsLoaded] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [ntfySetupDone, setNtfySetupDone] = useState(false);
  const [notificationRoute, setNotificationRoute] = useState<NotificationRoute | null>(null);

  useEffect(() => {
    // One-time setup: notification channels, permissions, store the PB URL so
    // the background service can read it after the app is killed.
    setupNotificationChannels();
    requestNotificationPermissions();
    storePbUrl(pbUrl);

    // The AsyncAuthStore loads from AsyncStorage asynchronously; listen for
    // the onChange event so we pick up the restored session after it loads.
    setUser(client.currentUser);
    const unsub = client.pb.authStore.onChange(() => {
      setUser(client.currentUser);
    });
    setReady(true);
    return () => unsub();
  }, []);

  // Notification deep links: UnifiedPushReceiver.kt attaches a paydirt://notification
  // PendingIntent to each Android notification. getInitialURL covers a cold start (app
  // launched by the tap); the "url" listener covers a warm start (app already running,
  // relies on MainActivity.onNewIntent forwarding the new intent).
  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url?.startsWith("paydirt://")) return;
      setNotificationRoute({ type: parseNotificationType(url), nonce: Date.now() });
    }

    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // Notification strategy for kids: prefer UnifiedPush (event-driven, no
  // persistent notification). Fall back to the polling service if the UP
  // endpoint hasn't been registered yet (first launch before ntfy responds).
  useEffect(() => {
    if (user?.role === "child") {
      void syncUnifiedPushEndpoint(user.id).then((hasUp) => {
        if (hasUp) {
          void stopBackgroundService();
        } else {
          void startBackgroundService();
        }
      });
    } else {
      void stopBackgroundService();
    }
  }, [user]);

  function logout() {
    client.logout();
    void stopBackgroundService();
    setUser(null);
  }

  function renderScreen() {
    if (!ready || !fontsLoaded) return null;
    if (!user) return <Login onLogin={setUser} />;
    if (user.role === "child") {
      return user.simplified_mode
        ? <SimpleKidHome user={user} onLogout={logout} />
        : <KidHome user={user} onLogout={logout} />;
    }
    return <ParentHome user={user} onLogout={logout} notificationRoute={notificationRoute} />;
  }

  if (!ntfySetupDone) {
    return (
      <PaperProvider theme={theme}>
        <NtfySetup onComplete={() => setNtfySetupDone(true)} />
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={theme}>
      {renderScreen()}
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <AppContent />
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}
