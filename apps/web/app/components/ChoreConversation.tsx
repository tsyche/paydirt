"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { approveTimePrompt, conversationEventLabel, conversationSource, errorMessage, householdDateTime, type ChoreMessage } from "@paydirt/shared";
import { client } from "../lib/client";

type Chore = Awaited<ReturnType<typeof client.getConversationAssignment>>;
type Draft = { body: string; key: string; pending?: boolean };
const Context = createContext<(id: string) => void>(() => {});

export function ConversationButton({ assignmentId }: { assignmentId: string }) {
  const open = useContext(Context);
  return <button className="sm" onClick={() => open(assignmentId)}>Conversation</button>;
}
export function ConversationLink({ source }: { source?: string }) {
  const id = conversationSource(source);
  return id ? <ConversationButton assignmentId={id} /> : null;
}
export function ConversationProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const [id, setId] = useState<string | null>(null);
  return <Context.Provider value={setId}>{children}{id && <Thread key={`${userId}:${id}`} id={id} userId={userId} close={() => setId(null)} />}</Context.Provider>;
}

function Thread({ id, userId, close }: { id: string; userId: string; close: () => void }) {
  const [assignment, setAssignment] = useState<Chore | null>(null);
  const [messages, setMessages] = useState<ChoreMessage[]>([]);
  const [draft, setDraft] = useState<Draft>({ body: "", key: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const working = useRef(false);
  const modal = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = modal.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const storageKey = `paydirt.conversation:${userId}:${id}`;
  const load = useCallback(async () => {
    try {
      const [a, rows] = await Promise.all([client.getConversationAssignment(id), client.listChoreMessages(id)]);
      setAssignment(a); setMessages(rows);
    } catch (e) { setError(errorMessage(e)); }
  }, [id]);
  useEffect(() => {
    try { const raw = localStorage.getItem(storageKey); if (raw) setDraft(JSON.parse(raw)); }
    catch (e) { setError(errorMessage(e)); }
    void load();
    let active = true, stop: (() => void) | undefined;
    void client.subscribeToConversation(id, () => { void load(); }).then((s) => { if (active) stop = s; else s(); }).catch((e) => setError(errorMessage(e)));
    const catchUp = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", catchUp); window.addEventListener("online", catchUp);
    return () => { active = false; stop?.(); document.removeEventListener("visibilitychange", catchUp); window.removeEventListener("online", catchUp); };
  }, [id, storageKey, load]);
  function save(value: Draft) {
    localStorage.setItem(storageKey, JSON.stringify(value)); setDraft(value);
  }
  async function send() {
    if (working.current || !draft.body.trim()) return;
    working.current = true; setBusy(true); setError("");
    const request = { body: draft.body.trim(), key: draft.key || `${Date.now()}-${Math.random().toString(36).slice(2)}`, pending: true };
    try {
      save(request);
      await client.sendChoreMessage(id, request.body, request.key);
      localStorage.removeItem(storageKey); setDraft({ body: "", key: "" }); await load();
    } catch (e) {
      if ([400, 401, 403].includes((e as { status?: number }).status || 0)) save({ ...request, pending: false });
      setError(errorMessage(e));
    } finally { working.current = false; setBusy(false); }
  }
  async function decide(kind: "approve" | "reject") {
    if (!assignment || working.current) return;
    if (kind === "approve") {
      const prompt = approveTimePrompt([{ chore: assignment.expand?.chore, timeChoice: assignment.time_choice }]);
      if (prompt && !window.confirm(prompt)) return;
    }
    working.current = true; setBusy(true); setError("");
    try {
      if (kind === "approve") await client.approveAssignment(id);
      else await client.rejectAssignment(id, reason);
      setRejecting(false); setReason(""); await load();
    } catch (e) { setError(errorMessage(e)); }
    finally { working.current = false; setBusy(false); }
  }
  return <dialog ref={modal} aria-label="Chore conversation" onCancel={(event) => { event.preventDefault(); if (!busy) close(); }} style={{ position: "fixed", inset: 0, margin: 0, border: 0, width: "100vw", height: "100vh", maxWidth: "none", maxHeight: "none", color: "var(--md-on-surface)", background: "#0008", display: "grid", placeItems: "center", padding: 16 }}>
    <section className="card" style={{ width: "min(680px, 100%)", maxHeight: "95vh", overflowY: "auto" }}>
      <div className="row"><h2>Conversation: {assignment?.expand?.chore?.name || "Chore"}</h2><button disabled={busy} onClick={close}>Close conversation</button></div>
      <p>Status: {assignment?.status || "Loading…"}</p>
      <div role="log" aria-label="Chore messages" style={{ maxHeight: "45vh", overflowY: "auto" }}>
        {!messages.length && <p>No messages yet. Sending a message does not approve or reject this chore.</p>}
        {messages.map((message) => <article key={message.id} style={{ padding: "10px 0", borderBottom: "1px solid #8885" }}>
          <strong>{message.author_name}</strong> · {conversationEventLabel(message.kind)}
          <div className="muted">{message.kind === "legacy" ? "Record last updated: " : ""}{householdDateTime(message.created)}</div>
          {message.body && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.body}</p>}
        </article>)}
      </div>
      <label>Message<textarea aria-label="Message" maxLength={1000} rows={3} disabled={busy || !!draft.pending} value={draft.body} onChange={(e) => { try { save({ body: e.target.value, key: "" }); } catch (err) { setError(errorMessage(err)); } }} /></label>
      <button className="primary" disabled={busy || !draft.body.trim()} onClick={() => void send()}>{draft.pending ? "Retry message" : "Send message"}</button>
      <p className="muted">Messages stay in this chore's history. Correct a message with a new reply.</p>
      {error && <p role="alert" className="error">{error}</p>}
      {assignment?.status === "completed" && <div className="inline" style={{ marginTop: 12 }}>
        <button disabled={busy} onClick={() => void decide("approve")}>Approve chore</button>
        <button disabled={busy} onClick={() => setRejecting(!rejecting)}>Reject chore</button>
      </div>}
      {rejecting && <div><label>Reason for return<input aria-label="Reason for return" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label><button disabled={busy} onClick={() => void decide("reject")}>Confirm rejection</button></div>}
    </section>
  </dialog>;
}
