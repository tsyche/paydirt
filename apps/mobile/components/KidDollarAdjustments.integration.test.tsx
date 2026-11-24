import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { processFamilyLinkQueue } from "../../../packages/shared/src/familylinkQueue";
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
    Animated: { Value: class { setValue() {} }, View: Container, spring: () => ({ start() {} }) }, PanResponder: { create: () => ({ panHandlers: {} }) }, BackHandler: { addEventListener: () => ({ remove() {} }) }, useWindowDimensions: () => ({ width: 400 }), useColorScheme: () => "light", Platform: { OS: "android" }, Text: Container, Modal: ({ visible, children }: { visible: boolean; children?: ReactNode }) => visible ? createElement("section", null, children) : null, Easing: {}, Alert: { alert: vi.fn() },
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
vi.mock("expo-device", () => ({ deviceType: 1, DeviceType: { TABLET: 2 } }));
vi.mock("expo-image-picker", () => ({}));
vi.mock("expo-file-system/legacy", () => ({}));
vi.mock("react-native-paper", () => {
  const Container = ({ children, ...props }: { children?: ReactNode }) => createElement("section", props, children);
  const Button = (props: object) => createElement("button", props);
  return {
    List: { Accordion: Container, Item: Container, Icon: Container, Section: Container }, Portal: Container, Appbar: { Header: Container, BackAction: Button, Content: Container, Action: Button }, BottomNavigation: { Bar: (props: object) => createElement("nav", props) }, Divider: Container, Icon: Container, Badge: Container, HelperText: Container, SegmentedButtons: (props: object) => createElement("select", props), Menu: Object.assign(({ visible, anchor, children }: { visible: boolean; anchor: ReactNode; children?: ReactNode }) => createElement("section", null, anchor, visible ? children : null), { Item: Button }),
    Dialog: Object.assign(({ visible, children }: { visible: boolean; children?: ReactNode }) => visible ? createElement("section", null, children) : null,
      { Title: Container, Content: Container, Actions: Container, ScrollArea: Container }),
    TextInput: Object.assign((props: object) => createElement("input", props), { Icon: () => null, Affix: () => null }),
    Card: Object.assign(Container, { Content: Container }), Text: Container, Button, IconButton: Button,
    Chip: Container, ProgressBar: () => null, Switch: (props: object) => createElement("input", props),
    Snackbar: Container, Banner: () => null,
    useTheme: () => ({ colors: { primary: "#123456", error: "#aa0000", secondaryContainer: "#eeeeee" } }),
  };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Only native/platform adapters are faked. The real parent control, client,
// PocketBase hooks and ledger handle the actual parent actions.
describe("Native parent controls (isolated PocketBase)", () => {
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
  let HouseholdSettings: typeof import("./HouseholdSettings").HouseholdSettings;
  let ParentHome: typeof import("../screens/ParentHome").ParentHome;
  let KidAppearanceCard: typeof import("./KidAppearanceCard").KidAppearanceCard;
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
    HouseholdSettings = (await import("./HouseholdSettings")).HouseholdSettings;
    ParentHome = (await import("../screens/ParentHome")).ParentHome;
    KidAppearanceCard = (await import("./KidAppearanceCard")).KidAppearanceCard;
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

  it("preserves the deadline time when editing a chore on mobile", async () => {
    const due = "2027-03-18T23:45:00.000Z";
    const chore = await parent.createChore({ household: parent.currentUser!.household, name: "Native deadline parity", active: true, reward: 5, type: "oneoff", due_at: due });
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(ParentHome, { user: kid.currentUser!, onLogout() {} })); });
    try {
      await act(async () => view.root.findByType("nav").props.onTabPress({ route: { key: "chores" } }));
      await settle(view, chore.name);
      await act(async () => view.root.findAllByType("button").find((n) => n.props.accessibilityLabel === `Edit ${chore.name}`)!.props.onPress());
      await act(async () => button(view, "Save").props.onPress());
      await settle(view, "Chore updated");
      expect(new Date((await parent.pb.collection("chores").getOne(chore.id)).due_at).toISOString()).toBe(due);
    } finally { await act(async () => view.unmount()); await parent.pb.collection("chores").delete(chore.id); }
  });

  it("does not carry a draft deadline into a native template", async () => {
    const template = await parent.createTemplate({ household: parent.currentUser!.household, name: "AAA native parity template", reward: 5, type: "oneoff" });
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(ParentHome, { user: kid.currentUser!, onLogout() {} })); });
    try {
      await act(async () => view.root.findByType("nav").props.onTabPress({ route: { key: "chores" } }));
      await settle(view, "Add");
      await act(async () => button(view, "Add").props.onPress());
      await settle(view, "Templates");
      await act(async () => button(view, "Advanced (reminder, limit, due date)").props.onPress());
      await act(async () => view.root.findAllByType("input").find((n) => n.props.label === "Due date (optional)")!.props.onChangeText("2027-03-18"));
      await act(async () => view.root.findAllByType("button").find((n) => n.props.icon === "clipboard-list-outline")!.props.onPress());
      await act(async () => button(view, "Use").props.onPress());
      await act(async () => button(view, "Advanced (reminder, limit, due date)").props.onPress());
      expect(view.root.findAllByType("input").find((n) => n.props.label === "Due date (optional)")!.props.value).toBe("");
    } finally { await act(async () => view.unmount()); await parent.deleteTemplate(template.id); }
  });

  it("cancels native avatar/rate edits without saving the draft", async () => {
    const user = await parent.pb.collection("users").getOne<import("@paydirt/shared").User>(target);
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(KidAppearanceCard, { kid: user, onSaved() {}, onMessage() {} })); });
    try {
      const input = () => view.root.findAllByType("input").find((n) => n.props.label === "Goods rate (per $1)")!;
      await act(async () => input().props.onChangeText("999"));
      expect(button(view, "Cancel")).toBeDefined();
      await act(async () => button(view, "Cancel").props.onPress());
      expect(input().props.value).toBe(String(user.goods_rate));
      expect((await parent.pb.collection("users").getOne(target)).goods_rate).toBe(user.goods_rate);
    } finally { await act(async () => view.unmount()); }
  });

  it("clears a cancelled native goal target before reopening", async () => {
    const household = await parent.getHousehold(parent.currentUser!.household);
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(KidDetail, { kidId: target, household, onClose() {} })); });
    try {
      await settle(view, "GOALS");
      const header = view.root.findAllByType("section").find((n) => n.props.accessibilityRole === "button" && Array.isArray(n.props.children) && n.props.children.some((c: unknown) => typeof c === "string" && c.includes("GOALS")))!;
      await act(async () => header.props.onPress());
      await act(async () => button(view, "Set a goal").props.onPress());
      await act(async () => {
        view.root.findAllByType("input").find((n) => n.props.label === "What are they saving for?")!.props.onChangeText("Cancelled goal");
        view.root.findAllByType("input").find((n) => n.props.label === "Target (Grit)")!.props.onChangeText("100");
      });
      expect(button(view, "Add").props.disabled).toBe(false);
      await act(async () => button(view, "Cancel").props.onPress());
      await act(async () => button(view, "Set a goal").props.onPress());
      expect(button(view, "Add").props.disabled).toBe(true);
    } finally { await act(async () => view.unmount()); }
  });

  it("shows the native expiry preview before allowing an expiry change", async () => {
    const household = await parent.getHousehold(parent.currentUser!.household);
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(HouseholdSettings, { household, visible: true, onDismiss() {}, onSaved() {} })); });
    try {
      await act(async () => view.root.findAllByType("input").find((n) => n.props.label === "Rewards expire after days (0 = off)")!.props.onChangeText("30"));
      expect(button(view, "Save").props.disabled).toBe(true);
      await settle(view, "would expire today");
      expect(button(view, "Save").props.disabled).toBe(false);
      expect((await parent.getHousehold(household.id)).expiry_days).toBe(household.expiry_days);
    } finally { await act(async () => view.unmount()); }
  });

  it("updates the native pending-grant UI from a receipt without waiting for cron", async () => {
    await parent.pb.collection("users").update(target, { fl_child_id: "123456789012", fl_device_id: "a".repeat(30) });
    const household = await parent.getHousehold(parent.currentUser!.household);
    await parent.updateHousehold(household.id, { grant_weekday_window: "", grant_weekend_window: "" });
    const grant = await parent.giveBonusMinutes(target, 15, "Native fresh receipt", "native_fresh_receipt");
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(ParentHome, { user: kid.currentUser!, onLogout() {} })); });
    try {
      await settle(view, "Native fresh receipt");
      await processFamilyLinkQueue(queue, async () => 0, true);
      for (let i = 0; i < 80; i++) {
        if ((await parent.pb.collection("time_grants").getOne(grant.id)).grant_status === "granted") break;
        await act(async () => { await new Promise((done) => setTimeout(done, 100)); });
      }
      expect((await parent.pb.collection("time_grants").getOne(grant.id)).grant_status).toBe("granted");
      await act(async () => { await new Promise((done) => setTimeout(done, 100)); });
      expect(text(view)).not.toContain("Native fresh receipt");
    } finally {
      await act(async () => view.unmount());
      await parent.updateHousehold(household.id, { grant_weekday_window: household.grant_weekday_window, grant_weekend_window: household.grant_weekend_window });
    }
  }, 12_000);

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
