/**
 * Human-readable text for a thrown value. PocketBase's ClientResponseError
 * stringifies as "ClientResponseError 400: ..." plus the raw payload, which is
 * unreadable in a snackbar; this prefers the server's own message (field errors
 * first) and turns a dead connection into plain English.
 */
export function errorMessage(e: unknown): string {
  const err = e as {
    status?: number;
    response?: { message?: string; data?: Record<string, { message?: string } | undefined> };
    message?: string;
  } | null;
  if (err && typeof err === "object" && "status" in err && "response" in err) {
    if (err.status === 0) return "Can't reach the server. Check Wi-Fi and try again.";
    const field = Object.values(err.response?.data ?? {}).find((v) => v?.message);
    const msg = field?.message ?? err.response?.message;
    if (msg) return msg;
    if (err.status === 403) return "You're not allowed to do that.";
    if (err.status === 404) return "That no longer exists. Pull to refresh.";
  }
  if (e instanceof Error && e.message) return e.message;
  return typeof e === "string" ? e : "Something went wrong. Try again.";
}
