// Canned kid replies to a parent broadcast. Tap-only (no typing), so it's safe for the
// youngest kid and gives kids a real way to answer instead of hijacking goal text.
// Codes mirror the `broadcast_replies.code` select in migration 1717000029.

export const REPLY_OPTIONS = [
  { code: "ok", emoji: "👍", label: "OK" },
  { code: "question", emoji: "❓", label: "Question" },
  { code: "later", emoji: "⏰", label: "Later" },
  { code: "please", emoji: "🙏", label: "Please" },
] as const;

export type ReplyCode = (typeof REPLY_OPTIONS)[number]["code"];

export function replyOption(code: string) {
  return REPLY_OPTIONS.find((o) => o.code === code);
}

/** "👍 OK" for a known code, otherwise the raw code. */
export function replyLabel(code: string): string {
  const o = replyOption(code);
  return o ? `${o.emoji} ${o.label}` : code;
}
