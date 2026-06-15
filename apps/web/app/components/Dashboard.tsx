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
  const [selectedApprovals, setSelectedApprovals] = useState<Set<string>>(new Set());
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
      setSelectedApprovals(new Set());
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
    <div className="app-shell">
      {/* ── App Bar ── */}
      <header className="app-bar">
        <div className="app-bar-inner">
          <div className="app-bar-title">
            <span className="app-bar-logo">💰</span>
            PayDirt
          </div>
          <div className="inline">
            {household && (
              <HouseholdSettings household={household} onSaved={reload} />
            )}
            <button className="outlined sm" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main>
        {error && <p className="error" style={{ marginBottom: 12 }}>⚠️ {error}</p>}

        {/* ── Kids ── */}
        <h2>Kids</h2>
        {kids.length === 0 && (
          <p className="muted">No kids in this household yet.</p>
        )}
        {kids.map((kid) => (
          <div
            className="card"
            key={kid.id}
            style={{ borderLeft: `4px solid ${kid.color ?? "#2f7d4f"}` }}
          >
            <div className="row">
              <div className="inline" style={{ gap: 12 }}>
                <div
                  className="kid-avatar"
                  style={{ backgroundColor: `color-mix(in srgb, ${kid.color ?? "#2f7d4f"} 18%, transparent)` }}
                >
                  {kid.avatar || "🧒"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {kid.display_name}
                    {(kid.streak_count ?? 0) >= 2 && (
                      <span className="chip chip-primary" style={{ marginLeft: 8, fontSize: 11 }}>
                        🔥 {kid.streak_count}-day streak
                      </span>
                    )}
                  </div>
                  {(goalsByKid[kid.id] ?? []).length > 0 && (
                    <div className="muted" style={{ marginTop: 2 }}>
                      🎯{" "}
                      {(goalsByKid[kid.id] ?? [])
                        .map((g) =>
                          `${g.name} (${g.achieved ? "done!" : `${kid.balance}/${g.target}`})`
                        )
                        .join(" · ")}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="balance" style={{ fontSize: 18 }}>
                  {kid.balance}
                  <span style={{ fontWeight: 400, fontSize: 13, marginLeft: 4 }}>
                    {currencyName}
                  </span>
                </div>
                {goodsRate > 0 && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    ${(kid.balance / goodsRate).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
            <div className="inline" style={{ marginTop: 10 }}>
              <AdjustControl kid={kid} onAdjusted={reload} />
              <LedgerToggle kidId={kid.id} />
              <AvatarControl kid={kid} onSaved={reload} />
            </div>
          </div>
        ))}

        {kids.length > 0 && (
          <BroadcastControl householdId={householdId} senderId={user.id} />
        )}

        {/* ── Chore proposals ── */}
        {proposals.length > 0 && (
          <>
            <h2>💡 Chore ideas from the kids ({proposals.length})</h2>
            {proposals.map((p) => (
              <ProposalRow
                key={p.id}
                proposal={p}
                parentId={user.id}
                currencyName={currencyName}
                onActed={reload}
              />
            ))}
          </>
        )}

        {/* ── Pending approvals — priority section ── */}
        <div className="section-priority">
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: "28px 0 12px" }}>
              ✅ Pending approvals ({approvals.length})
            </h2>
            {approvals.length > 1 && (
              <div className="inline">
                {selectedApprovals.size > 0 && (
                  <button
                    className="primary sm"
                    onClick={() =>
                      act(() =>
                        Promise.all(
                          [...selectedApprovals].map((id) => client.approveAssignment(id))
                        ).then(() => {})
                      )
                    }
                  >
                    Approve selected ({selectedApprovals.size})
                  </button>
                )}
                <button
                  className="primary sm"
                  onClick={() =>
                    act(() =>
                      Promise.all(approvals.map((a) => client.approveAssignment(a.id))).then(
                        () => {}
                      )
                    )
                  }
                >
                  Approve all
                </button>
                <label className="inline" style={{ fontSize: 13, gap: 6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedApprovals.size === approvals.length}
                    onChange={(e) =>
                      setSelectedApprovals(
                        e.target.checked ? new Set(approvals.map((a) => a.id)) : new Set()
                      )
                    }
                  />
                  Select all
                </label>
              </div>
            )}
          </div>
          {approvals.length === 0 && (
            <p className="muted" style={{ paddingBottom: 8 }}>Nothing waiting. 🎉</p>
          )}
          {approvals.map((a) => (
            <div className="card row" key={a.id} style={{ alignItems: "flex-start" }}>
              <div className="inline" style={{ gap: 10, alignItems: "flex-start", flex: 1 }}>
                {approvals.length > 1 && (
                  <input
                    type="checkbox"
                    style={{ marginTop: 2 }}
                    checked={selectedApprovals.has(a.id)}
                    onChange={(e) => {
                      const next = new Set(selectedApprovals);
                      if (e.target.checked) { next.add(a.id); } else { next.delete(a.id); }
                      setSelectedApprovals(next);
                    }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {(a.expand?.chore as Chore | undefined)?.name ?? "Chore"}
                  </div>
                  <div className="muted">
                    {(a.expand?.child as User | undefined)?.display_name ?? "child"}
                  </div>
                  {a.rejection_message && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      ↩️ Resubmitted — you said: {a.rejection_message}
                    </div>
                  )}
                  {a.kid_response && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      💬 {a.kid_response}
                    </div>
                  )}
                </div>
              </div>
              <div className="inline" style={{ flexShrink: 0 }}>
                <button
                  className="primary sm"
                  onClick={() => act(() => client.approveAssignment(a.id))}
                >
                  Approve
                </button>
                <button
                  className="danger sm"
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
        </div>

        {/* ── Spend requests ── */}
        <h2>💸 Spend requests ({spend.length})</h2>
        {spend.length === 0 && <p className="muted">Nothing waiting.</p>}
        {spend.map((s) => (
          <div className="card row" key={s.id} style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {(s.expand?.child as User | undefined)?.display_name ?? "child"}
                <span style={{ fontWeight: 400 }}> — {s.description}</span>
              </div>
              <div className="muted">
                <span className="balance" style={{ fontSize: 13 }}>{s.amount}</span>
                {" "}{currencyName}
                {goodsRate > 0 && ` (≈ $${(s.amount / goodsRate).toFixed(2)})`}
              </div>
            </div>
            <div className="inline" style={{ flexShrink: 0 }}>
              <button
                className="primary sm"
                onClick={() => act(() => client.approveSpendRequest(s.id, user.id))}
              >
                Approve
              </button>
              <button
                className="danger sm"
                onClick={() => act(() => client.denySpendRequest(s.id, user.id))}
              >
                Deny
              </button>
            </div>
          </div>
        ))}

        {/* ── Recently approved ── */}
        <h2>🏆 Recently approved ({recentApproved.length})</h2>
        {recentApproved.length === 0 && <p className="muted">No approved chores yet.</p>}
        {recentApproved.map((a) => {
          const chore = a.expand?.chore as Chore | undefined;
          const kid = a.expand?.child as User | undefined;
          return (
            <div className="card row" key={a.id} style={{ flexWrap: "wrap", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 600 }}>{chore?.name ?? "Chore"}</div>
                <div className="muted">
                  {kid?.display_name ?? "child"} ·{" "}
                  <span className="balance" style={{ fontSize: 13 }}>
                    +{chore?.reward ?? "?"}
                  </span>{" "}
                  {currencyName}
                </div>
              </div>
              <div className="inline">
                {a.reaction ? (
                  <span style={{ fontSize: 22 }}>{a.reaction}</span>
                ) : (
                  REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      className="reaction-btn"
                      title="Send a reaction"
                      onClick={() => act(() => client.reactToAssignment(a.id, emoji))}
                    >
                      {emoji}
                    </button>
                  ))
                )}
                <button
                  className="danger sm"
                  onClick={() => {
                    const choreName = chore?.name ?? "this chore";
                    const detail =
                      chore && kid
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

        {/* ── Chores ── */}
        <h2>📋 Chores</h2>
        <CreateChore household={householdId} parentId={user.id} onCreated={reload} />
        {chores.map((c) => (
          <div className="card row" key={c.id} style={{ flexWrap: "wrap", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 600 }}>
                {c.race ? "🏁 " : ""}
                {c.name}
                {c.photo_required && <span className="muted"> 📷</span>}
              </div>
              <div className="muted">
                <span className="balance" style={{ fontSize: 13 }}>{c.reward}</span>
                {" "}{currencyName} · {c.type}
                {c.cadence ? ` (${c.cadence})` : ""}
                {c.due_at
                  ? ` · due ${new Date(c.due_at.replace(" ", "T")).toLocaleString()}`
                  : ""}
                {c.reminder_time ? ` · ⏰ ${c.reminder_time}` : ""}
              </div>
            </div>
            <AssignControl chore={c} kids={kids} onAssigned={reload} />
          </div>
        ))}
      </main>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

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
    <div className="card row" style={{ flexWrap: "wrap", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontWeight: 600 }}>
          💡 {proposal.name}
          {proposal.description && (
            <span className="muted" style={{ fontWeight: 400 }}> — {proposal.description}</span>
          )}
        </div>
        <div className="muted">
          {kid?.display_name ?? "kid"} asks{" "}
          <span className="balance" style={{ fontSize: 13 }}>{proposal.reward_requested}</span>
          {" "}{currencyName}
        </div>
        {error && <p className="error" style={{ marginTop: 4 }}>{error}</p>}
      </div>
      <div className="inline" style={{ flexShrink: 0 }}>
        <button
          className="primary sm"
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
          className="danger sm"
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
    <div className="card" style={{ marginTop: 4 }}>
      <div className="inline">
        <input
          placeholder="📣 Message all kids (e.g. Dinner in 10 minutes!)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          style={{ flex: 1 }}
        />
        <button
          className="primary sm"
          onClick={send}
          disabled={busy || !message.trim()}
        >
          Send
        </button>
      </div>
      {status && (
        <p className="muted" style={{ margin: "8px 0 0" }}>{status}</p>
      )}
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
      <button className="sm" onClick={toggle} disabled={loading}>
        {loading ? "…" : open ? "Hide history" : "History"}
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {txns.length === 0 && <p className="muted">No transactions yet.</p>}
          {txns.map((t) => (
            <div key={t.id} className="ledger-row">
              <span className="muted">{t.created.slice(0, 10)}</span>
              <span>{TX_LABEL[t.type] ?? t.type}</span>
              <span className={t.amount >= 0 ? "amount-positive" : "amount-negative"}>
                {t.amount >= 0 ? "+" : ""}{t.amount}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>{t.reason ?? ""}</span>
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
      <button className="sm" onClick={() => setOpen(true)}>
        Bonus / deduct
      </button>
    );
  }

  return (
    <div className="stack" style={{ marginTop: 8, width: "100%" }}>
      <div className="inline">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          style={{ width: 100 }}
          placeholder="Amount (±)"
        />
        <input
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          className="primary sm"
          onClick={submit}
          disabled={busy || amount === 0 || !reason.trim()}
        >
          Apply
        </button>
        <button
          className="sm"
          onClick={() => { setOpen(false); setError(""); }}
        >
          Cancel
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--md-on-surface-variant)", margin: 0 }}>
        Positive = bonus · Negative = deduction
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
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">("weekly");
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
        cadence: type === "recurring" ? cadence : undefined,
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
    <div className="card-filled" style={{ marginBottom: 12 }}>
      <div className="inline" style={{ marginBottom: 8 }}>
        <input
          placeholder="New chore name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void create(); }}
          style={{ flex: 1 }}
        />
        <input
          type="number"
          min={0}
          value={reward}
          onChange={(e) => setReward(Number(e.target.value))}
          style={{ width: 90 }}
          placeholder="Reward"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "oneoff" | "recurring")}
        >
          <option value="oneoff">one-off</option>
          <option value="recurring">recurring</option>
        </select>
        {type === "recurring" && (
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as "daily" | "weekly" | "monthly")}
          >
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
          </select>
        )}
        <button
          className="primary sm"
          onClick={create}
          disabled={busy || !name.trim()}
        >
          Add chore
        </button>
      </div>
      <div className="inline" style={{ fontSize: 13, gap: 12 }}>
        <label className="inline" style={{ gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={photoRequired}
            onChange={(e) => setPhotoRequired(e.target.checked)}
          />
          📷 Photo required
        </label>
        <label className="inline" style={{ gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={race}
            onChange={(e) => setRace(e.target.checked)}
          />
          🏁 Race
        </label>
        <label className="inline" style={{ gap: 6 }}>
          Due
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </label>
        <label className="inline" style={{ gap: 6 }}>
          Daily reminder
          <input
            type="time"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
          />
        </label>
        <span className="muted">(both optional)</span>
      </div>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

const AVATAR_COLORS = ["#e53935", "#8e24aa", "#1e88e5", "#00897b", "#f4511e", "#f9a825"];

function AvatarControl({ kid, onSaved }: { kid: User; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState(kid.avatar ?? "");
  const [color, setColor] = useState(kid.color ?? AVATAR_COLORS[0]);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button className="sm" style={{ fontSize: 13 }} onClick={() => setOpen(true)}>
        ✏️ Avatar
      </button>
    );
  }

  return (
    <div className="inline" style={{ flexWrap: "wrap", gap: 8, marginTop: 4 }}>
      <input
        placeholder="Emoji (e.g. 🦊)"
        value={avatar}
        onChange={(e) => setAvatar(e.target.value)}
        style={{ width: 110 }}
      />
      <div className="inline" style={{ gap: 4 }}>
        {AVATAR_COLORS.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => setColor(c)}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              backgroundColor: c,
              border: color === c ? "3px solid var(--md-on-surface)" : "2px solid transparent",
              padding: 0,
              boxShadow: color === c ? "0 0 0 2px var(--md-surface)" : "none",
            }}
          />
        ))}
      </div>
      <button
        className="primary sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await client.pb.collection("users").update(kid.id, { avatar: avatar.trim(), color });
            setOpen(false);
            onSaved();
          } finally {
            setBusy(false);
          }
        }}
      >
        Save
      </button>
      <button className="sm" onClick={() => setOpen(false)}>Cancel</button>
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
    <div className="inline" style={{ flexShrink: 0 }}>
      <select value={childId} onChange={(e) => setChildId(e.target.value)}>
        <option value="">Assign to…</option>
        {chore.race && kids.length > 1 && (
          <option value="__race__">🏁 Everyone (race!)</option>
        )}
        {kids.map((k) => (
          <option key={k.id} value={k.id}>
            {k.avatar ? `${k.avatar} ` : ""}{k.display_name}
          </option>
        ))}
      </select>
      <button
        className="tonal sm"
        onClick={assign}
        disabled={busy || !childId}
      >
        Assign
      </button>
    </div>
  );
}
