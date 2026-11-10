import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { PaydirtClient } from "@paydirt/shared";


import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const appStateListeners = vi.hoisted(() => new Set<(state: string) => void>());
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => storage.get(key) || null,
  setItem: async (key: string, value: string) => { storage.set(key, value); },
  removeItem: async (key: string) => { storage.delete(key); },
} }));
vi.mock("react-native-sse", async () => ({ default: (await import("eventsource")).EventSource }));
vi.mock("react-native", () => ({ AppState: {
  currentState: "active",
  addEventListener: (_event: string, listener: (state: string) => void) => {
    appStateListeners.add(listener);
    return { remove: () => appStateListeners.delete(listener) };
  },
}, Animated: { View: ({ children }: { children: ReactNode }) => createElement("div", null, children), Value: class { setValue() {} }, spring: () => ({ start() {} }) }, PanResponder: { create: () => ({ panHandlers: {} }) }, Alert: { alert: () => {} }, ScrollView: ({ children, ...props }: { children: ReactNode; style?: unknown }) => createElement("div", props, children), View: ({ children, ...props }: { children: ReactNode; style?: unknown }) => createElement("div", props, children), StyleSheet: { create: (s: unknown) => s } }));
vi.mock("react-native-paper", () => {
  const Container = ({ children }: { children: ReactNode }) => createElement("section", null, children);
  return {
    Portal: Container,
    Menu: Object.assign(Container, { Item: Container }),
    IconButton: (props: object) => createElement("button", props),
    Dialog: Object.assign(Container, { Title: Container, Content: Container, ScrollArea: Container, Actions: Container }),
    TextInput: Object.assign((props: object) => createElement("input", props), { Icon: () => null, Affix: () => null }),
    Card: Object.assign(Container, { Content: Container }),
    Text: ({ children }: { children: ReactNode }) => createElement("span", null, children),
    Button: (props: object) => createElement("button", props),
    Switch: (props: object) => createElement("input", props),
    Icon: () => null, ProgressBar: () => null,
    useTheme: () => ({ colors: {} }),
  };
});
vi.mock("expo-image-picker", () => ({ requestCameraPermissionsAsync: async () => ({ status: "granted" }), launchCameraAsync: async () => ({ canceled: true }) }));
vi.mock("expo-file-system/legacy", () => ({ uploadAsync: async () => ({ status: 200 }), FileSystemUploadType: { MULTIPART: 1 } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Native adapters are the boundary; components, hooks, client, SQLite and
// server business logic are real. Never contacts Google or a desktop browser.
describe("Native chore conversations (real PocketBase)", () => {
  const repo = resolve(import.meta.dirname, "../../..");
  const root = mkdtempSync(join(tmpdir(), "paydirt-fl-test-"));
  const queue = join(root, "familylink");
  let server: ChildProcess | undefined;
  let parent: PaydirtClient;
  let kid: PaydirtClient;
  let url: string;
  let stopReachability: () => void;
  let ConversationProvider: typeof import("./ChoreConversation").ConversationProvider;
  let ConversationButton: typeof import("./ChoreConversation").ConversationButton;

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
    ({ ConversationProvider, ConversationButton } = await import("./ChoreConversation"));
    await parent.login("parent1@test.local", "password123");
    await kid.login("child1@test.local", "password123");
    await parent.pb.collection("users").update(kid.currentUser!.id, { fl_child_id: "123456789012", fl_device_id: "a".repeat(30) });
    await parent.pb.collection("households").update(parent.currentUser!.household, { grant_weekday_window: "none", grant_weekend_window: "none" });
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
    const flatten = (node: unknown): string => {
      if (typeof node === "string" || typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(flatten).join(" ");
      return node && typeof node === "object" ? flatten((node as { children?: unknown }).children) : "";
    };
    return flatten(view.toJSON()).replace(/\s+/g, " ");
  }
  async function settle(view: ReactTestRenderer, value: string) {
    for (let i = 0; i < 100; i++) {
      await act(async () => { await new Promise((done) => setTimeout(done, 20)); });
      if (text(view).includes(value) && view.root.findAllByType("button").every((b) => !b.props.loading)) return;
    }
    expect(text(view)).toContain(value);
  }
  const button = (view: ReactTestRenderer, label: string) => view.root.findAllByType("button").find((b) => [b.props.children].flat().join("") === label)!;
  const input = (view: ReactTestRenderer) => view.root.findAllByType("input").find((i) => i.props.label === "Message")!;
  async function mount(id: string) {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(ConversationProvider, { userId: kid.currentUser!.id,
      children: createElement(ConversationButton, { assignmentId: id }) })); });
    await act(async () => button(view, "Conversation").props.onPress());
    await settle(view, "No messages yet");
    return view;
  }
  async function assignment() {
    const c = await parent.createChore({ household: parent.currentUser!.household, name: "Native conversation", reward: 10,
      type: "oneoff", created_by: parent.currentUser!.id, active: true });
    return parent.assignChore(c.id, kid.currentUser!.id);
  }
  async function write(view: ReactTestRenderer, body: string) {
    await act(async () => { input(view).props.onChangeText(body); await new Promise((done) => setTimeout(done, 20)); });
  }
  it("submits the kid's note atomically, then sends a reply without changing approval or money", async () => {
    const a = await assignment(); const view = await mount(a.id);
    await write(view, "I cleaned all the shelves.");
    await act(async () => button(view, "Send note and mark done").props.onPress());
    await settle(view, "Submitted for approval");
    expect((await kid.getConversationAssignment(a.id)).status).toBe("completed");
    const balance = await kid.getBalance(kid.currentUser!.id);
    await parent.sendChoreMessage(a.id, "The top shelf too?", "native_parent_question");
    await settle(view, "The top shelf too?");
    await write(view, "Yes, the top shelf too.");
    await act(async () => button(view, "Send message").props.onPress());
    await settle(view, "Yes, the top shelf too.");
    expect(await kid.getBalance(kid.currentUser!.id)).toBe(balance);
    expect((await kid.getConversationAssignment(a.id)).status).toBe("completed");
    await parent.approveAssignment(a.id);
    await settle(view, "Approved");
    expect(button(view, "Send message")).toBeDefined();
    await act(async () => view.unmount());
  });
  it("persists a lost-response draft across restart and retries without duplicate messages", async () => {
    const a = await assignment(); const view = await mount(a.id);
    await write(view, "Please check my work.");
    const realFetch = globalThis.fetch;
    let lose = true;
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
      const response = await realFetch(...args);
      if (String(args[0]).includes("/messages") && lose) { lose = false; throw new TypeError("Response lost after commit"); }
      return response;
    });
    try {
      await act(async () => button(view, "Send message").props.onPress());
      await settle(view, "Retry message");
      await act(async () => view.unmount());
      let restored!: ReactTestRenderer;
      await act(async () => { restored = create(createElement(ConversationProvider, { userId: kid.currentUser!.id, children: createElement(ConversationButton, { assignmentId: a.id }) })); });
      await act(async () => button(restored, "Conversation").props.onPress());
      await settle(restored, "Retry message");
      expect(input(restored).props.value).toBe("Please check my work.");
      await act(async () => button(restored, "Retry message").props.onPress());
      await settle(restored, "Send message");
      expect(await kid.listChoreMessages(a.id)).toHaveLength(1);
      await act(async () => restored.unmount());
    } finally { network.mockRestore(); }
  });
  it("opens the notification's exact thread using only an authorized inbox record", async () => {
    const a = await assignment();
    await parent.sendChoreMessage(a.id, "Question from notification", "native_notification_msg");
    const inbox = (await kid.listInbox(kid.currentUser!.id, 100)).find((item) => item.source === "assignments:" + a.id + ":conversation")!;
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(ConversationProvider, { userId: kid.currentUser!.id,
      notificationRoute: { inboxId: inbox.id, nonce: 1 }, children: null })); });
    await settle(view, "Question from notification");
    expect(input(view)).toBeDefined();
    await act(async () => view.unmount());
    await kid.sendChoreMessage(a.id, "Private parent inbox notification", "native_private_inbox_msg");
    const otherInbox = (await parent.listInbox(parent.currentUser!.id, 100)).find((item) => item.source === "assignments:" + a.id + ":conversation")!;
    await act(async () => { view = create(createElement(ConversationProvider, { userId: kid.currentUser!.id,
      notificationRoute: { inboxId: otherInbox.id, nonce: 2 }, children: null }));
      await new Promise((done) => setTimeout(done, 100));
    });
    expect(input(view)).toBeUndefined();
    await act(async () => view.unmount());
  });

  it("keeps parent Send message distinct from Approve and Reject", async () => {
    const a = await assignment(); await kid.markComplete(a.id);
    await kid.login("parent1@test.local", "password123");
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(ConversationProvider, { userId: kid.currentUser!.id, children: createElement(ConversationButton, { assignmentId: a.id }) })); });
    await act(async () => button(view, "Conversation").props.onPress());
    await settle(view, "Submitted for approval");
    expect(button(view, "Approve chore")).toBeDefined(); expect(button(view, "Reject chore")).toBeDefined();
    await write(view, "Could you check the corners?");
    await act(async () => button(view, "Send message").props.onPress());
    await settle(view, "Could you check the corners?");
    expect((await parent.getConversationAssignment(a.id)).status).toBe("completed");
    await act(async () => button(view, "Approve chore").props.onPress());
    await settle(view, "Approved");
    expect((await parent.getConversationAssignment(a.id)).status).toBe("approved");
    await act(async () => view.unmount());
  });
  it("keeps recently approved reactions in the top header, away from Conversation", async () => {
    await kid.login("parent1@test.local", "password123");
    const { RecentlyApproved } = await import("./RecentlyApproved");
    const child = (await parent.listChildren(parent.currentUser!.household)).find((user) => user.display_name === "Kid 1")!;
    const chore = await parent.createChore({ household: parent.currentUser!.household, name: "Reaction header regression", reward: 5,
      type: "oneoff", created_by: parent.currentUser!.id, active: true });
    const a = await parent.assignChore(chore.id, child.id);
    await parent.markComplete(a.id); await parent.approveAssignment(a.id);
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(RecentlyApproved, { householdId: parent.currentUser!.household,
      currencyName: "Grit", reloadKey: 0, onChanged: () => {}, onMessage: () => {} })); });
    try {
      await settle(view, chore.name);
      const reaction = view.root.findAllByType("button").find((node) => node.props.accessibilityLabel === "React 🎉")!;
      let group = reaction.parent;
      while (group && group.type !== "div") group = group.parent;
      if (!group) throw new Error("Missing reaction group");
      let header = group.parent;
      while (header && header.type !== "div") header = header.parent;
      if (!header) throw new Error("Missing reaction header");
      expect(header.findAllByType("span").some((node) => [node.props.children].flat().join("") === chore.name)).toBe(true);
      expect(header.findAllByType("button").some((node) => node.props.children === "Conversation")).toBe(false);
      expect(group.props.style).toMatchObject({ flexDirection: "row", flexShrink: 0 });
    } finally { await act(async () => view.unmount()); }
  });

});
