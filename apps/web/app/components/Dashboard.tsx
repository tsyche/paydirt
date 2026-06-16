"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Assignment,
  Chore,
  ChoreProposal,
  ChoreTemplate,
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
  const [templateFill, setTemplateFill] = useState<ChoreTemplate | null>(null);

  const currencyName = household?.currency_name?.trim() || "parentBucks";
  const goodsRate = household?.goods_rate ?? 0;
  const kidRate = (kid: User) => kid.goods_rate ?? goodsRate;

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
                {kidRate(kid) > 0 && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    ${(kid.balance / kidRate(kid)).toFixed(2)}
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
        {spend.map((s) => {
          const spendKid = kids.find((k) => k.id === s.child);
          const spendRate = kidRate(spendKid ?? {} as User);
          return (
          <div className="card row" key={s.id} style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {(s.expand?.child as User | undefined)?.display_name ?? "child"}
                <span style={{ fontWeight: 400 }}> — {s.description}</span>
              </div>
              <div className="muted">
                <span className="balance" style={{ fontSize: 13 }}>{s.amount}</span>
                {" "}{currencyName}
                {spendRate > 0 && ` (≈ $${(s.amount / spendRate).toFixed(2)})`}
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
          );
        })}

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

        {/* ── Activity report ── */}
        <ActivityReport kids={kids} currencyName={currencyName} />

        {/* ── Chores ── */}
        <h2>📋 Chores</h2>
        <ChoreTemplatesPanel
          householdId={householdId}
          onUse={(t) => setTemplateFill(t)}
        />
        <CreateChore
          household={householdId}
          parentId={user.id}
          onCreated={reload}
          template={templateFill}
          onTemplateClear={() => setTemplateFill(null)}
        />
        {chores.map((c) => (
          <ChoreRow key={c.id} chore={c} kids={kids} currencyName={currencyName} onChanged={reload} />
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

function ChoreRow({
  chore,
  kids,
  currencyName,
  onChanged,
}: {
  chore: Chore;
  kids: User[];
  currencyName: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(chore.name);
  const [reward, setReward] = useState(chore.reward);
  const [type, setType] = useState<"oneoff" | "recurring">(chore.type);
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">(
    (chore.cadence as "daily" | "weekly" | "monthly") ?? "weekly"
  );
  const [photoRequired, setPhotoRequired] = useState(chore.photo_required);
  const [race, setRace] = useState(chore.race ?? false);
  const [remindAt, setRemindAt] = useState(chore.reminder_time ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function cancelEdit() {
    setName(chore.name);
    setReward(chore.reward);
    setType(chore.type);
    setCadence((chore.cadence as "daily" | "weekly" | "monthly") ?? "weekly");
    setPhotoRequired(chore.photo_required);
    setRace(chore.race ?? false);
    setRemindAt(chore.reminder_time ?? "");
    setError("");
    setEditing(false);
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await client.updateChore(chore.id, {
        name: name.trim(),
        reward,
        type,
        cadence: type === "recurring" ? cadence : undefined,
        photo_required: photoRequired,
        race,
        reminder_time: remindAt,
      });
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!confirm(`Archive "${chore.name}"? It won't appear in the chore list anymore.`)) return;
    setBusy(true);
    try {
      await client.deactivateChore(chore.id);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="card row" style={{ flexWrap: "wrap", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 600 }}>
            {chore.race ? "🏁 " : ""}
            {chore.name}
            {chore.photo_required && <span className="muted"> 📷</span>}
          </div>
          <div className="muted">
            <span className="balance" style={{ fontSize: 13 }}>{chore.reward}</span>
            {" "}{currencyName} · {chore.type}
            {chore.cadence ? ` (${chore.cadence})` : ""}
            {chore.due_at
              ? ` · due ${new Date(chore.due_at.replace(" ", "T")).toLocaleString()}`
              : ""}
            {chore.reminder_time ? ` · ⏰ ${chore.reminder_time}` : ""}
          </div>
        </div>
        <div className="inline" style={{ gap: 6 }}>
          <AssignControl chore={chore} kids={kids} onAssigned={onChanged} />
          <button className="sm" onClick={() => setEditing(true)} title="Edit chore">✏️</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-filled" style={{ marginBottom: 8 }}>
      <div className="inline" style={{ marginBottom: 8 }}>
        <input
          placeholder="Chore name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
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
        <select value={type} onChange={(e) => setType(e.target.value as "oneoff" | "recurring")}>
          <option value="oneoff">one-off</option>
          <option value="recurring">recurring</option>
        </select>
        {type === "recurring" && (
          <select value={cadence} onChange={(e) => setCadence(e.target.value as "daily" | "weekly" | "monthly")}>
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
          </select>
        )}
      </div>
      <div className="inline" style={{ fontSize: 13, gap: 12, marginBottom: 8 }}>
        <label className="inline" style={{ gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={photoRequired} onChange={(e) => setPhotoRequired(e.target.checked)} />
          📷 Photo required
        </label>
        <label className="inline" style={{ gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={race} onChange={(e) => setRace(e.target.checked)} />
          🏁 Race
        </label>
        <label className="inline" style={{ gap: 6 }}>
          Daily reminder
          <input type="time" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
        </label>
      </div>
      <div className="inline" style={{ gap: 8 }}>
        <button className="primary sm" onClick={save} disabled={busy || !name.trim()}>Save</button>
        <button className="sm" onClick={cancelEdit} disabled={busy}>Cancel</button>
        <button className="danger sm" onClick={deactivate} disabled={busy} style={{ marginLeft: "auto" }}>
          Archive
        </button>
      </div>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

function CreateChore({
  household,
  parentId,
  onCreated,
  template,
  onTemplateClear,
}: {
  household: string;
  parentId: string;
  onCreated: () => void;
  template?: ChoreTemplate | null;
  onTemplateClear?: () => void;
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

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setReward(template.reward);
    setType(template.type);
    if (template.cadence && (template.cadence === "daily" || template.cadence === "weekly" || template.cadence === "monthly")) {
      setCadence(template.cadence);
    }
    setPhotoRequired(template.photo_required ?? false);
    setRace(template.race ?? false);
    setRemindAt(template.reminder_time ?? "");
  }, [template]);

  function reset() {
    setName("");
    setReward(10);
    setType("oneoff");
    setCadence("weekly");
    setPhotoRequired(false);
    setRace(false);
    setDueAt("");
    setRemindAt("");
    onTemplateClear?.();
  }

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
      reset();
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await client.createTemplate({
        household,
        name: name.trim(),
        reward,
        type,
        cadence: type === "recurring" ? cadence : undefined,
        photo_required: photoRequired,
        race,
        reminder_time: remindAt,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-filled" style={{ marginBottom: 12 }}>
      {template && (
        <div className="inline" style={{ marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: "var(--md-primary)", fontWeight: 600 }}>📋 From template</span>
          <button className="sm" onClick={reset} style={{ fontSize: 12 }}>✕ Clear</button>
        </div>
      )}
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
        <button
          className="outlined sm"
          onClick={saveTemplate}
          disabled={busy || !name.trim()}
          title="Save current fields as a reusable template"
        >
          💾 Save template
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

function ChoreTemplatesPanel({
  householdId,
  onUse,
}: {
  householdId: string;
  onUse: (t: ChoreTemplate) => void;
}) {
  const [templates, setTemplates] = useState<ChoreTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    client.listTemplates(householdId).then(setTemplates).catch(() => {});
  }, [householdId, open]);

  async function remove(id: string) {
    setBusy(true);
    try {
      await client.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setBusy(false);
    }
  }

  if (templates.length === 0) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        className="outlined sm"
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: 13 }}
      >
        📋 Templates ({templates.length}) {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="card" style={{ marginTop: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {templates.map((t) => (
            <div
              key={t.id}
              className="inline"
              style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}
            >
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {t.name}
                <span className="muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 13 }}>
                  {t.reward} · {t.type}{t.cadence ? ` · ${t.cadence}` : ""}
                  {t.photo_required ? " · 📷" : ""}
                  {t.race ? " · 🏁" : ""}
                </span>
              </span>
              <div className="inline" style={{ gap: 6 }}>
                <button
                  className="tonal sm"
                  onClick={() => { onUse(t); setOpen(false); }}
                >
                  Use
                </button>
                <button
                  className="danger sm"
                  onClick={() => void remove(t.id)}
                  disabled={busy}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const AVATAR_COLORS = ["#e53935", "#8e24aa", "#1e88e5", "#00897b", "#f4511e", "#f9a825"];

function AvatarControl({ kid, onSaved }: { kid: User; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState(kid.avatar ?? "");
  const [color, setColor] = useState(kid.color ?? AVATAR_COLORS[0]);
  const [goodsRateOverride, setGoodsRateOverride] = useState(String(kid.goods_rate ?? ""));
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button className="sm" style={{ fontSize: 13 }} onClick={() => setOpen(true)}>
        ✏️ Edit
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4, alignItems: "center" }}>
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
      <input
        type="number"
        placeholder="Goods rate (per $1)"
        value={goodsRateOverride}
        onChange={(e) => setGoodsRateOverride(e.target.value)}
        style={{ width: 150 }}
        min={0}
      />
      <button
        className="primary sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const rate = parseFloat(goodsRateOverride);
            await client.pb.collection("users").update(kid.id, {
              avatar: avatar.trim(),
              color,
              goods_rate: isNaN(rate) || rate <= 0 ? null : rate,
            });
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(kidId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(kidId)) next.delete(kidId);
      else next.add(kidId);
      return next;
    });
  }

  async function assign() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      for (const kidId of selected) {
        await client.assignChore(chore.id, kidId);
      }
      setSelected(new Set());
      onAssigned();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline" style={{ flexShrink: 0 }}>
      {kids.map((k) => (
        <label
          key={k.id}
          style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 13 }}
        >
          <input
            type="checkbox"
            checked={selected.has(k.id)}
            onChange={() => toggle(k.id)}
            disabled={busy}
          />
          {k.avatar ? `${k.avatar} ` : ""}{k.display_name}
        </label>
      ))}
      <button
        className="tonal sm"
        onClick={assign}
        disabled={busy || selected.size === 0}
      >
        Assign
      </button>
    </div>
  );
}

function streakPeak(assignments: Assignment[]): number {
  const days = [
    ...new Set(
      assignments
        .map((a) => a.approved_at?.slice(0, 10))
        .filter((d): d is string => !!d)
    ),
  ].sort();
  let peak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of days) {
    const cur = new Date(d);
    if (prev && (cur.getTime() - prev.getTime()) / 86400000 === 1) {
      run++;
    } else {
      run = 1;
    }
    if (run > peak) peak = run;
    prev = cur;
  }
  return peak;
}

function ActivityReport({
  kids,
  currencyName,
}: {
  kids: User[];
  currencyName: string;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<
    { kid: User; chores: number; earned: number; spent: number; peak: number }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || kids.length === 0) return;
    setLoading(true);
    Promise.all(
      kids.map(async (kid) => {
        const [txns, assignments] = await Promise.all([
          client.listTransactionsForMonth(kid.id, year, month),
          client.listApprovedAssignmentsForMonth(kid.id, year, month),
        ]);
        const earned = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const spent = txns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        return { kid, chores: assignments.length, earned, spent, peak: streakPeak(assignments) };
      })
    )
      .then(setData)
      .finally(() => setLoading(false));
  }, [open, kids, year, month]);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        className="sm outlined"
        onClick={() => setOpen((v) => !v)}
        style={{ marginBottom: open ? 12 : 0 }}
      >
        📊 {open ? "Hide" : "Show"} activity report
      </button>
      {open && (
        <div>
          <div className="inline" style={{ marginBottom: 12 }}>
            <button className="sm" onClick={() => shiftMonth(-1)}>‹</button>
            <span style={{ fontWeight: 600, minWidth: 140, textAlign: "center" }}>{monthLabel}</span>
            <button className="sm" onClick={() => shiftMonth(1)} disabled={year === now.getFullYear() && month === now.getMonth() + 1}>›</button>
          </div>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : (
            <div className="inline" style={{ flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
              {data.map(({ kid, chores, earned, spent, peak }) => (
                <div key={kid.id} className="card" style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    {kid.avatar ? `${kid.avatar} ` : ""}{kid.display_name}
                  </div>
                  <div className="muted" style={{ lineHeight: 1.7 }}>
                    <div>✅ Chores: <strong>{chores}</strong></div>
                    <div>💰 Earned: <strong className="balance">{earned}</strong> {currencyName}</div>
                    <div>🛍️ Spent: <strong>{spent}</strong> {currencyName}</div>
                    <div>🔥 Streak peak: <strong>{peak}</strong> day{peak !== 1 ? "s" : ""}</div>
                  </div>
                </div>
              ))}
              {data.length === 0 && <p className="muted">No kids to report on.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
