import { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { Button, Dialog, Portal, Text, TextInput } from "react-native-paper";
import type { User } from "@paydirt/shared";
import {
  DEFAULT_CONFIG,
  buildSubscribeLink,
  buildTestUrl,
  ensureTopic,
  getNtfyConfig,
  setNtfySetupDone,
} from "../lib/ntfy-onboarding";
import { requestNtfyRegistration, waitForUnifiedPushEndpoint } from "../lib/unifiedpush";
import { client } from "../lib/client";

type Step = "install" | "subscribe" | "test" | "up";

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
  const isParent = user.role !== "child";
  const [step, setStep] = useState<Step>("install");
  const [usePublic, setUsePublic] = useState(true);
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setError("");
    setTopic(ensureTopic(user.ntfy_topic));
    void getNtfyConfig().then((c) => {
      const ep = c.endpoint || DEFAULT_CONFIG.endpoint;
      const isDefault = ep === DEFAULT_CONFIG.endpoint;
      setUsePublic(isDefault);
      setCustomEndpoint(isDefault ? "" : ep);
    });
    void Linking.canOpenURL("ntfy://").then((ok) => {
      setStep(ok ? (isParent ? "subscribe" : "up") : "install");
    });
  }, [visible, user.ntfy_topic, isParent]);

  const activeEndpoint = usePublic ? DEFAULT_CONFIG.endpoint : customEndpoint || DEFAULT_CONFIG.endpoint;

  // Parent topics live on the user record (PocketBase hooks publish there) —
  // a freshly generated topic must be saved or real notifications go nowhere.
  async function saveTopicIfNew() {
    if (user.ntfy_topic?.trim()) return;
    try {
      await client.pb.collection("users").update(user.id, { ntfy_topic: topic });
    } catch {
      setError("Couldn't save your topic to the account — will retry on the next step.");
    }
  }

  async function recheckInstalled() {
    const ok = await Linking.canOpenURL("ntfy://");
    if (!ok) {
      setError("ntfy wasn't detected yet — give it a minute after installing, then tap again.");
      return;
    }
    setStep(isParent ? "subscribe" : "up");
  }

  async function openSubscribeLink() {
    await saveTopicIfNew();
    setError("");
    try {
      await Linking.openURL(buildSubscribeLink(activeEndpoint, topic));
    } catch {
      setError("Couldn't open the ntfy app — install it first, then try again.");
    }
  }

  async function sendTest() {
    setBusy(true);
    setError("");
    try {
      await saveTopicIfNew();
      const res = await fetch(buildTestUrl(activeEndpoint, topic), {
        method: "POST",
        body: "PayDirt test — if you see this, notifications work.",
        headers: { Title: "PayDirt test" },
      });
      if (!res.ok) throw new Error(`ntfy responded ${res.status}`);
    } catch (e) {
      setError(
        `Test send failed (${String(e)}). Notifications need internet — check Wi-Fi, then retry.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    await setNtfySetupDone(activeEndpoint);
    onComplete();
  }

  async function checkUp() {
    setBusy(true);
    setError("");
    // Re-send REGISTER (startup-only registration races ntfy install/approval),
    // then poll — ntfy answers the broadcast asynchronously.
    await requestNtfyRegistration();
    const ok = await waitForUnifiedPushEndpoint(user.id);
    setBusy(false);
    if (ok) await finish();
    else
      setError(
        "Still not connected. Make sure the ntfy app is installed and open, then tap Check connection again. If it still fails, check that Android Settings › Apps › ntfy › Battery allows background usage.",
      );
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={() => {}} style={styles.dialog}>
        {step === "install" && (
          <>
            <Dialog.Title>Install ntfy for Notifications</Dialog.Title>
            <Dialog.Content>
              <Text>
                {isParent
                  ? "PayDirt uses the free ntfy app to push chore approvals, spend requests, and household broadcasts to this device."
                  : "PayDirt needs the ntfy app to receive notifications about new chores and approvals."}
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

        {step === "subscribe" && isParent && (
          <>
            <Dialog.Title>Subscribe to your topic</Dialog.Title>
            <Dialog.Content>
              <ScrollView>
                <Text>
                  Tap below — the ntfy app opens your topic and subscribes automatically. Then
                  continue to the test.
                </Text>
                <Text style={styles.label}>Your topic</Text>
                <Text style={styles.topic}>{topic}</Text>
                <View style={styles.serverRow}>
                  <Button
                    mode={usePublic ? "contained" : "outlined"}
                    onPress={() => setUsePublic(true)}
                    compact
                  >
                    ntfy.sh
                  </Button>
                  <Button
                    mode={!usePublic ? "contained" : "outlined"}
                    onPress={() => setUsePublic(false)}
                    compact
                  >
                    Custom
                  </Button>
                </View>
                {!usePublic && (
                  <TextInput
                    label="Server URL"
                    value={customEndpoint}
                    onChangeText={setCustomEndpoint}
                    placeholder="https://ntfy.example.com"
                    mode="outlined"
                    style={styles.input}
                  />
                )}
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </ScrollView>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={onDismiss}>Maybe later</Button>
              <Button onPress={() => setStep("install")}>Back</Button>
              <Button onPress={openSubscribeLink}>Open ntfy &amp; subscribe</Button>
              <Button mode="contained" onPress={() => setStep("test")}>
                Continue
              </Button>
            </Dialog.Actions>
          </>
        )}

        {step === "test" && isParent && (
          <>
            <Dialog.Title>Test it</Dialog.Title>
            <Dialog.Content>
              <Text>
                Send a test notification. If you subscribed on the previous screen, it should pop
                up on this device within a second or two.
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setStep("subscribe")}>Back</Button>
              <Button onPress={sendTest} disabled={busy}>
                {busy ? "Sending…" : "Send test"}
              </Button>
              <Button mode="contained" onPress={finish}>
                I got it — done
              </Button>
            </Dialog.Actions>
          </>
        )}

        {step === "up" && !isParent && (
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
  label: {
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 4,
  },
  topic: {
    fontFamily: "monospace",
    fontSize: 15,
    marginBottom: 10,
  },
  serverRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  input: {
    marginTop: 8,
    marginBottom: 4,
  },
  error: {
    color: "#b3261e",
    marginTop: 10,
    fontSize: 13,
  },
});
