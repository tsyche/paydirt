import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { NativeModules } = vi.hoisted(() => ({ NativeModules: {} as Record<string, unknown> }));

vi.mock("react-native", () => ({ NativeModules }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));

// expo-file-system's File/Paths are mocked with an in-memory endpoint file so
// the polling loop can be exercised without native code.
const fsState = vi.hoisted(() => ({ exists: false, text: "" }));

vi.mock("expo-file-system", () => ({
  Paths: { document: "/mock/files" },
  File: class {
    exists = fsState.exists;
    async text() {
      return fsState.text;
    }
  },
}));

const { update, collection, currentUser } = vi.hoisted(() => {
  const update = vi.fn();
  const collection = vi.fn(() => ({ update }));
  const currentUser = { up_endpoint: undefined as string | undefined };
  return { update, collection, currentUser };
});

vi.mock("./client", () => ({
  client: { pb: { collection }, currentUser },
}));

import { requestNtfyRegistration, syncUnifiedPushEndpoint, waitForUnifiedPushEndpoint } from "./unifiedpush";

describe("syncUnifiedPushEndpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsState.exists = false;
    fsState.text = "";
    currentUser.up_endpoint = undefined;
    update.mockResolvedValue({});
    NativeModules.PayDirtNative = undefined;
  });

  it("returns false without touching the server when no endpoint file exists", async () => {
    expect(await syncUnifiedPushEndpoint("user_1")).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("saves the endpoint to the user record when the file is present", async () => {
    fsState.exists = true;
    fsState.text = "https://ntfy.sh/pAyD123\n";

    expect(await syncUnifiedPushEndpoint("user_1")).toBe(true);
    expect(collection).toHaveBeenCalledWith("users");
    expect(update).toHaveBeenCalledWith("user_1", { up_endpoint: "https://ntfy.sh/pAyD123" });
  });

  it("skips the update when the endpoint is already synced (no authStore churn)", async () => {
    fsState.exists = true;
    fsState.text = "https://ntfy.sh/pAyD123\n";
    currentUser.up_endpoint = "https://ntfy.sh/pAyD123";

    expect(await syncUnifiedPushEndpoint("user_1")).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it("still updates when the endpoint changed (e.g. reinstall)", async () => {
    fsState.exists = true;
    fsState.text = "https://ntfy.sh/newEndpoint\n";
    currentUser.up_endpoint = "https://ntfy.sh/oldEndpoint";

    expect(await syncUnifiedPushEndpoint("user_1")).toBe(true);
    expect(update).toHaveBeenCalledWith("user_1", { up_endpoint: "https://ntfy.sh/newEndpoint" });
  });
});

describe("requestNtfyRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    NativeModules.PayDirtNative = undefined;
  });

  it("calls the native module when available", async () => {
    const registerWithNtfy = vi.fn().mockResolvedValue(true);
    NativeModules.PayDirtNative = { registerWithNtfy };

    await requestNtfyRegistration();

    expect(registerWithNtfy).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the native module is missing (older install)", async () => {
    await expect(requestNtfyRegistration()).resolves.toBeUndefined();
  });
});

describe("waitForUnifiedPushEndpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsState.exists = false;
    fsState.text = "";
    currentUser.up_endpoint = undefined;
    update.mockResolvedValue({});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls until the endpoint appears, then syncs and returns true", async () => {
    const pending = waitForUnifiedPushEndpoint("user_1", { attempts: 5, delayMs: 10 });

    // Endpoint lands after two failed polls — mirrors ntfy answering REGISTER.
    setTimeout(() => {
      fsState.exists = true;
      fsState.text = "https://ntfy.sh/abc";
    }, 25);

    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toBe(true);
    expect(update).toHaveBeenCalledWith("user_1", { up_endpoint: "https://ntfy.sh/abc" });
  });

  it("gives up after the attempt budget and returns false", async () => {
    const result = waitForUnifiedPushEndpoint("user_1", { attempts: 3, delayMs: 10 });

    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
