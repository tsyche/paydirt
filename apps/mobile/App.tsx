import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider, MD3LightTheme } from "react-native-paper";
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

// Earthy Material 3 palette to match the PayDirt look.
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#2f7d4f",
    secondary: "#b3433a",
  },
};

export default function App() {
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

  // Keep the background notification service running iff a kid is logged in.
  useEffect(() => {
    if (user?.role === "child") {
      void startBackgroundService();
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
