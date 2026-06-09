import { StyleSheet } from "react-native";
import { Text, Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

// Parents use the web dashboard for the MVP; a full parent mobile experience
// is a later phase.
export function ParentNotice({ onLogout }: { onLogout: () => void }) {
  return (
    <SafeAreaView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Parent account
      </Text>
      <Text style={styles.body}>
        For now, manage chores and approvals from the PayDirt web dashboard.
        Parent tools in the app are coming in a later phase.
      </Text>
      <Button mode="outlined" onPress={onLogout}>
        Sign out
      </Button>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  title: { textAlign: "center" },
  body: { textAlign: "center", opacity: 0.7 },
});
