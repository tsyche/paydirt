import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { TextInput, Button, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import type { User } from "@paydirt/shared";
import { client } from "../lib/client";

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const theme = useTheme();

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const user = await client.login(email.trim(), password);
      onLogin(user);
    } catch {
      setError("Login failed — check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.hero}>
        <Text style={styles.coin}>💰</Text>
        <Text
          variant="displaySmall"
          style={[styles.title, { color: theme.colors.primary }]}
        >
          PayDirt
        </Text>
        <Text style={[styles.tagline, { color: theme.colors.onSurfaceVariant }]}>
          DO. THE. THING.
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          mode="outlined"
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          mode="outlined"
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        {error ? (
          <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
        ) : null}
        <Button
          mode="contained"
          onPress={submit}
          loading={busy}
          disabled={busy || !email.trim() || !password}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          Sign in
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 28 },
  hero: { alignItems: "center", marginBottom: 40 },
  coin: { fontSize: 72, marginBottom: 8 },
  title: { fontWeight: "900", letterSpacing: -1 },
  tagline: { fontSize: 12, fontWeight: "700", letterSpacing: 5, marginTop: 6 },
  form: { gap: 14 },
  error: { fontSize: 14 },
  button: { marginTop: 4, borderRadius: 16 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
});
