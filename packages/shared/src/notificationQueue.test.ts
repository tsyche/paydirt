import { afterAll, expect, it } from "vitest";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { processNotificationQueue } from "./notificationQueue";

const roots: string[] = [];
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }); });

it("recovers an interrupted push, delivers its payload, and reports rejected pushes without leaking private data", async () => {
  const received: { url: string; body: string; title?: string }[] = [];
  const endpoint = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      received.push({ url: req.url!, body, title: req.headers.title as string });
      res.writeHead(req.url === "/reject" ? 503 : 200);
      res.end();
    });
  });
  await new Promise<void>((done) => endpoint.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${(endpoint.address() as { port: number }).port}`;
  const root = await mkdtemp(join(tmpdir(), "paydirt-push-worker-"));
  roots.push(root);
  const errors: string[] = [];
  try {
    await mkdir(join(root, "processing"));
    await mkdir(join(root, "pending"));
    const recovered = "a".repeat(24) + ".json";
    const rejected = "b".repeat(24) + ".json";
    const job = (path: string) => JSON.stringify({ url: url + path, method: "POST", headers: { Title: "Approved 🎉" }, body: "Private message" });
    await writeFile(join(root, "processing", recovered), job("/recovered"), { mode: 0o600 });
    await writeFile(join(root, "pending", rejected), job("/reject"), { mode: 0o600 });
    await processNotificationQueue(root, (id) => errors.push(id));
    expect(received).toEqual(expect.arrayContaining([
      { url: "/recovered", body: "Private message", title: "=?UTF-8?B?" + Buffer.from("Approved 🎉").toString("base64") + "?=" },
      { url: "/reject", body: "Private message", title: "=?UTF-8?B?" + Buffer.from("Approved 🎉").toString("base64") + "?=" },
    ]));
    expect(errors).toEqual([rejected]);
    expect(await readdir(join(root, "pending"))).toEqual([]);
    expect(await readdir(join(root, "processing"))).toEqual([]);
  } finally {
    endpoint.closeAllConnections();
    await new Promise<void>((done) => endpoint.close(() => done()));
  }
});

it("skips a pending alert cleared while an earlier batch is being delivered", async () => {
  const root = await mkdtemp(join(tmpdir(), "paydirt-push-cancel-"));
  roots.push(root);
  await mkdir(join(root, "pending"));
  const cancelled = "e".repeat(24) + ".json";
  let requests = 0;
  const endpoint = createServer((_req, res) => {
    requests++;
    if (requests === 1) {
      // The worker already listed all five jobs, but has only claimed four.
      void rm(join(root, "pending", cancelled)).then(() => res.end());
    } else res.end();
  });
  await new Promise<void>((done) => endpoint.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${(endpoint.address() as { port: number }).port}`;
  try {
    for (const letter of ["a", "b", "c", "d", "e"]) {
      await writeFile(join(root, "pending", letter.repeat(24) + ".json"), JSON.stringify({ url, method: "POST", headers: {}, body: "Alert" }));
    }
    await expect(processNotificationQueue(root)).resolves.toBeUndefined();
    expect(requests).toBe(4);
    expect(await readdir(join(root, "processing"))).toEqual([]);
  } finally {
    endpoint.closeAllConnections();
    await new Promise<void>((done) => endpoint.close(() => done()));
  }
});
