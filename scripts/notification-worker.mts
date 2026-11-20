import { processNotificationQueue } from "../packages/shared/src/notificationQueue.ts";

const dir = process.env.NTFY_QUEUE_DIR;
if (!dir) throw new Error("NTFY_QUEUE_DIR is required");
await processNotificationQueue(dir);
