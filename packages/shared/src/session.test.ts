import { afterEach, describe, expect, it, vi } from "vitest";
import PocketBase from "pocketbase";
import { PaydirtClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

function savedClient() {
  const pb = new PocketBase("http://session.test");
  pb.authStore.save("saved-token", { id: "kid", collectionId: "users", collectionName: "users", household: "old" });
  return new PaydirtClient(pb);
}

describe("saved session refresh", () => {
  it("does not restore an account logged out during refresh", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", () => new Promise<Response>((resolve) => { finish = resolve; }));
    const client = savedClient();
    const pending = client.refreshSession();
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    client.logout();
    finish(new Response(JSON.stringify({
      token: "fresh-token", record: { id: "kid", collectionName: "users", household: "current" },
    }), { status: 200 }));
    await pending;
    expect(client.currentUser).toBeNull();
  });

  it("replaces stale account details without asking for credentials", async () => {
    const fetch = vi.fn(async (_url: string | URL | Request) => new Response(JSON.stringify({
      token: "fresh-token",
      record: { id: "kid", collectionName: "users", household: "current" },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const client = savedClient();
    await client.refreshSession();
    expect(client.currentUser?.household).toBe("current");
    expect(client.pb.authStore.token).toBe("fresh-token");
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/api/collections/users/auth-refresh");
  });

  it.each([404, 500, 0])("keeps the saved login on a server or network failure (%s)", async (status) => {
    vi.stubGlobal("fetch", async () => {
      if (!status) throw new TypeError("Network unavailable");
      return new Response("{}", { status });
    });
    const client = savedClient();
    await client.refreshSession();
    expect(client.pb.authStore.token).toBe("saved-token");
  });

  it.each([401, 403])("clears a session rejected by authentication (%s)", async (status) => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status }));
    const client = savedClient();
    await client.refreshSession();
    expect(client.currentUser).toBeNull();
  });
});
