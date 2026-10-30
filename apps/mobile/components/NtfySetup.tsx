import { useEffect, useState } from "react";
import { Linking, StyleSheet } from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import type { User } from "@paydirt/shared";
import { DEFAULT_CONFIG, setNtfySetupDone } from "../lib/ntfy-onboarding";
import { requestNtfyRegistration, waitForUnifiedPushEndpoint } from "../lib/unifiedpush";

type Step = "install" | "up";

// Same flow for every role: install ntfy → register a UnifiedPush endpoint with
// the server → send a test push through that endpoint.

export function NtfySetup({
  visible,
  user,
  onComplete,
  onDismiss,
}: {
  visible: boolean;
  user: User;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const [step, setStep] = useState<Step>("install");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setError("");
    void Linking.canOpenURL("ntfy://").then((ok) => setStep(ok ? "up" : "install"));
  }, [visible]);

  async function recheckInstalled() {
    const ok = await Linking.canOpenURL("ntfy://");
    if (!ok) {
      setError("ntfy wasn't detected yet — give it a minute after installing, then tap again.");
      return;
    }
    setError("");
    setStep("up");
  }

  async function checkUp() {
    setBusy(true);
    setError("");
    // Re-send REGISTER (startup-only registration races ntfy install/approval),
    // then poll — ntfy answers the broadcast asynchronously.
    await requestNtfyRegistration();
    const ok = await waitForUnifiedPushEndpoint(user.id);
    setBusy(false);
    if (!ok) {
      setError(
        "Still not connected. Make sure the ntfy app is installed and open, then tap Check connection again. If it still fails, check that Android Settings › Apps › ntfy › Battery allows background usage.",
      );
      return;
    }
    await setNtfySetupDone(DEFAULT_CONFIG.endpoint);
    onComplete();
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={() => {}} style={styles.dialog}>
        {step === "install" && (
          <>
            <Dialog.Title>Install ntfy for Notifications</Dialog.Title>
            <Dialog.Content>
              <Text>
                PayDirt uses the free ntfy app to push chore updates, approvals, and messages to
                this device.
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={onDismiss}>Maybe later</Button>
              <Button onPress={recheckInstalled}>I installed it</Button>
              <Button onPress={() => Linking.openURL("https://f-droid.org/packages/io.heckel.ntfy/")}>
                F-Droid
              </Button>
              <Button
                onPress={() =>
                  Linking.openURL("https://play.google.com/store/apps/details?id=io.heckel.ntfy")
                }
              >
                Play Store
              </Button>
            </Dialog.Actions>
          </>
        )}

        {step === "up" && (
          <>
            <Dialog.Title>Notifications</Dialog.Title>
            <Dialog.Content>
              <Text>
                PayDirt receives push notifications through the ntfy app (UnifiedPush). Keep ntfy
                installed — nothing else to configure inside it. For notifications to arrive
                reliably, set ntfy's battery usage to "Unrestricted" in Android settings.
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={onDismiss}>Maybe later</Button>
              <Button
                onPress={() =>
                  Linking.openURL(
                    "intent://#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;package=io.heckel.ntfy;end",
                  ).catch(() => Linking.openSettings())
                }
              >
                Battery settings
              </Button>
              <Button mode="contained" onPress={checkUp} disabled={busy}>
                {busy ? "Checking…" : "Check connection"}
              </Button>
            </Dialog.Actions>
          </>
        )}
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 440,
  },
  error: {
    color: "#b3261e",
    marginTop: 10,
    fontSize: 13,
  },
});
