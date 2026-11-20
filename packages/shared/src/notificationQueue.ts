import { mkdir, readdir, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

interface PushRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timeout: number;
}

/** One worker owns this directory. Recover interrupted attempts on startup.
 * Delivery remains best effort, as in the original hooks; a crash after sending
 * can replay a notification. No accounting or approval is performed here.
 */
export async function processNotificationQueue(
  dir: string,
  onError: (job: string) => void = (job) => console.error(`Notification delivery failed: ${job}`),
): Promise<void> {
  const pending = join(dir, "pending");
  const processing = join(dir, "processing");
  await mkdir(pending, { recursive: true, mode: 0o700 });
  await mkdir(processing, { recursive: true, mode: 0o700 });
  const names = (files: string[]) => files.filter((name) => /^[a-zA-Z0-9]{24}\.json$/.test(name)).sort();
  for (const name of names(await readdir(processing))) {
    await rename(join(processing, name), join(pending, name));
  }
  for (;;) {
    const jobs = names(await readdir(pending));
    if (!jobs.length) return;
    // A slow device endpoint cannot hold every other recipient behind it.
    for (let offset = 0; offset < jobs.length; offset += 4) {
      await Promise.all(jobs.slice(offset, offset + 4).map(async (name) => {
        const path = join(processing, name);
        try {
          await rename(join(pending, name), path);
        } catch (error) {
          // clearSource can cancel an alert after the directory was listed.
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
          throw error;
        }
        try {
          const request: PushRequest = JSON.parse(await readFile(path, "utf8"));
          // Fetch rejects non-ASCII header values. ntfy accepts RFC 2047:
          // https://docs.ntfy.sh/publish/#list-of-all-parameters
          const headers = { ...request.headers };
          if (headers.Title && /[^\x20-\x7e]/u.test(headers.Title)) {
            headers.Title = `=?UTF-8?B?${Buffer.from(headers.Title).toString("base64")}?=`;
          }
          const response = await fetch(request.url, {
            method: request.method, headers, body: request.body,
            signal: AbortSignal.timeout(10_000),
          });
          // Consume the body before releasing the connection.
          await response.arrayBuffer();
          if (!response.ok) throw new Error("Push rejected");
        } catch {
          // Endpoints and message bodies are private; log only the job id.
          onError(name);
        }
        await unlink(path);
      }));
    }
  }
}
