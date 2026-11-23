import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { PaydirtClient, currencyDisplayName } from "@paydirt/shared";
import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => storage.get(key) || null,
  setItem: async (key: string, value: string) => { storage.set(key, value); },
  removeItem: async (key: string) => { storage.delete(key); },
} }));
vi.mock("react-native-sse", async () => ({ default: (await import("eventsource")).EventSource }));
vi.mock("react-native", () => {
  const Container = ({ children, ...props }: { children?: ReactNode }) => createElement("div", props, children);
  return {
    AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
    AccessibilityInfo: { isReduceMotionEnabled: async () => true },
    Animated: { Value: class { setValue() {} } }, Easing: {}, Alert: { alert: vi.fn() },
    Image: Container, View: Container, ScrollView: Container, RefreshControl: Container,
    Pressable: ({ children, ...props }: { children: ReactNode | ((state: { pressed: boolean }) => ReactNode) }) =>
      createElement("button", props, typeof children === "function" ? children({ pressed: false }) : children),
    TouchableOpacity: Container,
    StyleSheet: { create: (s: unknown) => s },
  };
});
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => createElement("div", null, children) }));
vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
vi.mock("@react-native-community/datetimepicker", () => ({ DateTimePickerAndroid: { open() {} } }));
vi.mock("expo-notifications", () => ({ cancelScheduledNotificationAsync: vi.fn(async () => {}) }));
vi.mock("expo-image-picker", () => ({}));
vi.mock("expo-file-system/legacy", () => ({}));
vi.mock("react-native-paper", () => {
  const Container = ({ children, ...props }: { children?: ReactNode }) => createElement("section", props, children);
  const Button = (props: object) => createElement("button", props);
  return {
    Portal: Container, Appbar: { Header: Container, BackAction: Button, Content: Container },
    Dialog: Object.assign(({ visible, children }: { visible: boolean; children?: ReactNode }) => visible ? createElement("section", null, children) : null,
      { Title: Container, Content: Container, Actions: Container }),
    TextInput: Object.assign((props: object) => createElement("input", props), { Icon: () => null, Affix: () => null }),
    Card: Object.assign(Container, { Content: Container }), Text: Container, Button, IconButton: Button,
    Chip: Container, ProgressBar: () => null, Switch: (props: object) => createElement("input", props),
    Snackbar: Container, Banner: () => null,
    useTheme: () => ({ colors: { primary: "#123456", error: "#aa0000", secondaryContainer: "#eeeeee" } }),
  };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Only native/platform adapters are faked. The real parent control, client,
// PocketBase hooks and ledger handle each bonus/deduction.
describe("Native dollar bonuses and deductions", () => {
  const repo = resolve(import.meta.dirname, "../../..");
  const root = mkdtempSync(join(tmpdir(), "paydirt-dollar-native-"));
  const queue = join(root, "familylink");
  let server: ChildProcess | undefined;
  let parent: PaydirtClient;
  let kid: PaydirtClient;
  let url: string;
  let target: string;
  let stopReachability: () => void;
  let DeliverNowButton: typeof import("./DeliverNowButton").DeliverNowButton;
  let KidDetail: typeof import("./KidDetail").KidDetail;
  beforeAll(async () => {
    const reservation = createServer();
    await new Promise<void>((done) => reservation.listen(0, "127.0.0.1", done));
    const port = (reservation.address() as { port: number }).port;
    await new Promise<void>((done) => reservation.close(() => done()));
    url = `http://127.0.0.1:${port}`;
    const hooks = join(root, "hooks");
    cpSync(join(repo, "pocketbase/pb_hooks"), hooks, { recursive: true });
    const binary = join(repo, "pocketbase/pocketbase");
    const args = ["--dir", join(root, "data"), "--migrationsDir", join(repo, "pocketbase/pb_migrations")];
    execFileSync(binary, ["migrate", "up", ...args], { stdio: "ignore" });
    execFileSync(binary, ["superuser", "upsert", "admin@paydirt.local", "password123", ...args], { stdio: "ignore" });
    server = spawn(binary, ["serve", ...args, "--hooksDir", hooks, "--http", `127.0.0.1:${port}`], {
      stdio: "ignore",
      env: { ...process.env, NTFY_DISABLED: "1", FL_AUTOMATION_ENABLED: "1", FL_QUEUE_DIR: queue },
    });
    let healthy = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { healthy = (await fetch(`${url}/api/health`)).ok; } catch { /* Startup. */ }
      if (healthy) break;
      await new Promise((done) => setTimeout(done, 100));
    }
    if (!healthy) throw new Error("Isolated PocketBase did not start");
    execFileSync(process.execPath, [join(repo, "pocketbase/seed.mjs")], {
      stdio: "ignore", env: { ...process.env, PB_URL: url },
    });
    parent = new PaydirtClient(url);
    vi.stubEnv("EXPO_PUBLIC_POCKETBASE_URL", url);
    const mobile = await import("../lib/client");
    stopReachability = mobile.reachability.stop;
    kid = mobile.client;
    DeliverNowButton = (await import("./DeliverNowButton")).DeliverNowButton;
    KidDetail = (await import("./KidDetail")).KidDetail;
    await parent.login("parent1@test.local", "password123");
    await kid.login("parent1@test.local", "password123");
    target = (await parent.listChildren(parent.currentUser!.household))[0]!.id;
    await parent.pb.collection("users").update(target, { goods_rate: 44 });
    await parent.pb.collection("households").update(parent.currentUser!.household, { goods_rate: 88, grant_weekday_window: "none", grant_weekend_window: "none" });
  }, 20_000);

  afterAll(async () => {
    stopReachability?.();
    await kid?.pb.realtime.unsubscribe();
    vi.unstubAllEnvs();
    if (server && server.exitCode === null) {
      const exited = new Promise<void>((done) => server!.once("exit", () => done()));
      server.kill();
      await exited;
    }
    rmSync(root, { recursive: true, force: true });
  });
  function text(view: ReactTestRenderer): string {
    function flatten(node: unknown): string {
      if (typeof node === "string" || typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(flatten).join(" ");
      return node && typeof node === "object" ? flatten((node as { children?: unknown }).children) : "";
    }
    return flatten(view.toJSON()).replace(/\s+/g, " ");
  }
  async function settle(view: ReactTestRenderer, value: string) {
    for (let i = 0; i < 100 && !text(view).includes(value); i++) {
      await act(async () => { await new Promise((done) => setTimeout(done, 20)); });
    }
    expect(text(view)).toContain(value);
  }
  const button = (view: ReactTestRenderer, label: string) => view.root.findAllByType("button").find((node) => node.props.children === label)!;

  it("confirms and queues a parent override from the native button", async () => {
    await parent.pb.collection("users").update(target, { fl_child_id: "123456789012", fl_device_id: "a".repeat(30) });
    const grant = await parent.giveBonusMinutes(target, 15, "Holiday native override", "native_holiday_override");
    const balance = await parent.getBalance(target);
    let refreshed = 0;
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(DeliverNowButton, { id: grant.id, collection: "time_grants", onQueued: () => { refreshed++; } })); });
    try {
      await act(async () => button(view, "Deliver now").props.onPress());
      const alert = (await import("react-native")).Alert.alert;
      const buttons = vi.mocked(alert).mock.calls.at(-1)![2]!;
      expect(vi.mocked(alert).mock.calls.at(-1)![1]).toContain("regular schedule stays the same");
      await act(async () => { buttons.find((b) => b.text === "Deliver now")!.onPress!(); });
      await settle(view, "Delivery override enabled");
      const actual = await parent.pb.collection("time_grants").getOne(grant.id);
      expect(actual.grant_window_override).toBe(true);
      expect(actual.grant_status).toBe("queued");
      expect(refreshed).toBe(1);
      expect(await parent.getBalance(target)).toBe(balance);
    } finally { await act(async () => view.unmount()); }
  });

  it("saves dollar bonuses and deductions through the actual dialog and refreshes the kid's balance", async () => {
    const household = await parent.getHousehold(parent.currentUser!.household);
    const before = await parent.getBalance(target);
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(KidDetail, { kidId: target, household, onClose() {} })); });
    try {
      await settle(view, "Bonus");
      for (const [action, amount, delta] of [["Bonus", "2.50", 110], ["Deduct", "2.49", -109.56]] as const) {
        const matching = view.root.findAllByType("button").find((node) => node.props.accessibilityLabel === action);
        expect(matching).toBeDefined();
        await act(async () => { matching!.props.onPress(); });
        await act(async () => { button(view, "Use dollars ($)").props.onPress(); });
        await act(async () => {
          view.root.findAllByType("input").find((node) => node.props.label === "Dollar amount ($)")!.props.onChangeText(amount);
          view.root.findAllByType("input").find((node) => node.props.label === "Reason")!.props.onChangeText(`Native dollar ${action}`);
        });
        await settle(view, `${Math.abs(delta)} ${currencyDisplayName(household)}`);
        const save = button(view, action === "Bonus" ? "Add" : "Deduct");
        expect(save.props.disabled).toBe(false);
        await act(async () => { save.props.onPress(); await new Promise((done) => setTimeout(done, 100)); });
        await settle(view, action === "Bonus" ? "Bonus added" : "Deducted.");
      }
      expect(await parent.getBalance(target)).toBeCloseTo(before + 0.44, 8);
      const rows = await parent.listTransactions(target);
      expect(rows.filter((row) => row.reason?.startsWith("Native dollar ")).map((row) => row.amount).sort((a, b) => a - b)).toEqual([-109.56, 110]);
    } finally { await act(async () => view.unmount()); }
  });
});
