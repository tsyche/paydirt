import { useEffect, useReducer, useRef, useState } from "react";
import { Alert, AppState, Linking, NativeEventEmitter, NativeModules, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Button, Dialog, PaperProvider, Portal, ProgressBar, Text } from "react-native-paper";
import {
  useFonts,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";
import type { User } from "@paydirt/shared";
import { client, pbUrl } from "./lib/client";
import { describeDownloadFailure, takeUpdateFailure, fetchLatestVersion, getInstalledVersionCode, hasReadyUpdate, installDownloadedUpdate, justUpdated, shouldUpdate, startUpdateDownload, takeInstallPending } from "./lib/appUpdate";
import { IDLE, dialogVisible, updateReducer } from "./lib/updateFlow";
import { Login } from "./screens/Login";
import { KidHome } from "./screens/KidHome";
import { SimpleKidHome } from "./screens/SimpleKidHome";
import { ParentHome } from "./screens/ParentHome";
import { AppearanceProvider, useAppearance } from "./lib/appearance";
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
import { parseNotificationType } from "./lib/deepLinks";
import { NtfySetup } from "./components/NtfySetup";

// A notification tap, tagged with a nonce so the same type/tab re-triggers navigation
// even if it's identical to the last one (e.g. two "spend_approved" taps in a row).
type NotificationRoute = { type: string | null; nonce: number };

const LAST_VERSION_KEY = "paydirt-last-version-code";
const UPDATE_POLL_MS = 15 * 60 * 1000;

function AppContent() {
  const { theme, scheme } = useAppearance();
  const [fontsLoaded] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  // Set once the login-time endpoint sync has run, so the setup banner doesn't
  // flash for users whose endpoint is already registered.
  const [ntfySetupLoaded, setNtfySetupLoaded] = useState(false);
  const [ntfySetupVisible, setNtfySetupVisible] = useState(false);
  const [notificationRoute, setNotificationRoute] = useState<NotificationRoute | null>(null);
  // In-app update: the download runs in-process (not DownloadManager, which can't
  // reach LAN hosts on Android 17); this dialog shows progress and the Install button.
  const [upd, dispatchUpd] = useReducer(updateReducer, IDLE);
  const [updHidden, setUpdHidden] = useState(false);
  const updRef = useRef(upd);
  updRef.current = upd;
  const updUrlRef = useRef("");

  function beginUpdate(url: string) {
    updUrlRef.current = url;
    setUpdHidden(false);
    dispatchUpd({ type: "start" });
    void startUpdateDownload(url).then((started) => {
      // false + still "downloading" with no native download means it never started.
      if (!started && updRef.current.phase === "downloading" && updRef.current.percent === 0) {
        dispatchUpd({ type: "failed", reason: 1 });
      }
    });
  }

  async function installNow() {
    const r = await installDownloadedUpdate();
    if (r === "permission") {
      Alert.alert("Allow installs", "Turn on 'Allow from this source' for PayDirt, go back, then tap Install again.");
    } else if (r === "missing" || r === "error") {
      dispatchUpd({ type: "failed", reason: 1 });
    }
  }

  useEffect(() => {
    // One-time setup: notification channels, store the PB URL so the background
    // service can read it after the app is killed. The permission prompt waits
    // for sign-in (below): asking at launch put the system dialog on top of the
    // first frame and stole window focus (ANR "waiting for FocusEvent").
    setupNotificationChannels();
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

  useEffect(() => {
    if (user) void requestNotificationPermissions();
  }, [user?.id]);

  // Notification deep links: UnifiedPushReceiver.kt attaches a paydirt://notification
  // PendingIntent to each Android notification. getInitialURL covers a cold start (app
  // launched by the tap); the "url" listener covers a warm start (app already running,
  // relies on MainActivity.onNewIntent forwarding the new intent).
  useEffect(() => {
    function handleUrl(url: string | null | undefined) {
      if (!url?.startsWith("paydirt://")) return;
      setNotificationRoute({ type: parseNotificationType(url), nonce: Date.now() });
    }

    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // After an in-app update the process is killed and relaunched by the user;
  // confirm the new build is the one running.
  useEffect(() => {
    void (async () => {
      const installed = await getInstalledVersionCode();
      if (!installed) return;
      try {
        const raw = await AsyncStorage.getItem(LAST_VERSION_KEY);
        const last = raw === null ? null : Number(raw);
        if (justUpdated(last, installed)) {
          Alert.alert("PayDirt updated", `You're now on build ${installed}.`);
        }
        await AsyncStorage.setItem(LAST_VERSION_KEY, String(installed));
      } catch {
        // storage unavailable: skip the announcement
      }
    })();
  }, []);

  // Tier 2 app auto-update: check for a newer native APK on start, on resume,
  // and every UPDATE_POLL_MS while foregrounded; prompt to download + install
  // whenever one is available. `prompting` keeps alerts from stacking.
  useEffect(() => {
    let cancelled = false;
    let prompting = false;
    const emitter = NativeModules.PayDirtNative ? new NativeEventEmitter(NativeModules.PayDirtNative) : null;
    const subs = [
      emitter?.addListener("PayDirtUpdateProgress", (p: number) => dispatchUpd({ type: "progress", percent: p })),
      emitter?.addListener("PayDirtUpdateReady", () => { setUpdHidden(false); dispatchUpd({ type: "ready" }); }),
      emitter?.addListener("PayDirtUpdateFailed", (r: number) => {
        void takeUpdateFailure(); // clear the stored copy so it doesn't show twice
        setUpdHidden(false);
        dispatchUpd({ type: "failed", reason: r });
      }),
    ];
    // A finished download can outlive the app process (granting "Install unknown apps"
    // often restarts it): restore the ready dialog, and continue the install if the
    // user was just sent to the permission screen. True = an update is already staged.
    async function resume(): Promise<boolean> {
      let staged = updRef.current.phase === "ready";
      if (updRef.current.phase === "idle" && (await hasReadyUpdate())) {
        staged = true;
        setUpdHidden(false);
        dispatchUpd({ type: "ready" });
      }
      if (staged && (await takeInstallPending())) await installNow();
      return staged;
    }
    async function check() {
      if (prompting || updRef.current.phase !== "idle") return;
      const latest = await fetchLatestVersion(pbUrl);
      if (cancelled || prompting || !latest || !latest.downloadUrl) return;
      const installed = await getInstalledVersionCode();
      if (!shouldUpdate(installed, latest.versionCode)) return;
      prompting = true;
      Alert.alert(
        "Update available",
        `PayDirt ${latest.versionName} is available. Download and install now?`,
        [
          { text: "Later", style: "cancel", onPress: () => { prompting = false; } },
          {
            text: "Update",
            onPress: () => {
              prompting = false;
              beginUpdate(latest.downloadUrl);
            },
          },
        ],
        { onDismiss: () => { prompting = false; } },
      );
    }
    void resume().then((staged) => { if (!staged) void check(); });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void check();
    }, UPDATE_POLL_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      setUpdHidden(false); // bring a hidden "ready" dialog back on return
      void takeUpdateFailure().then((r) => { if (r) dispatchUpd({ type: "failed", reason: r }); });
      void resume().then((staged) => { if (!staged) void check(); });
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
      subs.forEach((x) => x?.remove());
    };
  }, []);

  // Notification setup is done when the server holds this user's UnifiedPush
  // endpoint (users.up_endpoint) — same rule for every role. Kids additionally
  // fall back to the polling service until an endpoint exists.
  // Deps are the id/role values, not the user object: updating the user's own
  // auth record (up_endpoint sync) makes the SDK fire authStore.onChange with
  // a NEW user object, and depending on [user] identity re-ran this effect →
  // endless update/reload loop.
  const userId = user?.id;
  const userRole = user?.role;
  useEffect(() => {
    if (!userId) {
      setNtfySetupLoaded(false);
      void stopBackgroundService();
      return;
    }
    void syncUnifiedPushEndpoint(userId).then((hasUp) => {
      setNtfySetupLoaded(true);
      if (!hasUp) setNtfySetupVisible(true);
      if (userRole !== "child") return;
      if (hasUp) void stopBackgroundService();
      else void startBackgroundService();
    });
  }, [userId, userRole]);

  function logout() {
    client.logout();
    void stopBackgroundService();
    setUser(null);
  }

  const ntfySetupNeeded = !!user && ntfySetupLoaded && !user.up_endpoint;

  function renderScreen() {
    if (!ready || !fontsLoaded) return null;
    if (!user) return <Login onLogin={setUser} />;
    if (user.role === "child") {
      return user.simplified_mode
        ? <SimpleKidHome user={user} onLogout={logout} />
        : <KidHome user={user} onLogout={logout} notificationRoute={notificationRoute} />;
    }
    return <ParentHome
      user={user}
      onLogout={logout}
      notificationRoute={notificationRoute}
      notificationSetupNeeded={ntfySetupNeeded}
      onOpenNotificationSetup={() => setNtfySetupVisible(true)}
    />;
  }

  return (
    <PaperProvider theme={theme}>
      {/* Paint the screen background: without it the native window colour (dark
          under a dark system theme) shows through behind the in-app light theme. */}
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {renderScreen()}
      </View>
      {user && ntfySetupNeeded && ntfySetupVisible && (
        <NtfySetup
          visible
          user={user}
          onComplete={() => {
            setNtfySetupVisible(false);
          }}
          onDismiss={() => setNtfySetupVisible(false)}
        />
      )}
      <Portal>
        <Dialog
          visible={dialogVisible(upd, updHidden)}
          onDismiss={() => (upd.phase === "downloading" ? setUpdHidden(true) : dispatchUpd({ type: "dismiss" }))}
        >
          <Dialog.Title>
            {upd.phase === "ready" ? "Update ready" : upd.phase === "failed" ? "Update failed" : "Downloading update"}
          </Dialog.Title>
          <Dialog.Content>
            {upd.phase === "downloading" && (
              <>
                <ProgressBar progress={upd.percent / 100} style={{ marginBottom: 12 }} />
                <Text>{upd.percent}%. You can keep using the app while this finishes.</Text>
              </>
            )}
            {upd.phase === "ready" && <Text>Tap Install, then reopen PayDirt when it finishes.</Text>}
            {upd.phase === "failed" && <Text>{describeDownloadFailure(upd.reason)}</Text>}
          </Dialog.Content>
          <Dialog.Actions>
            {upd.phase === "downloading" && <Button onPress={() => setUpdHidden(true)}>Hide</Button>}
            {upd.phase === "ready" && (
              <>
                <Button onPress={() => setUpdHidden(true)}>Later</Button>
                <Button mode="contained" onPress={() => void installNow()}>Install</Button>
              </>
            )}
            {upd.phase === "failed" && (
              <>
                <Button onPress={() => dispatchUpd({ type: "dismiss" })}>Close</Button>
                {updUrlRef.current !== "" && <Button onPress={() => beginUpdate(updUrlRef.current)}>Try again</Button>}
              </>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <AppContent />
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}
