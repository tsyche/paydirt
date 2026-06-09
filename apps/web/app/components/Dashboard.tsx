"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Assignment,
  Chore,
  SpendRequest,
  User,
} from "@paydirt/shared";
import { client } from "../lib/client";

type Expanded<T> = T & { expand?: Record<string, User | Chore> };

export function Dashboard({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const household = user.household;
  const [kids, setKids] = useState<User[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [approvals, setApprovals] = useState<Expanded<Assignment>[]>([]);
  const [spend, setSpend] = useState<Expanded<SpendRequest>[]>([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const [k, c, a, s] = await Promise.all([
        client.listChildren(household),
        client.listChores(household),
        client.listPendingApprovals(household),
        client.listPendingSpendRequests(household),
      ]);
      setKids(k);
      setChores(c);
      setApprovals(a as Expanded<Assignment>[]);
      setSpend(s as Expanded<SpendRequest>[]);
    } catch (e) {
      setError(String(e));
    }
  }, [household]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
        <button onClick={onLogout}>Sign out</button>
      </div>
      {error && <p className="error">{error}</p>}

      <h2>Kids</h2>
      {kids.length === 0 && <p className="muted">No kids in this household yet.</p>}
      {kids.map((kid) => (
        <div className="card" key={kid.id}>
          <div className="row">
            <span>{kid.display_name}</span>
            <span className="balance">{kid.balance} parentBucks</span>
          </div>
          <AdjustControl kid={kid} onAdjusted={reload} />
        </div>
      ))}

      <h2>Pending approvals ({approvals.length})</h2>
      {approvals.length === 0 && <p className="muted">Nothing waiting.</p>}
      {approvals.map((a) => (
        <div className="card row" key={a.id}>
          <div>
            <div>{(a.expand?.chore as Chore | undefined)?.name ?? "Chore"}</div>
            <div className="muted">
              {(a.expand?.child as User | undefined)?.display_name ?? "child"}
            </div>
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
            <div className="muted">{s.amount} parentBucks</div>
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

      <h2>Chores</h2>
      <CreateChore household={household} parentId={user.id} kids={kids} onCreated={reload} />
      {chores.map((c) => (
        <div className="card row" key={c.id}>
          <div>
            <div>{c.name}</div>
            <div className="muted">
              {c.reward} parentBucks · {c.type}
            </div>
          </div>
          <AssignControl chore={c} kids={kids} onAssigned={reload} />
        </div>
      ))}
    </main>
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
      <button style={{ marginTop: 6 }} onClick={() => setOpen(true)}>
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
  kids: User[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [reward, setReward] = useState(10);
  const [type, setType] = useState<"oneoff" | "recurring">("oneoff");
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
        created_by: parentId,
        active: true,
      });
      setName("");
      setReward(10);
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
        <button className="primary" onClick={create} disabled={busy}>
          Add chore
        </button>
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
      await client.assignChore(chore.id, childId);
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
