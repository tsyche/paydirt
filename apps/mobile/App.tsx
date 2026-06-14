import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from "react-native-paper";
import type { User } from "@paydirt/shared";
import { client, pbUrl } from "./lib/client";
import { Login } from "./screens/Login";
import { KidHome } from "./screens/KidHome";
import { SimpleKidHome } from "./screens/SimpleKidHome";
import { ParentNotice } from "./screens/ParentNotice";
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

const lightTheme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, primary: "#2f7d4f", secondary: "#b3433a" },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: { ...MD3DarkTheme.colors, primary: "#5cb87a", secondary: "#e07b72" },
};

export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? darkTheme : lightTheme;
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

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
    if (!ready) return null;
    if (!user) return <Login onLogin={setUser} />;
    if (user.role === "child") {
      return user.simplified_mode
        ? <SimpleKidHome user={user} onLogout={logout} />
        : <KidHome user={user} onLogout={logout} />;
    }
    return <ParentNotice onLogout={logout} />;
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        {renderScreen()}
        <StatusBar style="auto" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
