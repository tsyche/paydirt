import { View, StyleSheet } from "react-native";
import { Text, Button, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export function ParentNotice({ onLogout }: { onLogout: () => void }) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.hero}>
        <Text style={styles.icon}>🖥️</Text>
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: theme.colors.onBackground }]}
        >
          Use the dashboard
        </Text>
        <Text style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
          The full parent experience lives at the PayDirt web dashboard — approvals, chores, and household settings.
        </Text>
        <Text style={[styles.soon, { color: theme.colors.primary }]}>
          Parent tools in the app are coming soon.
        </Text>
      </View>
      <Button
        mode="outlined"
        onPress={onLogout}
        style={styles.button}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Sign out
      </Button>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 32 },
  hero: { alignItems: "center", gap: 12, marginBottom: 36 },
  icon: { fontSize: 80, marginBottom: 4 },
  title: { textAlign: "center", fontWeight: "800" },
  body: { textAlign: "center", fontSize: 15, lineHeight: 23, opacity: 0.85 },
  soon: { textAlign: "center", fontSize: 13, fontWeight: "700", opacity: 0.9 },
  button: { borderRadius: 16 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontWeight: "600" },
});
