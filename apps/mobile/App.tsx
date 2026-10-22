import { useEffect, useState } from "react";
import { Alert, Linking } from "react-native";
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
import { fetchLatestVersion, getInstalledVersionCode, shouldUpdate, triggerApkDownload } from "./lib/appUpdate";
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
import { getNtfyConfig, isSetupComplete } from "./lib/ntfy-onboarding";

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
  const [ntfySetupLoaded, setNtfySetupLoaded] = useState(false);
  const [ntfySetupVisible, setNtfySetupVisible] = useState(false);
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

  // Notification setup status: incomplete until the topic is subscribed AND a
  // test delivery landed (v2 gate — the old wizard's "done" never subscribed
  // anything). Auto-opens once after login; the ParentHome banner reopens it.
  useEffect(() => {
    void getNtfyConfig().then((c) => {
      const done = isSetupComplete(c);
      setNtfySetupDone(done);
      setNtfySetupLoaded(true);
      if (!done) setNtfySetupVisible(true);
    });
  }, []);

  // Notification deep links: UnifiedPushReceiver.kt attaches a paydirt://notification
  // PendingIntent to each Android notification. getInitialURL covers a cold start (app
  // launched by the tap); the "url" listener covers a warm start (app already running,
  // relies on MainActivity.onNewIntent forwarding the new intent).
  useEffect(() => {
    function handleUrl(url: string | null | undefined) {
      if (!url?.startsWith("paydirt://")) return;
      setNotificationRoute({ type: parseNotificationType(url), nonce: Date.now() });
    }

    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // Tier 2 app auto-update: check for a newer native APK on start and on
  // resume; prompt the user to download + install if one is available.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const latest = await fetchLatestVersion(pbUrl);
      if (cancelled || !latest || !latest.downloadUrl) return;
      const installed = await getInstalledVersionCode();
      if (!shouldUpdate(installed, latest.versionCode)) return;
      Alert.alert(
        "Update available",
        `PayDirt ${latest.versionName} is available. Download and install now?`,
        [
          { text: "Later", style: "cancel" },
          {
            text: "Update",
            onPress: () => { void triggerApkDownload(latest.downloadUrl); },
          },
        ],
      );
    }
    void check();
    return () => { cancelled = true; };
  }, []);

  // Notification strategy for kids: prefer UnifiedPush (event-driven, no
  // persistent notification). Fall back to the polling service if the UP
  // endpoint hasn't been registered yet (first launch before ntfy responds).
  // Deps are the id/role values, not the user object: updating the child's own
  // auth record (up_endpoint sync) makes the SDK fire authStore.onChange with
  // a NEW user object, and depending on [user] identity re-ran this effect →
  // endless update/reload loop.
  const userId = user?.id;
  const userRole = user?.role;
  useEffect(() => {
    if (userRole === "child" && userId) {
      void syncUnifiedPushEndpoint(userId).then((hasUp) => {
        if (hasUp) {
          void stopBackgroundService();
        } else {
          void startBackgroundService();
        }
      });
    } else {
      void stopBackgroundService();
    }
  }, [userId, userRole]);

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
    return <ParentHome
      user={user}
      onLogout={logout}
      notificationRoute={notificationRoute}
      notificationSetupNeeded={ntfySetupLoaded && !ntfySetupDone}
      onOpenNotificationSetup={() => setNtfySetupVisible(true)}
    />;
  }

  return (
    <PaperProvider theme={theme}>
      {renderScreen()}
      {user && ntfySetupLoaded && !ntfySetupDone && ntfySetupVisible && (
        <NtfySetup
          visible
          user={user}
          onComplete={() => {
            setNtfySetupDone(true);
            setNtfySetupVisible(false);
          }}
          onDismiss={() => setNtfySetupVisible(false)}
        />
      )}
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
