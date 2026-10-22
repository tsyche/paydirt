import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadAsync, requestCameraPermissionsAsync, launchCameraAsync, authStore } = vi.hoisted(
  () => {
    const uploadAsync = vi.fn();
    const requestCameraPermissionsAsync = vi.fn();
    const launchCameraAsync = vi.fn();
    const authStore = { token: "test-token" };
    return { uploadAsync, requestCameraPermissionsAsync, launchCameraAsync, authStore };
  },
);

vi.mock("./client", () => ({
  client: { pb: { authStore } },
  pbUrl: "http://pb.test:3111",
}));
vi.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync,
  launchCameraAsync,
}));
vi.mock("expo-file-system/legacy", () => ({
  FileSystemUploadType: { MULTIPART: 1 },
  uploadAsync,
}));

import { takePhotoAndComplete } from "./completeWithPhoto";

describe("takePhotoAndComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(new Date(params.completed_at).toISOString()).toBe(params.completed_at);
  });

  it("throws with the server status and body on a failed upload", async () => {
    uploadAsync.mockResolvedValue({ status: 400, body: '{"message":"invalid"}' });

    await expect(takePhotoAndComplete("assignment_1")).rejects.toThrow(
      /Photo upload failed \(400\)/,
    );
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
    expect(uploadAsync).not.toHaveBeenCalled();
  });
});
