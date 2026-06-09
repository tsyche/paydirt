import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider, MD3LightTheme } from "react-native-paper";
import type { User } from "@paydirt/shared";
import { client } from "./lib/client";
import { Login } from "./screens/Login";
import { KidHome } from "./screens/KidHome";
import { ParentNotice } from "./screens/ParentNotice";

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
    setUser(client.currentUser);
    setReady(true);
  }, []);

  function logout() {
    client.logout();
    setUser(null);
  }

  function renderScreen() {
    if (!ready) return null;
    if (!user) return <Login onLogin={setUser} />;
    if (user.role === "child") return <KidHome user={user} onLogout={logout} />;
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
