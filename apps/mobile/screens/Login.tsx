import { useState } from "react";
import { StyleSheet } from "react-native";
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
    <SafeAreaView style={styles.container}>
      <Text variant="headlineLarge" style={styles.title}>
        PayDirt
      </Text>
      <Text variant="bodyMedium" style={styles.tagline}>
        Do. The. Thing.
      </Text>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      {error ? (
        <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
      ) : null}
      <Button
        mode="contained"
        onPress={submit}
        loading={busy}
        disabled={busy}
        style={styles.button}
      >
        Sign in
      </Button>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { textAlign: "center" },
  tagline: { textAlign: "center", marginBottom: 16, opacity: 0.6 },
  input: {},
  button: { marginTop: 8 },
  error: {},
});
