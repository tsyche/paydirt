import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { PaydirtClient } from "@paydirt/shared";
import { timeBankTotals } from "@paydirt/shared";


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
}, View: ({ children }: { children: ReactNode }) => createElement("div", null, children), StyleSheet: { create: (s: unknown) => s } }));
vi.mock("react-native-paper", () => {
  const Container = ({ children }: { children: ReactNode }) => createElement("section", null, children);
  return {
    Card: Object.assign(Container, { Content: Container }),
    Text: ({ children }: { children: ReactNode }) => createElement("span", null, children),
    Button: (props: object) => createElement("button", props),
    Switch: (props: object) => createElement("input", props),
    Icon: () => null, ProgressBar: () => null,
    useTheme: () => ({ colors: {} }),
  };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Native adapters are the boundary; components, hooks, client, SQLite and
// server business logic are real. Never contacts Google or a desktop browser.
describe("Native earned-time controls (real PocketBase)", () => {
  const repo = resolve(import.meta.dirname, "../../..");
  const root = mkdtempSync(join(tmpdir(), "paydirt-fl-test-"));
  const queue = join(root, "familylink");
  let server: ChildProcess | undefined;
  let parent: PaydirtClient;
  let kid: PaydirtClient;
  let url: string;
  let stopReachability: () => void;
  let EarnedTimeBank: typeof import("./EarnedTimeBank").EarnedTimeBank;
  let MyBank: typeof import("./MyBank").MyBank;

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
    EarnedTimeBank = (await import("./EarnedTimeBank")).EarnedTimeBank;
    MyBank = (await import("./MyBank")).MyBank;
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



  const text = (view: ReactTestRenderer) => {
    const flatten = (node: unknown): string => {
      if (typeof node === "string" || typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(flatten).join(" ");
      return node && typeof node === "object" ? flatten((node as { children?: unknown }).children) : "";
    };
    return flatten(view.toJSON()).replace(/\s+/g, " ");
  };
  async function settle(view: ReactTestRenderer, expected: string) {
    for (let i = 0; i < 100; i++) {
      await act(async () => { await new Promise((done) => setTimeout(done, 20)); });
      if (text(view).includes(expected) && view.root.findAllByType("button").every((b) => !b.props.loading)) return;
    }
    expect(text(view)).toContain(expected);
  }
  async function earn(minutes = 30) {
    const chore = await parent.createChore({ household: parent.currentUser!.household, name: "Native bank chore", reward: 0,
      type: "oneoff", created_by: parent.currentUser!.id, active: true, pay_mode: "time", reward_minutes: minutes });
    const a = await parent.assignChore(chore.id, kid.currentUser!.id);
    await kid.markComplete(a.id); await parent.approveAssignment(a.id);
  }
  async function mount(simple: boolean) {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(createElement(MyBank, { balance: 0, currency: "Grit", goodsRate: 1, screenRate: 1,
        streak: 0, assignments: [], goals: [], requests: [], simple,
        earnedTime: createElement(EarnedTimeBank, { childId: kid.currentUser!.id, kidControl: true }),
      }));
    });
    await act(async () => { view.root.findByType("input").props.onValueChange(true); });
    return view;
  }
  const button = (view: ReactTestRenderer, label: string) => view.root.findAllByType("button").find((b) => [b.props.children].flat().join("") === label)!;

  it.each([false, true])("redeems in 15-minute steps and restores provably unstarted time (simple=%s)", async (simple) => {
    await earn();
    const bank = await kid.getTimeBank(kid.currentUser!.id);
    const available = timeBankTotals(bank.ledger, bank.grants, bank.purchases).available;
    const view = await mount(simple);
    await settle(view, `${available} min saved`);
    const totalRows = view.root.findAllByType("span").filter((node) => /\d+ min (saved|reserved for review|requested|queued)/.test([node.props.children].flat().join("")));
    expect(totalRows).toHaveLength(4);
    await act(async () => { view.root.findAllByType("button").find((b) => b.props.accessibilityLabel === "Use 15 more minutes")!.props.onPress(); });
    await act(async () => { button(view, "Use time").props.onPress(); });
    await settle(view, `${available - 30} min saved`);
    const after = await kid.getTimeBank(kid.currentUser!.id);
    const grant = after.grants.find((g) => g.redemption && g.minutes === 30)!;
    expect(grant.grant_status).toBe("queued");
    await act(async () => { button(view, "Return 30 undelivered minutes to savings").props.onPress(); });
    await settle(view, `${available} min saved`);
    await act(async () => view.unmount());
  });

  it("persists a lost-response request across remount and retries the same reservation", async () => {
    const view = await mount(false);
    await settle(view, "min saved");
    const realFetch = globalThis.fetch;
    let loseResponse = true;
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
      const response = await realFetch(...args);
      if (String(args[0]).includes("time-bank/redeem") && loseResponse) {
        loseResponse = false;
        throw new TypeError("Connection lost after server committed");
      }
      return response;
    });
    try {
      await act(async () => { button(view, "Use time").props.onPress(); });
      await settle(view, "Retry Use time");
      const pending = JSON.parse(storage.get(`paydirt-time-redemption:${kid.currentUser!.id}`)!);
      const before = await kid.getTimeBank(kid.currentUser!.id);
      const reserved = before.ledger.filter((r) => r.kind === "reserve").length;
      await act(async () => view.unmount());
      const restored = await mount(true);
      await settle(restored, "Retry Use time");
      await act(async () => { button(restored, "Retry Use time").props.onPress(); });
      await settle(restored, "Use time");
      const after = await kid.getTimeBank(kid.currentUser!.id);
      expect(after.ledger.filter((r) => r.kind === "reserve")).toHaveLength(reserved);
      expect(await kid.pb.collection("time_redemptions").getFullList({ filter: kid.pb.filter("request_key = {:key}", { key: pending.key }) })).toHaveLength(1);
      expect(storage.has(`paydirt-time-redemption:${kid.currentUser!.id}`)).toBe(false);
      await act(async () => restored.unmount());
    } finally { network.mockRestore(); }
  });

  it("catches up saved totals on foreground after missing realtime events", async () => {
    const before = await kid.getTimeBank(kid.currentUser!.id);
    const total = timeBankTotals(before.ledger, before.grants, before.purchases).available;
    const view = await mount(false);
    await settle(view, `${total} min saved`);
    await kid.pb.realtime.unsubscribe();
    await earn(15);
    expect(text(view)).toContain(`${total} min saved`);
    await act(async () => {
      appStateListeners.forEach((listener) => listener("background"));
      appStateListeners.forEach((listener) => listener("active"));
    });
    await settle(view, `${total + 15} min saved`);
    await act(async () => view.unmount());
  });

  it("shows parent totals and history without kid spending controls", async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(EarnedTimeBank, { childId: kid.currentUser!.id })); });
    await settle(view, "Banked time:");
    expect(text(view)).not.toContain("reserved for review");
    await act(async () => { view.root.findAllByType("button").find((b) => b.props.accessibilityLabel === "Show bank details")!.props.onPress(); });
    expect(text(view)).toContain("Earned-time history");
    expect(button(view, "Use time")).toBeUndefined();
    await act(async () => view.unmount());
  });
  it("shows only the held bank total on parent Kids cards", async () => {
    let view!: ReactTestRenderer;
    await act(async () => { view = create(createElement(EarnedTimeBank, { childId: kid.currentUser!.id, detail: false })); });
    await settle(view, "Banked time:");
    expect(text(view)).not.toContain("reserved for review");
    expect(text(view)).not.toContain("min requested");
    expect(text(view)).not.toContain("min queued");
    expect(text(view)).not.toContain("Earned-time history");
    await act(async () => view.unmount());
  });

});
