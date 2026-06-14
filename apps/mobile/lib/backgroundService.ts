import BackgroundActions from "react-native-background-actions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { showLocalNotification } from "./notifications";

const LAST_CHECKED_KEY = "bg_last_checked";
const SHOWN_IDS_KEY = "bg_shown_ids";
const PB_URL_KEY = "pb_url";
const POLL_INTERVAL_MS = 30_000;

type AuthModel = {
  id: string;
  household: string;
  role: string;
  display_name: string;
};

type AuthPayload = {
  token: string;
  model: AuthModel;
};

async function getAuth(): Promise<AuthPayload | null> {
  const raw = await AsyncStorage.getItem("pb_auth");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthPayload;
  } catch {
    return null;
  }
}

async function getShownIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(SHOWN_IDS_KEY);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function markShown(id: string, shownIds: Set<string>) {
  shownIds.add(id);
  await AsyncStorage.setItem(
    SHOWN_IDS_KEY,
    JSON.stringify([...shownIds].slice(-200)),
  );
}

// PocketBase stores dates as "YYYY-MM-DD HH:MM:SS.mmmZ"
function pbDate(iso: string): string {
  return iso.replace("T", " ").slice(0, 19);
}

async function poll(pbUrl: string, auth: AuthPayload) {
  // Don't interrupt the user when they're actively looking at the app.
  if (AppState.currentState === "active") return;

  const { token, model } = auth;
  const { id: kidId, household: householdId } = model;

  const lastChecked = (await AsyncStorage.getItem(LAST_CHECKED_KEY)) ?? new Date(0).toISOString();
  const shownIds = await getShownIds();
  const now = new Date().toISOString();
  const since = pbDate(lastChecked);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // ── New / updated assignments ─────────────────────────────────────────────
  try {
    const f = encodeURIComponent(`child = "${kidId}" && updated > "${since}"`);
    const res = await fetch(
      `${pbUrl}/api/collections/assignments/records?filter=${f}&sort=-updated&perPage=10&expand=chore`,
      { headers },
    );
    if (res.ok) {
      const { items } = (await res.json()) as { items: Array<Record<string, unknown>> };
      for (const a of items) {
        const expand = a.expand as Record<string, Record<string, unknown>> | undefined;
        const choreName = (expand?.chore?.name as string | undefined) ?? "a chore";
        const status = a.status as string;
        const id = a.id as string;

        if (status === "approved") {
          const nid = `a-${id}-approved`;
          if (!shownIds.has(nid)) {
            await showLocalNotification("Chore approved! ✅", `${choreName} — nice work!`);
            await markShown(nid, shownIds);
          }
        } else if (status === "rejected") {
          const nid = `a-${id}-rejected`;
          if (!shownIds.has(nid)) {
            const msg = (a.rejection_message as string | undefined) ?? "";
            await showLocalNotification(
              "Chore needs a redo",
              msg ? `${choreName}: ${msg}` : choreName,
            );
            await markShown(nid, shownIds);
          }
        } else if (status === "assigned") {
          const nid = `a-${id}-assigned`;
          if (!shownIds.has(nid)) {
            await showLocalNotification("New chore assigned", choreName);
            await markShown(nid, shownIds);
          }
        }

        // Reaction from parent
        const reaction = a.reaction as string | undefined;
        if (reaction) {
          const nid = `a-${id}-reaction-${reaction}`;
          if (!shownIds.has(nid)) {
            await showLocalNotification(`${reaction} from Mom/Dad`, choreName);
            await markShown(nid, shownIds);
          }
        }
      }
    }
  } catch { /* network blip — try again next cycle */ }

  // ── New broadcasts ────────────────────────────────────────────────────────
  try {
    const f = encodeURIComponent(`household = "${householdId}" && created > "${since}"`);
    const res = await fetch(
      `${pbUrl}/api/collections/broadcasts/records?filter=${f}&sort=-created&perPage=5`,
      { headers },
    );
    if (res.ok) {
      const { items } = (await res.json()) as { items: Array<Record<string, unknown>> };
      for (const b of items) {
        const nid = `bc-${b.id as string}`;
        if (!shownIds.has(nid)) {
          await showLocalNotification("Message from Mom/Dad 📣", b.message as string);
          await markShown(nid, shownIds);
        }
      }
    }
  } catch { /* network blip */ }

  // ── Spend request resolutions ─────────────────────────────────────────────
  try {
    const f = encodeURIComponent(
      `child = "${kidId}" && status != "pending" && updated > "${since}"`,
    );
    const res = await fetch(
      `${pbUrl}/api/collections/spend_requests/records?filter=${f}&sort=-updated&perPage=5`,
      { headers },
    );
    if (res.ok) {
      const { items } = (await res.json()) as { items: Array<Record<string, unknown>> };
      for (const s of items) {
        const nid = `sr-${s.id as string}-${s.status as string}`;
        if (!shownIds.has(nid)) {
          const desc = s.description as string;
          if (s.status === "approved") {
            await showLocalNotification("Spend approved! 🎉", desc);
          } else if (s.status === "denied") {
            await showLocalNotification("Spend denied", desc);
          }
          await markShown(nid, shownIds);
        }
      }
    }
  } catch { /* network blip */ }

  // ── Proposal resolutions ──────────────────────────────────────────────────
  try {
    const f = encodeURIComponent(
      `child = "${kidId}" && status != "pending" && updated > "${since}"`,
    );
    const res = await fetch(
      `${pbUrl}/api/collections/chore_proposals/records?filter=${f}&sort=-updated&perPage=5`,
      { headers },
    );
    if (res.ok) {
      const { items } = (await res.json()) as { items: Array<Record<string, unknown>> };
      for (const p of items) {
        const nid = `cp-${p.id as string}-${p.status as string}`;
        if (!shownIds.has(nid)) {
          const name = p.name as string;
          if (p.status === "approved") {
            await showLocalNotification("Chore idea approved! 🎉", `${name} — it's on your list`);
          } else if (p.status === "declined") {
            await showLocalNotification("Chore idea declined", name);
          }
          await markShown(nid, shownIds);
        }
      }
    }
  } catch { /* network blip */ }

  await AsyncStorage.setItem(LAST_CHECKED_KEY, now);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const taskFunction = async () => {
  const pbUrl = (await AsyncStorage.getItem(PB_URL_KEY)) ?? "http://10.0.2.2:8090";
  while (BackgroundActions.isRunning()) {
    const auth = await getAuth();
    if (auth?.model.role === "child") {
      await poll(pbUrl, auth);
    }
    await sleep(POLL_INTERVAL_MS);
  }
};

export async function storePbUrl(url: string) {
  await AsyncStorage.setItem(PB_URL_KEY, url);
}

export async function startBackgroundService() {
  if (BackgroundActions.isRunning()) return;
  await BackgroundActions.start(taskFunction, {
    taskName: "PayDirtNotifications",
    taskTitle: "PayDirt",
    taskDesc: "Watching for chore updates",
    taskIcon: { name: "ic_launcher", type: "mipmap" },
    color: "#2f7d4f",
    linkingURI: "io.paydirt.app://",
    progressBar: { max: 0, value: 0, indeterminate: false },
    foregroundServiceType: ["dataSync"],
  });
}

export async function stopBackgroundService() {
  if (!BackgroundActions.isRunning()) return;
  await BackgroundActions.stop();
}
