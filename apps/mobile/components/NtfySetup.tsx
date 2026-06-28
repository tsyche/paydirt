import { useState, useEffect } from "react";
import { View, Linking, StyleSheet } from "react-native";
import { Dialog, Portal, Button, Text, TextInput } from "react-native-paper";
import { getNtfyConfig, setNtfySetupDone } from "../lib/ntfy-onboarding";

type Step = "check" | "install" | "configure";

export function NtfySetup({ onComplete }: { onComplete: () => void }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>("check");
  const [endpoint, setEndpoint] = useState("https://ntfy.sh");
  const [usePublic, setUsePublic] = useState(true);

  useEffect(() => {
    checkSetupNeeded();
  }, []);

  async function checkSetupNeeded() {
    const config = await getNtfyConfig();
    if (config.isSetup) {
      onComplete();
      return;
    }
    // Check if ntfy app is installed
    const ntfyInstalled = await Linking.canOpenURL("ntfy://");
    setVisible(true);
    setStep(ntfyInstalled ? "configure" : "install");
  }

  async function handleInstallClick() {
    await Linking.openURL(
      "https://play.google.com/store/apps/details?id=io.heckel.ntfy"
    );
    // After user installs and returns, move to configure
    setTimeout(() => setStep("configure"), 2000);
  }

  async function handleConfigureSave() {
    const finalEndpoint = usePublic ? "https://ntfy.sh" : endpoint;
    await setNtfySetupDone(finalEndpoint);
    setVisible(false);
    onComplete();
  }

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={() => {}} // Don't allow dismiss until complete
        style={styles.dialog}
      >
        {step === "install" && (
          <>
            <Dialog.Title>Install ntfy for Notifications</Dialog.Title>
            <Dialog.Content>
              <Text>
                PayDirt needs the ntfy app to receive push notifications about chore approvals and household broadcasts.
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={handleInstallClick}>Open Play Store</Button>
            </Dialog.Actions>
          </>
        )}

        {step === "configure" && (
          <>
            <Dialog.Title>Set Up Notifications</Dialog.Title>
            <Dialog.Content>
              <Text style={styles.label}>Notification Server</Text>
              <View style={styles.radioGroup}>
                <Button
                  mode={usePublic ? "contained" : "outlined"}
                  onPress={() => setUsePublic(true)}
                  style={styles.radioButton}
                >
                  Public (ntfy.sh)
                </Button>
                <Button
                  mode={!usePublic ? "contained" : "outlined"}
                  onPress={() => setUsePublic(false)}
                  style={styles.radioButton}
                >
                  Custom Server
                </Button>
              </View>

              {!usePublic && (
                <TextInput
                  label="Server URL"
                  value={endpoint}
                  onChangeText={setEndpoint}
                  placeholder="https://ntfy.example.com"
                  mode="outlined"
                  style={styles.input}
                />
              )}

              <Text style={styles.helperText}>
                {usePublic
                  ? "Using public ntfy.sh (no setup required). You can switch to a self-hosted server later."
                  : "You can change this to a self-hosted ntfy instance later."}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={handleConfigureSave}>Done</Button>
            </Dialog.Actions>
          </>
        )}
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 400,
  },
  label: {
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 8,
  },
  radioGroup: {
    flexDirection: "column",
    gap: 8,
    marginBottom: 16,
  },
  radioButton: {
    width: "100%",
  },
  input: {
    marginTop: 12,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 8,
  },
});
