"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Assignment,
  Chore,
  ChoreProposal,
  CurrencyTransaction,
  Household,
  SavingsGoal,
  SpendRequest,
  User,
} from "@paydirt/shared";
import { client } from "../lib/client";
import { HouseholdSettings } from "./HouseholdSettings";

type Expanded<T> = T & { expand?: Record<string, User | Chore> };

const TX_LABEL: Record<string, string> = {
  earn: "Chore reward",
  spend: "Spent",
  manual_adjustment: "Adjustment",
};

const REACTIONS = ["🎉", "👏", "💪", "🌟"];

export function Dashboard({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const householdId = user.household;
  const [household, setHousehold] = useState<Household | null>(null);
  const [kids, setKids] = useState<User[]>([]);
  const [goalsByKid, setGoalsByKid] = useState<Record<string, SavingsGoal[]>>({});
  const [chores, setChores] = useState<Chore[]>([]);
  const [approvals, setApprovals] = useState<Expanded<Assignment>[]>([]);
  const [spend, setSpend] = useState<Expanded<SpendRequest>[]>([]);
  const [proposals, setProposals] = useState<Expanded<ChoreProposal>[]>([]);
  const [recentApproved, setRecentApproved] = useState<Expanded<Assignment>[]>([]);
  const [error, setError] = useState("");

  const currencyName = household?.currency_name?.trim() || "parentBucks";
  const goodsRate = household?.goods_rate ?? 0;

  const reload = useCallback(async () => {
    try {
      const [hh, k, c, a, s, p, ra] = await Promise.all([
        client.getHousehold(householdId),
        client.listChildren(householdId),
        client.listChores(householdId),
        client.listPendingApprovals(householdId),
        client.listPendingSpendRequests(householdId),
        client.listPendingProposals(householdId),
        client.listRecentlyApproved(householdId, 8),
      ]);
      const goals = await Promise.all(k.map((kid) => client.listGoals(kid.id)));
      setHousehold(hh);
      setKids(k);
      setGoalsByKid(Object.fromEntries(k.map((kid, i) => [kid.id, goals[i]])));
      setChores(c);
      setApprovals(a as Expanded<Assignment>[]);
      setSpend(s as Expanded<SpendRequest>[]);
      setProposals(p as Expanded<ChoreProposal>[]);
      setRecentApproved(ra as Expanded<Assignment>[]);
    } catch (e) {
      setError(String(e));
    }
  }, [householdId]);

  useEffect(() => {
    void reload();
    let unsub: (() => void) | undefined;
    let disposed = false;
    client
      .subscribeToDashboardUpdates(householdId, () => void reload())
      .then((fn) => {
        if (disposed) fn();
        else unsub = fn;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unsub?.();
    };
  }, [reload, householdId]);

  const act = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <main>
      <div className="row">
        <h1>PayDirt</h1>
        <div className="inline">
          {household && <HouseholdSettings household={household} onSaved={reload} />}
          <button onClick={onLogout}>Sign out</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <h2>Kids</h2>
      {kids.length === 0 && <p className="muted">No kids in this household yet.</p>}
      {kids.map((kid) => (
        <div className="card" key={kid.id}>
          <div className="row">
            <span>
              {kid.display_name}
              {(kid.streak_count ?? 0) >= 2 ? (
                <span className="muted"> 🔥 {kid.streak_count}-day streak</span>
              ) : null}
            </span>
            <span className="balance">{kid.balance} {currencyName}</span>
          </div>
          {(goalsByKid[kid.id] ?? []).length > 0 && (
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              🎯 {(goalsByKid[kid.id] ?? [])
                .map((g) => `${g.name} (${g.achieved ? "done!" : `${kid.balance}/${g.target}`})`)
                .join(" · ")}
            </div>
          )}
          <div className="inline" style={{ marginTop: 6 }}>
            <AdjustControl kid={kid} onAdjusted={reload} />
            <LedgerToggle kidId={kid.id} />
          </div>
        </div>
      ))}

      {kids.length > 0 && <BroadcastControl householdId={householdId} senderId={user.id} />}

      {proposals.length > 0 && (
        <>
          <h2>Chore ideas from the kids ({proposals.length})</h2>
          {proposals.map((p) => (
            <ProposalRow key={p.id} proposal={p} parentId={user.id} currencyName={currencyName} onActed={reload} />
          ))}
        </>
      )}

      <h2>Pending approvals ({approvals.length})</h2>
      {approvals.length === 0 && <p className="muted">Nothing waiting.</p>}
      {approvals.map((a) => (
        <div className="card row" key={a.id}>
          <div>
            <div>{(a.expand?.chore as Chore | undefined)?.name ?? "Chore"}</div>
            <div className="muted">
              {(a.expand?.child as User | undefined)?.display_name ?? "child"}
            </div>
            {a.rejection_message ? (
              <div className="muted" style={{ fontSize: 13 }}>
                ↩️ Resubmitted — you said: {a.rejection_message}
              </div>
            ) : null}
            {a.kid_response ? (
              <div className="muted" style={{ fontSize: 13 }}>💬 {a.kid_response}</div>
            ) : null}
          </div>
          <div className="inline">
            <button className="primary" onClick={() => act(() => client.approveAssignment(a.id))}>
              Approve
            </button>
            <button
              className="danger"
              onClick={() => {
                const msg = window.prompt("Reason (optional):") ?? "";
                void act(() => client.rejectAssignment(a.id, msg));
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}

      <h2>Spend requests ({spend.length})</h2>
      {spend.length === 0 && <p className="muted">Nothing waiting.</p>}
      {spend.map((s) => (
        <div className="card row" key={s.id}>
          <div>
            <div>
              {(s.expand?.child as User | undefined)?.display_name ?? "child"} — {s.description}
            </div>
            <div className="muted">
              {s.amount} {currencyName}
              {goodsRate > 0 ? ` (≈ $${(s.amount / goodsRate).toFixed(2)})` : ""}
            </div>
          </div>
          <div className="inline">
            <button
              className="primary"
              onClick={() => act(() => client.approveSpendRequest(s.id, user.id))}
            >
              Approve
            </button>
            <button
              className="danger"
              onClick={() => act(() => client.denySpendRequest(s.id, user.id))}
            >
              Deny
            </button>
          </div>
        </div>
      ))}

      <h2>Recently approved ({recentApproved.length})</h2>
      {recentApproved.length === 0 && <p className="muted">No approved chores yet.</p>}
      {recentApproved.map((a) => {
        const chore = a.expand?.chore as Chore | undefined;
        const kid = a.expand?.child as User | undefined;
        return (
          <div className="card row" key={a.id}>
            <div>
              <div>{chore?.name ?? "Chore"}</div>
              <div className="muted">
                {kid?.display_name ?? "child"} · +{chore?.reward ?? "?"} {currencyName}
              </div>
            </div>
            <div className="inline">
              {a.reaction ? (
                <span style={{ fontSize: 20 }}>{a.reaction}</span>
              ) : (
                REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    title="Send a reaction"
                    style={{ padding: "2px 6px" }}
                    onClick={() => act(() => client.reactToAssignment(a.id, emoji))}
                  >
                    {emoji}
                  </button>
                ))
              )}
              <button
                className="danger"
                onClick={() => {
                  const choreName = chore?.name ?? "this chore";
                  const detail = chore && kid
                    ? ` This will deduct ${chore.reward} ${currencyName} from ${kid.display_name}.`
                    : "";
                  if (!window.confirm(`Undo approval for "${choreName}"?${detail}`)) return;
                  void act(() => client.undoApproval(a.id));
                }}
              >
                Undo
              </button>
            </div>
          </div>
        );
      })}

      <h2>Chores</h2>
      <CreateChore household={householdId} parentId={user.id} onCreated={reload} />
      {chores.map((c) => (
        <div className="card row" key={c.id}>
          <div>
            <div>
              {c.race ? "🏁 " : ""}
              {c.name}
              {c.photo_required ? <span className="muted"> 📷</span> : null}
            </div>
            <div className="muted">
              {c.reward} {currencyName} · {c.type}
              {c.due_at ? ` · due ${new Date(c.due_at.replace(" ", "T")).toLocaleString()}` : ""}
              {c.reminder_time ? ` · ⏰ ${c.reminder_time}` : ""}
            </div>
          </div>
          <AssignControl chore={c} kids={kids} onAssigned={reload} />
        </div>
      ))}
    </main>
  );
}

function ProposalRow({
  proposal,
  parentId,
  currencyName,
  onActed,
}: {
  proposal: Expanded<ChoreProposal>;
  parentId: string;
  currencyName: string;
  onActed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kid = proposal.expand?.child as User | undefined;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onActed();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card row">
      <div>
        <div>
          💡 {proposal.name}
          {proposal.description ? <span className="muted"> — {proposal.description}</span> : null}
        </div>
        <div className="muted">
          {kid?.display_name ?? "kid"} asks {proposal.reward_requested} {currencyName}
        </div>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="inline">
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            const answer = window.prompt(
              `Reward for "${proposal.name}"?`,
              String(proposal.reward_requested),
            );
            if (answer === null) return;
            const reward = Number(answer);
            if (!(reward >= 0)) return;
            void run(() => client.approveProposal(proposal, parentId, reward));
          }}
        >
          Approve
        </button>
        <button
          className="danger"
          disabled={busy}
          onClick={() => run(() => client.declineProposal(proposal.id, parentId))}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

function BroadcastControl({ householdId, senderId }: { householdId: string; senderId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function send() {
    if (!message.trim()) return;
    setBusy(true);
    setStatus("");
    try {
      await client.sendBroadcast(householdId, senderId, message.trim());
      setMessage("");
      setStatus("Sent to all kids 📣");
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <div className="inline">
        <input
          placeholder="Message all kids (e.g. Dinner in 10 minutes!)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          style={{ flex: 1 }}
        />
        <button className="primary" onClick={send} disabled={busy || !message.trim()}>
          📣 Send
        </button>
      </div>
      {status && <p className="muted" style={{ margin: 0 }}>{status}</p>}
    </div>
  );
}

function LedgerToggle({ kidId }: { kidId: string }) {
  const [open, setOpen] = useState(false);
  const [txns, setTxns] = useState<CurrencyTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (open) { setOpen(false); return; }
    setLoading(true);
    try {
      const list = await client.listTransactions(kidId);
      setTxns(list);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={toggle} disabled={loading}>
        {loading ? "…" : open ? "Hide history" : "History"}
      </button>
      {open && (
        <div className="stack" style={{ marginTop: 8 }}>
          {txns.length === 0 && <p className="muted">No transactions yet.</p>}
          {txns.map((t) => (
            <div key={t.id} className="row" style={{ fontSize: 13 }}>
              <span className="muted">{t.created.slice(0, 10)}</span>
              <span>{TX_LABEL[t.type] ?? t.type}</span>
              <span style={{ color: t.amount >= 0 ? "#2f7d4f" : "#b3433a", fontWeight: 600 }}>
                {t.amount >= 0 ? "+" : ""}{t.amount}
              </span>
              <span className="muted">{t.reason ?? ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdjustControl({ kid, onAdjusted }: { kid: User; onAdjusted: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (amount === 0 || !reason.trim()) return;
    setBusy(true);
    setError("");
    try {
      await client.adjustBalance(kid.id, amount, reason.trim());
      setAmount(0);
      setReason("");
      setOpen(false);
      onAdjusted();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}>
        Bonus / deduct
      </button>
    );
  }

  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <div className="inline">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          style={{ width: 90 }}
          placeholder="Amount (±)"
        />
        <input
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button className="primary" onClick={submit} disabled={busy || amount === 0 || !reason.trim()}>
          Apply
        </button>
        <button onClick={() => { setOpen(false); setError(""); }}>Cancel</button>
      </div>
      <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>
        Positive = bonus, negative = deduction
      </p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function CreateChore({
  household,
  parentId,
  onCreated,
}: {
  household: string;
  parentId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [reward, setReward] = useState(10);
  const [type, setType] = useState<"oneoff" | "recurring">("oneoff");
  const [photoRequired, setPhotoRequired] = useState(false);
  const [race, setRace] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await client.createChore({
        household,
        name: name.trim(),
        reward,
        type,
        photo_required: photoRequired,
        race,
        due_at: dueAt ? new Date(dueAt).toISOString() : "",
        reminder_time: remindAt,
        created_by: parentId,
        active: true,
      });
      setName("");
      setReward(10);
      setPhotoRequired(false);
      setRace(false);
      setDueAt("");
      setRemindAt("");
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <div className="inline">
        <input
          placeholder="New chore name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          min={0}
          value={reward}
          onChange={(e) => setReward(Number(e.target.value))}
          style={{ width: 90 }}
        />
        <select value={type} onChange={(e) => setType(e.target.value as "oneoff" | "recurring")}>
          <option value="oneoff">one-off</option>
          <option value="recurring">recurring</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={photoRequired}
            onChange={(e) => setPhotoRequired(e.target.checked)}
          />
          📷 required
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={race}
            onChange={(e) => setRace(e.target.checked)}
          />
          🏁 race
        </label>
        <button className="primary" onClick={create} disabled={busy}>
          Add chore
        </button>
      </div>
      <div className="inline" style={{ fontSize: 13 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Due
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Daily reminder
          <input
            type="time"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
          />
        </label>
        <span className="muted">(both optional)</span>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function AssignControl({
  chore,
  kids,
  onAssigned,
}: {
  chore: Chore;
  kids: User[];
  onAssigned: () => void;
}) {
  const [childId, setChildId] = useState("");
  const [busy, setBusy] = useState(false);

  async function assign() {
    if (!childId) return;
    setBusy(true);
    try {
      if (childId === "__race__") {
        await client.startRace(chore.id, kids.map((k) => k.id));
      } else {
        await client.assignChore(chore.id, childId);
      }
      setChildId("");
      onAssigned();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline">
      <select value={childId} onChange={(e) => setChildId(e.target.value)}>
        <option value="">Assign to…</option>
        {chore.race && kids.length > 1 ? (
          <option value="__race__">🏁 Everyone (race!)</option>
        ) : null}
        {kids.map((k) => (
          <option key={k.id} value={k.id}>
            {k.display_name}
          </option>
        ))}
      </select>
      <button onClick={assign} disabled={busy || !childId}>
        Assign
      </button>
    </div>
  );
}
