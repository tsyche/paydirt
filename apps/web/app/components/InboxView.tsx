"use client";

import { useEffect, useState } from "react";
import { errorMessage, type InboxItem } from "@paydirt/shared";
import { client } from "../lib/client";

/** The parent's alert history. Items are only copies of pushes, so any can be removed. */
export function InboxView({ userId }: { userId: string }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems(await client.listInbox(userId));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [userId]);

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await client.deleteInboxItem(id);
    } catch (e) {
      setError(errorMessage(e));
      void load();
    }
  }

  async function clearAll() {
    try {
      await client.clearInbox(userId);
      setItems([]);
    } catch (e) {
      setError(errorMessage(e));
      void load();
    }
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="sm" onClick={() => void clearAll()} disabled={items.length === 0}>
          Clear all
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {busy && <p className="muted">Loading…</p>}
      {!busy && !error && items.length === 0 && <p className="muted">No alerts 🎉</p>}
      {items.map((i) => (
        <div
          key={i.id}
          className="row"
          style={{ gap: 8, alignItems: "center", borderTop: "1px solid var(--border, #eee)", paddingTop: 8 }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{i.title}</div>
            {i.body && <div>{i.body}</div>}
            <div className="muted" style={{ fontSize: 12 }}>
              {new Date(i.created.replace(" ", "T")).toLocaleString()}
            </div>
          </div>
          <button className="sm" aria-label={`Dismiss ${i.title}`} onClick={() => void remove(i.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
