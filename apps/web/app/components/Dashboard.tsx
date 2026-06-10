"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Assignment,
  Chore,
  CurrencyTransaction,
  Household,
  SpendRequest,
  User,
} from "@paydirt/shared";
import { client } from "../lib/client";

type Expanded<T> = T & { expand?: Record<string, User | Chore> };

const TX_LABEL: Record<string, string> = {
  chore_reward: "Chore reward",
  spend_deduction: "Spent",
  manual_adjustment: "Adjustment",
};

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
  const [chores, setChores] = useState<Chore[]>([]);
  const [approvals, setApprovals] = useState<Expanded<Assignment>[]>([]);
  const [spend, setSpend] = useState<Expanded<SpendRequest>[]>([]);
  const [recentApproved, setRecentApproved] = useState<Expanded<Assignment>[]>([]);
  const [error, setError] = useState("");

  const currencyName = household?.currency_name?.trim() || "parentBucks";

  const reload = useCallback(async () => {
    try {
      const [hh, k, c, a, s, ra] = await Promise.all([
        client.getHousehold(householdId),
        client.listChildren(householdId),
        client.listChores(householdId),
        client.listPendingApprovals(householdId),
        client.listPendingSpendRequests(householdId),
        client.listRecentlyApproved(8),
      ]);
      setHousehold(hh);
      setKids(k);
      setChores(c);
      setApprovals(a as Expanded<Assignment>[]);
      setSpend(s as Expanded<SpendRequest>[]);
      setRecentApproved(ra as Expanded<Assignment>[]);
    } catch (e) {
      setError(String(e));
    }
  }, [householdId]);

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
        <div className="inline">
          <CurrencyNameControl
            householdId={householdId}
            current={currencyName}
            onSaved={reload}
          />
          <button onClick={onLogout}>Sign out</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <h2>Kids</h2>
      {kids.length === 0 && <p className="muted">No kids in this household yet.</p>}
      {kids.map((kid) => (
        <div className="card" key={kid.id}>
          <div className="row">
            <span>{kid.display_name}</span>
            <span className="balance">{kid.balance} {currencyName}</span>
          </div>
          <div className="inline" style={{ marginTop: 6 }}>
            <AdjustControl kid={kid} onAdjusted={reload} />
            <LedgerToggle kidId={kid.id} />
          </div>
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
            <div className="muted">{s.amount} {currencyName}</div>
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
            <button
              className="danger"
              onClick={() => {
                if (!kid || !chore) return;
                if (!window.confirm(`Undo approval for "${chore.name}"? This will deduct ${chore.reward} parentBucks from ${kid.display_name}.`)) return;
                void act(() => client.reverseApproval(kid.id, chore.reward, chore.name));
              }}
            >
              Undo
            </button>
          </div>
        );
      })}

      <h2>Chores</h2>
      <CreateChore household={householdId} parentId={user.id} kids={kids} onCreated={reload} />
      {chores.map((c) => (
        <div className="card row" key={c.id}>
          <div>
            <div>
              {c.name}
              {c.photo_required ? <span className="muted"> 📷</span> : null}
            </div>
            <div className="muted">
              {c.reward} {currencyName} · {c.type}
            </div>
          </div>
          <AssignControl chore={c} kids={kids} onAssigned={reload} />
        </div>
      ))}
    </main>
  );
}

function CurrencyNameControl({
  householdId,
  current,
  onSaved,
}: {
  householdId: string;
  current: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await client.updateHousehold(householdId, { currency_name: value.trim() || "" });
      setEditing(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        style={{ fontSize: 12, opacity: 0.7 }}
        onClick={() => { setValue(current); setEditing(true); }}
      >
        💱 {current}
      </button>
    );
  }

  return (
    <div className="inline">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="parentBucks"
        style={{ width: 120 }}
        autoFocus
      />
      <button className="primary" onClick={save} disabled={busy}>Save</button>
      <button onClick={() => setEditing(false)}>Cancel</button>
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
  kids: User[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [reward, setReward] = useState(10);
  const [type, setType] = useState<"oneoff" | "recurring">("oneoff");
  const [photoRequired, setPhotoRequired] = useState(false);
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
        created_by: parentId,
        active: true,
      });
      setName("");
      setReward(10);
      setPhotoRequired(false);
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
