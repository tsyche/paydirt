import { describe, it, expect } from "vitest";

// Live test for the in-app update endpoints. `just test-all` seeds a dummy
// 3 MB APK; against a dev PB with no APK published the download tests skip.
// Regression: the APK used to be read into JS memory per request, which made
// Android's DownloadManager report "Download unsuccessful" for the ~80 MB build.

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:3111";

describe("in-app update endpoints (live)", () => {
  it("serves the whole APK with a matching Content-Length", async () => {
    const res = await fetch(`${PB_URL}/api/updates/apk`);
    if (res.status === 404) return; // nothing published on this instance
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.android.package-archive");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.length).toBeGreaterThan(0);
    expect(Number(res.headers.get("content-length"))).toBe(body.length);
  });

  it("supports Range requests (DownloadManager resumes with them)", async () => {
    const probe = await fetch(`${PB_URL}/api/updates/apk`, { method: "HEAD" });
    if (probe.status === 404) return;
    const res = await fetch(`${PB_URL}/api/updates/apk`, { headers: { Range: "bytes=0-99" } });
    expect(res.status).toBe(206);
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });

  it("version.json points at a reachable download URL", async () => {
    const res = await fetch(`${PB_URL}/api/updates/version`);
    if (res.status === 404) return;
    const v = await res.json();
    expect(v.versionCode).toBeGreaterThan(0);
    expect(new URL(v.downloadUrl).pathname).toBe("/api/updates/apk");
  });
});
