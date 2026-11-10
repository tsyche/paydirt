"use client";
import { ConversationLink } from "./ChoreConversation";
import { useCallback, useEffect, useState } from "react";
import { errorMessage, householdDateTime, type InboxItem } from "@paydirt/shared";
import { client } from "../lib/client";
import { ArchiveButton, useArchives } from "./ArchiveActions";
import { ArchiveHistory } from "./ArchiveHistory";

export function InboxView({ userId }: { userId: string }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [archived, setArchived] = useState(false);
  const { version } = useArchives();
  const load = useCallback(async () => {
    try { setItems(await client.listInbox(userId)); setError(""); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }, [userId]);
  useEffect(() => { void load(); }, [load, version]);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    void client.subscribeToInbox(userId, () => void load()).then((fn) => { if (disposed) fn(); else stop = fn; }).catch(() => {});
    return () => { disposed = true; stop?.(); };
  }, [userId, load]);
  return <div className="stack" style={{ gap: 12 }}>
    <div className="inline"><button aria-pressed={!archived} onClick={() => setArchived(false)}>Alerts</button><button aria-pressed={archived} onClick={() => setArchived(true)}>Archived</button></div>
    {archived ? <ArchiveHistory /> : <>
      {error && <><p className="error" role="alert">{error}</p><button onClick={() => void load()}>Retry</button></>}
      {busy && <p>Loading…</p>}
      {!busy && !error && !items.length && <p>No alerts 🎉</p>}
      {items.map((item) => <div className="card row" key={item.id}>
        <div><strong>{item.title}</strong>{item.body && <div>{item.body}</div>}<div className="muted">{householdDateTime(item.created)}</div></div>
        <ConversationLink source={item.source} />
        <ArchiveButton kind="inbox" id={item.id} label={item.title} />
      </div>)}
    </>}
  </div>;
}
