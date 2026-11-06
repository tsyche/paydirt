import { test, expect, type Page } from "@playwright/test";

// Test-only browser peers. Pairing material and SDP move through the test runner,
// not a product signaling server. No production client or PocketBase is used.
async function peer(page: Page, device: string) {
  return page.evaluateHandle(async (device) => {
    type Operation = { id: string; device: string; kind: "complete" | "approve"; occurrence: string };
    type Envelope = { operation: Operation; signature: number[] };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("paydirt-feasibility", 1);
      request.onupgradeneeded = () => { for (const name of ["keys", "operations", "settlements"]) request.result.createObjectStore(name); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    async function read<T>(store: string, key: string): Promise<T | undefined> {
      return new Promise((resolve, reject) => { const request = db.transaction(store).objectStore(store).get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    }
    async function write(store: string, key: string, value: unknown) {
      return new Promise<void>((resolve, reject) => { const tx = db.transaction(store, "readwrite"); tx.objectStore(store).put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    }
    async function all<T>(store: string): Promise<T[]> {
      return new Promise((resolve, reject) => { const request = db.transaction(store).objectStore(store).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    }
    const key = await read<CryptoKeyPair>("keys", device) ?? await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]) as CryptoKeyPair;
    await write("keys", device, key);
    const members = new Map<string, { key: CryptoKey; role: string }>();
    const links = new Map<string, { connection: RTCPeerConnection; channel?: RTCDataChannel }>();
    const errors: string[] = [];
    const bytes = (op: Operation) => new TextEncoder().encode(JSON.stringify(op));
    async function receive(message: Envelope) {
      const { operation: op } = message; const member = members.get(op.device);
      if (!member || !(await crypto.subtle.verify("Ed25519", member.key, new Uint8Array(message.signature), bytes(op)))) throw Error("Untrusted operation");
      if (op.kind === "approve" && member.role !== "parent") throw Error("Role violation");
      const old = await read<Envelope>("operations", op.id);
      if (old && JSON.stringify(old) !== JSON.stringify(message)) throw Error("Operation ID collision");
      await write("operations", op.id, message);
    }
    function attach(remote: string, channel: RTCDataChannel) {
      links.get(remote)!.channel = channel;
      channel.onmessage = (event) => { void receive(JSON.parse(event.data)).catch((error: Error) => errors.push(error.message)); };
    }
    function connection(remote: string) {
      const connection = new RTCPeerConnection({ iceServers: [] });
      links.set(remote, { connection }); connection.ondatachannel = ({ channel }) => attach(remote, channel);
      return connection;
    }
    async function localDescription(connection: RTCPeerConnection) {
      if (connection.iceGatheringState !== "complete") await new Promise<void>((resolve) => { connection.onicegatheringstatechange = () => { if (connection.iceGatheringState === "complete") resolve(); }; });
      return connection.localDescription!.toJSON();
    }
    return {
      publicKey: () => crypto.subtle.exportKey("jwk", key.publicKey),
      enroll: async (member: { device: string; key: JsonWebKey; role: string }) => { members.set(member.device, { key: await crypto.subtle.importKey("jwk", member.key, "Ed25519", false, ["verify"]), role: member.role }); },
      revoke: (remote: string) => members.delete(remote),
      create: async (op: Operation) => { const message = { operation: op, signature: Array.from(new Uint8Array(await crypto.subtle.sign("Ed25519", key.privateKey, bytes(op)))) }; await receive(message); return message; },
      receive,
      operations: () => all<Envelope>("operations"),
      offer: async (remote: string) => { const c = connection(remote); attach(remote, c.createDataChannel("operations")); await c.setLocalDescription(await c.createOffer()); return localDescription(c); },
      answer: async (remote: string, offer: RTCSessionDescriptionInit) => { const c = connection(remote); await c.setRemoteDescription(offer); await c.setLocalDescription(await c.createAnswer()); return localDescription(c); },
      accept: async (remote: string, answer: RTCSessionDescriptionInit) => links.get(remote)!.connection.setRemoteDescription(answer),
      ready: (remote: string) => links.get(remote)?.channel?.readyState === "open",
      send: (remote: string, message: Envelope) => links.get(remote)!.channel!.send(JSON.stringify(message)),
      errors: () => errors,
      // Settlement is exclusive to parent1 in this experiment; no failover exists.
      settle: async () => {
        if (device !== "parent1") throw Error("Not settlement authority");
        const messages = await all<Envelope>("operations");
        const eligible = messages.filter(({ operation: op }) => op.kind === "approve" && messages.some(({ operation: c }) => c.kind === "complete" && c.occurrence === op.occurrence));
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("settlements", "readwrite"); const store = tx.objectStore("settlements");
          // Unique occurrence keys collapse competing approvals atomically.
          for (const { operation: op } of eligible) store.put(5, op.occurrence);
          tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
        });
      },
      balance: async () => (await all<number>("settlements")).reduce((sum, n) => sum + n, 0),
    };
  }, device);
}

test("server-free browser spike: offline storage, signed WebRTC catch-up, competing approvals, restart, and local revocation", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  try {
    for (const context of contexts) await context.route("https://peer.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Isolated peer spike</title>" }));
    const pages = await Promise.all(contexts.map(async (context) => { const page = await context.newPage(); await page.goto("https://peer.test/"); return page; }));
    const devices = ["kid", "parent1", "parent2"];
    let peers = await Promise.all(pages.map((page, i) => peer(page, devices[i]!)));
    const members = await Promise.all(peers.map(async (p, i) => ({ device: devices[i]!, role: i ? "parent" : "child", key: await p.evaluate((p) => p.publicKey()) })));
    const enroll = async () => { for (const p of peers) for (const member of members) await p.evaluate((p, member) => p.enroll(member), member); };
    await enroll();
    await contexts[0]!.setOffline(true);
    const completion = await peers[0]!.evaluate((p) => p.create({ id: "completion", device: "kid", kind: "complete", occurrence: "daily-2026-11-06" }));
    expect(await peers[1]!.evaluate((p) => p.operations())).toHaveLength(0);
    await contexts[0]!.setOffline(false);
    async function connect(from: number, to: number) {
      const offer = await peers[from]!.evaluate((p, remote) => p.offer(remote), devices[to]!);
      const answer = await peers[to]!.evaluate((p, arg) => p.answer(arg.remote, arg.offer), { remote: devices[from]!, offer });
      await peers[from]!.evaluate((p, arg) => p.accept(arg.remote, arg.answer), { remote: devices[to]!, answer });
      await expect.poll(() => peers[from]!.evaluate((p, remote) => p.ready(remote), devices[to]!)).toBe(true);
    }
    await connect(0, 1); await connect(0, 2); await connect(2, 1);
    for (const remote of ["parent1", "parent2"]) await peers[0]!.evaluate((p, arg) => p.send(arg.remote, arg.completion), { remote, completion });
    for (const p of peers.slice(1)) await expect.poll(async () => (await p.evaluate((p) => p.operations())).length).toBe(1);
    const approvals = await Promise.all(peers.slice(1).map((p, i) => p.evaluate((p, device) => p.create({ id: `approval-${device}`, device, kind: "approve", occurrence: "daily-2026-11-06" }), devices[i + 1]!)));
    for (let i = 0; i < 2; i++) await peers[2]!.evaluate((p, message) => p.send("parent1", message), approvals[1]!);
    await expect.poll(async () => (await peers[1]!.evaluate((p) => p.operations())).length).toBe(3);
    await peers[1]!.evaluate((p) => p.settle());
    expect(await peers[1]!.evaluate((p) => p.balance())).toBe(5);
    await pages[1]!.reload();
    peers = [peers[0]!, await peer(pages[1]!, "parent1"), peers[2]!];
    expect(await peers[1]!.evaluate((p) => p.publicKey())).toEqual(members[1]!.key);
    await enroll(); await peers[1]!.evaluate((p) => p.settle());
    expect(await peers[1]!.evaluate((p) => p.balance())).toBe(5);
    await peers[1]!.evaluate((p) => p.revoke("kid"));
    await expect(peers[1]!.evaluate((p, message) => p.receive(message), completion)).rejects.toThrow("Untrusted operation");
    expect(await peers[0]!.evaluate((p) => p.errors())).toEqual([]);
    expect(await peers[2]!.evaluate((p) => p.errors())).toEqual([]);
  } finally { await Promise.all(contexts.map((context) => context.close())); }
});
