import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadAsync, requestCameraPermissionsAsync, launchCameraAsync, getPendingResultAsync, authStore, storage } = vi.hoisted(
  () => {
    const getPendingResultAsync = vi.fn();
    const storage = new Map<string, string>();
    const uploadAsync = vi.fn();
    const requestCameraPermissionsAsync = vi.fn();
    const launchCameraAsync = vi.fn();
    const authStore = { token: "test-token" };
    return { uploadAsync, requestCameraPermissionsAsync, launchCameraAsync, getPendingResultAsync, authStore, storage };
  },
);

vi.mock("./client", () => ({
  client: { pb: { authStore } },
  pbUrl: "http://pb.test:3111",
}));
vi.mock("expo-notifications", () => ({ cancelScheduledNotificationAsync: vi.fn(async () => {}) }));
vi.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync,
  launchCameraAsync,
  getPendingResultAsync,
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => storage.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => { storage.set(k, v); }),
    removeItem: vi.fn(async (k: string) => { storage.delete(k); }),
  },
}));
vi.mock("expo-file-system/legacy", () => ({
  FileSystemUploadType: { MULTIPART: 1 },
  uploadAsync,
}));

import { cancelScheduledNotificationAsync } from "expo-notifications";
import { recoverPendingPhoto, takePhotoAndComplete } from "./completeWithPhoto";

describe("takePhotoAndComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.clear();
    uploadAsync.mockResolvedValue({ status: 200, body: '{"id":"assignment_1"}' });
    requestCameraPermissionsAsync.mockResolvedValue({ status: "granted" });
    launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "content://media/external/images/media/42",
          fileName: "IMG_001.jpg",
          mimeType: "image/jpeg",
        },
      ],
    });
  });

  it("uploads via native multipart PATCH with auth, status fields, and the camera URI", async () => {
    const result = await takePhotoAndComplete("assignment_1");

    expect(result).toBe("done");
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("chore-timer-assignment_1");
    expect(uploadAsync).toHaveBeenCalledTimes(1);

    const [url, fileUri, options] = uploadAsync.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("http://pb.test:3111/api/collections/assignments/records/assignment_1");
    // content:// URIs from the camera are the ones JS fetch chokes on — the
    // native uploader must receive them as-is.
    expect(fileUri).toBe("content://media/external/images/media/42");
    expect(options.httpMethod).toBe("PATCH");
    expect(options.fieldName).toBe("photo");
    expect(options.mimeType).toBe("image/jpeg");
    expect(options.headers).toMatchObject({ Authorization: "test-token" });
    const params = options.parameters as Record<string, string>;
    expect(params.status).toBe("completed");
    expect(params.time_choice).toBe("bank");
    expect(new Date(params.completed_at).toISOString()).toBe(params.completed_at);
  });

  it("includes the kid's Use now choice in the same multipart submission", async () => {
    await takePhotoAndComplete("assignment_1", "use", "Photo submission note");
    expect(uploadAsync.mock.calls[0]?.[2].parameters.time_choice).toBe("use");
    expect(uploadAsync.mock.calls[0]?.[2].parameters.submission_note).toBe("Photo submission note");
  });

  it("throws with the server status and body on a failed upload", async () => {
    uploadAsync.mockResolvedValue({ status: 400, body: '{"message":"invalid"}' });

    await expect(takePhotoAndComplete("assignment_1")).rejects.toThrow(
      /Photo upload failed \(400\)/,
    );
  });

  it("does not report a failed submission when only reminder cleanup fails", async () => {
    vi.mocked(cancelScheduledNotificationAsync).mockRejectedValueOnce(new Error("Notification service unavailable"));
    await expect(takePhotoAndComplete("assignment_1")).resolves.toBe("done");
  });

  it("returns no-permission and uploads nothing without camera access", async () => {
    requestCameraPermissionsAsync.mockResolvedValue({ status: "denied" });

    const result = await takePhotoAndComplete("assignment_1");

    expect(result).toBe("no-permission");
    expect(launchCameraAsync).not.toHaveBeenCalled();
    expect(uploadAsync).not.toHaveBeenCalled();
  });

  it("returns cancelled and uploads nothing when the kid backs out of the camera", async () => {
    launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });

    const result = await takePhotoAndComplete("assignment_1");

    expect(result).toBe("cancelled");
    expect(cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(uploadAsync).not.toHaveBeenCalled();
  });
});

describe("recoverPendingPhoto (Android killed the app while the camera was open)", () => {
  const asset = { uri: "content://media/external/images/media/77", mimeType: "image/jpeg" };
  beforeEach(() => {
    vi.clearAllMocks();
    storage.clear();
    uploadAsync.mockResolvedValue({ status: 200, body: "{}" });
    requestCameraPermissionsAsync.mockResolvedValue({ status: "granted" });
  });
  // Simulates the kill: the camera call never returns, so the saved context survives.
  async function startAndGetKilled() {
    launchCameraAsync.mockReturnValue(new Promise(() => {}));
    void takePhotoAndComplete("assignment_9", "bank", "Done!");
    await new Promise((r) => setTimeout(r, 0));
  }

  it("uploads the lost photo once with the original assignment, choice and note", async () => {
    await startAndGetKilled();
    getPendingResultAsync.mockResolvedValue({ canceled: false, assets: [asset] });
    expect(await recoverPendingPhoto()).toBe(true);
    expect(uploadAsync).toHaveBeenCalledTimes(1);
    expect(uploadAsync.mock.calls[0]?.[0]).toBe("http://pb.test:3111/api/collections/assignments/records/assignment_9");
    expect(uploadAsync.mock.calls[0]?.[1]).toBe(asset.uri);
    expect(uploadAsync.mock.calls[0]?.[2].parameters).toMatchObject({ status: "completed", time_choice: "bank", submission_note: "Done!" });
    expect(await recoverPendingPhoto()).toBe(false);
    expect(uploadAsync).toHaveBeenCalledTimes(1);
  });

  it("does nothing after a normal capture, cancel, or error", async () => {
    launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
    await takePhotoAndComplete("assignment_9");
    launchCameraAsync.mockRejectedValue(new Error("camera failed"));
    await expect(takePhotoAndComplete("assignment_9")).rejects.toThrow();
    expect(await recoverPendingPhoto()).toBe(false);
    expect(getPendingResultAsync).not.toHaveBeenCalled();
    expect(uploadAsync).not.toHaveBeenCalled();
  });

  it("drops the saved context when Android has no pending result, a cancel, or an error", async () => {
    for (const pending of [null, { canceled: true, assets: null }, { code: "ERR", message: "x" }]) {
      await startAndGetKilled();
      getPendingResultAsync.mockResolvedValue(pending);
      expect(await recoverPendingPhoto()).toBe(false);
      expect(storage.size).toBe(0);
    }
    expect(uploadAsync).not.toHaveBeenCalled();
  });

  it("ignores a stale saved context", async () => {
    storage.set("paydirt-pending-photo", JSON.stringify({ assignmentId: "assignment_9", timeChoice: "bank", note: "", at: Date.now() - 2 * 60 * 60 * 1000 }));
    getPendingResultAsync.mockResolvedValue({ canceled: false, assets: [asset] });
    expect(await recoverPendingPhoto()).toBe(false);
    expect(uploadAsync).not.toHaveBeenCalled();
  });
});
