"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  TimeGrant,
  PayMode,
  Assignment,
  Chore,
  ChoreProposal,
  ChoreTemplate,
  CurrencyTransaction,
  Household,
  SavingsGoal,
  MonthActivity,
  RecentAssignmentRow,
  SpendRequest,
  User,
} from "@paydirt/shared";
import { kidsAtLimit, knownChoreNames, GOAL_NAME_MAX, GOAL_DETAILS_MAX, parseAssignDraft, serializeAssignDraft, AVATAR_COLORS, REACTIONS, undoApprovalPrompt, avatarUrl, currencyDisplayName, kidAccent, parseGoodsRateOverride, featureTip, screenGrantLabel, errorMessage, limitLabel, limitUnit, payLabel, approveTimePrompt, summarizeMonthActivity, waitingActionCount, payMode, validatePay, MINUTES_STEP, MAX_REWARD_MINUTES } from "@paydirt/shared";
import { client } from "../lib/client";
import { HouseholdSettings } from "./HouseholdSettings";
import { AppearanceControls } from "./AppearanceControls";
import { LedgerView } from "./LedgerView";
import { InboxView } from "./InboxView";
import { StarterChores } from "./StarterChores";
import { Celebration } from "./Celebration";

const ASSIGN_DRAFT_KEY = "paydirt.assignDraft";

type TabKey = "approvals" | "kids" | "chores" | "ledger" | "alerts";
const TABS: { key: TabKey; label: string }[] = [
  { key: "approvals", label: "📥 Approvals" },
  { key: "kids", label: "🧒 Kids" },
  { key: "chores", label: "📋 Chores" },
  { key: "ledger", label: "📒 Ledger" },
  { key: "alerts", label: "🔔 Alerts" },
];

type Expanded<T> = T & { expand?: Record<string, User | Chore> };

const TX_LABEL: Record<string, string> = {
  earn: "Chore reward",
  spend: "Spent",
  manual_adjustment: "Adjustment",
};


export function buildLedgerCsv(
  txns: CurrencyTransaction[],
  labels: Record<string, string>,
): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [
    ["Date", "Type", "Amount", "Reason"],
    ...txns.map((t) => [
      t.created.slice(0, 10),
      labels[t.type] ?? t.type,
      String(t.amount),
      t.reason ?? "",
    ]),
  ];
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

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
  const [recentAssignments, setRecentAssignments] = useState<RecentAssignmentRow[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<Expanded<Assignment>[]>([]);
  const [goalsByKid, setGoalsByKid] = useState<Record<string, SavingsGoal[]>>({});
  const [chores, setChores] = useState<Chore[]>([]);
  const [approvals, setApprovals] = useState<Expanded<Assignment>[]>([]);
  const [selectedApprovals, setSelectedApprovals] = useState<Set<string>>(new Set());
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [spend, setSpend] = useState<Expanded<SpendRequest>[]>([]);
  const [screenGrants, setScreenGrants] = useState<Expanded<SpendRequest>[]>([]);
  const [bonusGrants, setBonusGrants] = useState<Expanded<TimeGrant>[]>([]);
  const [proposals, setProposals] = useState<Expanded<ChoreProposal>[]>([]);
  const [recentApproved, setRecentApproved] = useState<Expanded<Assignment>[]>([]);
  const [error, setError] = useState("");
  const [templateFill, setTemplateFill] = useState<ChoreTemplate | null>(null);
  const [tab, setTab] = useState<TabKey>("approvals");
  const [ledgerKid, setLedgerKid] = useState<string | undefined>();
  const [celebrate, setCelebrate] = useState(0);
  const party = () => setCelebrate((n) => n + 1);
  /** True to proceed; asks first only when an approval grants screen time (irreversible). */
  const confirmApprove = (list: Expanded<Assignment>[]) => {
    const msg = approveTimePrompt(
      list.map((x) => ({
        chore: x.expand?.chore as Chore | undefined,
        kidName: (x.expand?.child as User | undefined)?.display_name,
      })),
    );
    return msg === null || window.confirm(msg);
  };

  const currencyName = currencyDisplayName(household);
  const goodsRate = household?.goods_rate ?? 0;
  const kidRate = (kid: User) => kid.goods_rate ?? goodsRate;

  const reload = useCallback(async () => {
    try {
      const [hh, k, c, a, s, p, ra, grants, bonus, active, recent] = await Promise.all([
        client.getHousehold(householdId),
        client.listChildren(householdId),
        client.listChores(householdId),
        client.listPendingApprovals(householdId),
        client.listPendingSpendRequests(householdId),
        client.listPendingProposals(householdId),
        client.listRecentlyApproved(householdId, 8),
        client.listScreenTimeGrants(householdId),
        client.listBonusGrants(householdId),
        client.listActiveAssignmentsForHousehold(householdId),
        client.listRecentAssignmentsForHousehold(householdId),
      ]);
      const goals = await Promise.all(k.map((kid) => client.listGoals(kid.id)));
      setHousehold(hh);
      setKids(k);
      setGoalsByKid(Object.fromEntries(k.map((kid, i) => [kid.id, goals[i]])));
      setChores(c);
      setActiveAssignments(active as Expanded<Assignment>[]);
      setRecentAssignments(recent);
      setApprovals(a as Expanded<Assignment>[]);
      setSelectedApprovals(new Set());
      setSpend(s as Expanded<SpendRequest>[]);
      setScreenGrants(grants as Expanded<SpendRequest>[]);
      setBonusGrants(bonus as Expanded<TimeGrant>[]);
      setProposals(p as Expanded<ChoreProposal>[]);
      setRecentApproved(ra as Expanded<Assignment>[]);
    } catch (e) {
      setError(errorMessage(e));
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
      setError(errorMessage(e));
    }
  };

  // Who already holds each chore (so Assign shows it) and what each kid is working on.
  const assignedByChore: Record<string, Set<string>> = {};
  const activeByKid: Record<string, Expanded<Assignment>[]> = {};
  for (const a of activeAssignments) {
    (assignedByChore[a.chore] ??= new Set()).add(a.child);
    (activeByKid[a.child] ??= []).push(a);
  }

  const waitingCount = waitingActionCount({ approvals, spend, proposals, screenGrants, bonusGrants });

  return (
    <div className="app-shell">
      {/* ── App Bar ── */}
      <header className="app-bar">
        <div className="app-bar-inner">
          <div className="app-bar-title">
            <img className="app-bar-logo" src="/bag.svg" alt="" />
            <span className="app-bar-brand">
              <span>
                Pay<span className="brand-dirt">Dirt</span>
              </span>
              <span className="app-bar-tagline">Do. The. Thing.</span>
            </span>
          </div>
          <div className="inline">
            <AppearanceControls />
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

        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`tab${tab === t.key ? " tab-active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key === "approvals" && waitingCount > 0 && (
                <span className="tab-badge" aria-label={`${waitingCount} waiting`}>{waitingCount}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "kids" && (<>
        {/* ── Kids ── */}
        <h2>Kids</h2>
        {kids.length === 0 && (
          <p className="muted">No kids in this household yet.</p>
        )}
        {kids.map((kid) => (
          <div
            className="card"
            key={kid.id}
            style={{ borderLeft: `4px solid ${kidAccent(kid.color, "#2f7d4f")}` }}
          >
            <div className="row">
              <div className="inline" style={{ gap: 12 }}>
                <AvatarPicker kid={kid} onSaved={reload} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {kid.display_name}
                    {(kid.streak_count ?? 0) >= 2 && (
                      <span className="chip chip-primary" style={{ marginLeft: 8, fontSize: 11 }}>
                        🔥 {kid.streak_count}-day streak
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="balance kid-balance" style={{ fontSize: 18 }}>
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
            <div className="inline kid-toolbar">
              <AdjustControl kid={kid} onAdjusted={reload} />
              <GoalControl kid={kid} onChanged={reload} />
            </div>
            <KidChores assignments={activeByKid[kid.id] ?? []} currencyName={currencyName} />
            <GoalList kid={kid} goals={goalsByKid[kid.id] ?? []} onChanged={reload} />
            <KidEarnings
              kid={kid}
              currencyName={currencyName}
              onMore={() => {
                setLedgerKid(kid.id);
                setTab("ledger");
              }}
            />
            <div className="inline kid-toolbar">
              <AvatarControl kid={kid} onSaved={reload} />
              <LedgerToggle kidId={kid.id} kidName={kid.display_name} />
            </div>
          </div>
        ))}

        {kids.length > 0 && (
          <BroadcastControl householdId={householdId} senderId={user.id} />
        )}
        <CoParentsPanel householdId={householdId} selfId={user.id} />
        </>)}

        {tab === "approvals" && (<>
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
                    onClick={() => {
                      if (!confirmApprove(approvals.filter((a) => selectedApprovals.has(a.id)))) return;
                      party();
                      act(() =>
                        Promise.all(
                          [...selectedApprovals].map((id) => client.approveAssignment(id))
                        ).then(() => {})
                      );
                    }}
                  >
                    Approve selected ({selectedApprovals.size})
                  </button>
                )}
                <button
                  className="primary sm"
                  onClick={() => {
                    if (!confirmApprove(approvals)) return;
                    party();
                    act(() =>
                      Promise.all(approvals.map((a) => client.approveAssignment(a.id))).then(
                        () => {}
                      )
                    );
                  }}
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
                    {a.expand?.chore && (
                      <> · <span className="balance" style={{ fontSize: 13 }}>{payLabel(a.expand.chore as Chore, currencyName)}</span></>
                    )}
                  </div>
                  {a.needs_help && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 2, color: "#c0392b" }}>
                      🆘 Kid asked for help
                    </div>
                  )}
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
                  {a.photo && (
                    <button
                      type="button"
                      onClick={() => setPhotoPreview(client.getPhotoUrl(a))}
                      style={{ marginTop: 6, padding: 0, border: "none", background: "none", cursor: "zoom-in", display: "block" }}
                      title="Click to enlarge"
                    >
                      <img
                        src={client.getPhotoUrl(a)}
                        alt="Photo proof"
                        style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, display: "block", objectFit: "cover" }}
                      />
                    </button>
                  )}
                </div>
              </div>
              <div className="inline" style={{ flexShrink: 0 }}>
                <button
                  className="primary sm"
                  onClick={() => {
                    if (!confirmApprove([a])) return;
                    party();
                    act(() => client.approveAssignment(a.id));
                  }}
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

        {(screenGrants.length > 0 || bonusGrants.length > 0) && <>
          <h2>Screen-time grants</h2>
          {bonusGrants.map((g) => (
            <div className="card row" key={g.id}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {(g.expand?.child as User | undefined)?.display_name ?? "child"} — {g.description}
                </div>
                <div>{screenGrantLabel(g.grant_status)}</div>
                {g.grant_error && <div role="status" className="muted">{g.grant_error}</div>}
              </div>
              {g.grant_status === "manual" && <button className="sm" onClick={() => {
                if (window.confirm("Check Family Link first. Confirm this bonus time has been granted manually?")) {
                  void act(() => client.confirmBonusGrant(g.id));
                }
              }}>Mark granted manually</button>}
            </div>
          ))}
          {screenGrants.map((s) => (
            <div className="card row" key={s.id}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {(s.expand?.child as User | undefined)?.display_name ?? "child"} — {s.description}
                </div>
                <div>{screenGrantLabel(s.grant_status)}</div>
                {s.grant_error && <div role="status" className="muted">{s.grant_error}</div>}
              </div>
              {s.grant_status === "manual" && <button className="sm" onClick={() => {
                if (window.confirm("Check Family Link first. Confirm this purchased time has been granted manually?")) {
                  void act(() => client.confirmManualGrant(s.id));
                }
              }}>Mark granted manually</button>}
            </div>
          ))}
        </>}

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
                    +{chore ? payLabel(chore, currencyName) : "?"}
                  </span>
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
                {(!chore || payMode(chore) === "bucks") && <button
                  className="danger sm"
                  onClick={() => {
                    const prompt = undoApprovalPrompt(chore?.name, chore?.reward, kid?.display_name, currencyName);
                    if (!window.confirm(prompt)) return;
                    void act(() => client.undoApproval(a.id));
                  }}
                >
                  Undo
                </button>}
              </div>
            </div>
          );
        })}
        </>)}

        {tab === "chores" && (<>
        {/* ── Activity report ── */}
        <ActivityReport kids={kids} currencyName={currencyName} />

        {/* ── Chores ── */}
        <h2>📋 Chores</h2>
        <ChoreTemplatesPanel
          householdId={householdId}
          onUse={(t) => setTemplateFill(t)}
        />
        <StarterChores
          householdId={householdId}
          parentId={user.id}
          existingNames={knownChoreNames(chores)}
          onAdded={reload}
        />
        <CreateChore
          household={householdId}
          parentId={user.id}
          onCreated={reload}
          template={templateFill}
          onTemplateClear={() => setTemplateFill(null)}
        />
        {chores.map((c) => (
          <ChoreRow
            key={c.id}
            chore={c}
            kids={kids}
            assignedKidIds={assignedByChore[c.id]}
            atLimit={kidsAtLimit(c, recentAssignments)}
            currencyName={currencyName}
            onChanged={reload}
          />
        ))}
        </>)}

        {tab === "ledger" && <LedgerView household={household} initialKidId={ledgerKid} />}
        {tab === "alerts" && <InboxView userId={user.id} />}
      </main>

<Celebration trigger={celebrate} />
      {photoPreview && (
        <div
          onClick={() => setPhotoPreview(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, cursor: "zoom-out",
          }}
        >
          <img
            src={photoPreview}
            alt="Photo proof (full size)"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 12 }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

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
      setError(errorMessage(e));
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
      setStatus(errorMessage(e));
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

function LedgerToggle({ kidId, kidName }: { kidId: string; kidName: string }) {
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

  function exportCsv() {
    const csv = buildLedgerCsv(txns, TX_LABEL);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kidName.replace(/\s+/g, "_")}_ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button className="sm" onClick={toggle} disabled={loading}>
        {loading ? "…" : open ? "Hide history" : "History"}
      </button>
      {open && (
        <div className="panel-full">
          {txns.length > 0 && (
            <button className="sm" style={{ marginBottom: 8 }} onClick={exportCsv}>
              Export CSV
            </button>
          )}
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
    </>
  );
}

function GoalList({
  kid,
  goals,
  onChanged,
}: {
  kid: User;
  goals: SavingsGoal[];
  onChanged: () => void;
}) {
  const [section, setSection] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  if (goals.length === 0) return null;

  async function remove(g: SavingsGoal) {
    if (!window.confirm(`Delete the "${g.name}" goal? Their balance isn't affected.`)) return;
    setError("");
    try {
      await client.deleteGoal(g.id);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="goal-list">
      <button
        type="button"
        className="goal-section-toggle"
        aria-expanded={section}
        onClick={() => setSection((v) => !v)}
      >
        <span className="twisty" aria-hidden="true">{section ? "▾" : "▸"}</span>
        🎯 Goals ({goals.length})
      </button>
      {section && goals.map((g) => {
        const open = expanded.has(g.id);
        const pct = g.achieved ? 100 : Math.min(100, Math.round((kid.balance / g.target) * 100));
        return (
          <div className="goal-row" key={g.id}>
            <button
              type="button"
              className={`goal-name${open ? " goal-name-open" : ""}`}
              aria-expanded={open}
              title={open ? "Click to collapse" : g.name}
              onClick={() => toggle(g.id)}
            >
              <span className="twisty" aria-hidden="true">{open ? "▾" : "▸"}</span>
              {g.name}
            </button>
            <span className="goal-progress muted">
              {g.achieved ? "done!" : `${kid.balance}/${g.target}`}
            </span>
            <button
              className="sm"
              aria-label={`Delete goal ${g.name}`}
              title="Delete goal"
              onClick={() => void remove(g)}
            >
              ✕
            </button>
            <div className="goal-bar" aria-hidden="true">
              <div style={{ width: `${pct}%` }} />
            </div>
            {open && (
              <p className="goal-details muted">{g.details || "No details."}</p>
            )}
          </div>
        );
      })}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function GoalControl({ kid, onChanged }: { kid: User; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const targetNum = Math.floor(Number(target));

  async function save() {
    if (!name.trim() || !(targetNum > 0)) return;
    setBusy(true);
    setError("");
    try {
      await client.createGoal(kid.id, name.trim(), targetNum, 0, details);
      setName("");
      setDetails("");
      setTarget("");
      setOpen(false);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button className="sm" onClick={() => setOpen(true)}>
          Set a goal
        </button>
      )}
      {open && (
        <div className="stack panel-full">
          <div className="inline">
            <input
              placeholder="What are they saving for?"
              maxLength={GOAL_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              style={{ width: 110 }}
              placeholder="Target"
            />
            <button
              className="primary sm"
              onClick={save}
              disabled={busy || !name.trim() || !(targetNum > 0)}
            >
              Add goal
            </button>
            <button className="sm" onClick={() => { setOpen(false); setError(""); }}>
              Cancel
            </button>
          </div>
          <textarea
            placeholder="Details (optional)"
            maxLength={GOAL_DETAILS_MAX}
            rows={2}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>
      )}
      {error && <p className="error panel-full">{error}</p>}
    </>
  );
}

function CoParentsPanel({ householdId, selfId }: { householdId: string; selfId: string }) {
  const [parents, setParents] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      setParents(await client.listParents(householdId));
    } catch (e) {
      setStatus(errorMessage(e));
    }
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!email.trim() || !name.trim() || !pass) return;
    setBusy(true);
    setStatus("");
    try {
      await client.createCoParent(email.trim(), name.trim(), pass);
      setEmail("");
      setName("");
      setPass("");
      setOpen(false);
      setStatus("Co-parent added ✅");
      await load();
    } catch (e) {
      setStatus(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const others = parents.filter((p) => p.id !== selfId);
  return (
    <div className="card" style={{ marginTop: 4 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Co-parents</div>
      {others.length === 0 ? (
        <p className="muted" style={{ margin: "0 0 8px" }}>
          No co-parents yet. Add one so another parent can log in.
        </p>
      ) : (
        others.map((p) => (
          <div key={p.id} style={{ marginBottom: 4 }}>
            {p.display_name}
            {p.email ? ` — ${p.email}` : ""}
          </div>
        ))
      )}
      {!open ? (
        <button className="sm" onClick={() => setOpen(true)}>
          Add co-parent
        </button>
      ) : (
        <div className="inline">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            type="password"
            placeholder="Password"
            autoComplete="new-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <button className="primary sm" onClick={add} disabled={busy || !email.trim() || !name.trim() || !pass}>
            Add
          </button>
          <button className="sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      )}
      {status && <p className="muted" style={{ margin: "8px 0 0" }}>{status}</p>}
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
      setError(errorMessage(e));
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
    <div className="stack panel-full">
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
  assignedKidIds,
  atLimit,
  currencyName,
  onChanged,
}: {
  chore: Chore;
  kids: User[];
  assignedKidIds?: Set<string>;
  atLimit?: Map<string, number>;
  currencyName: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(chore.name);
  const [reward, setReward] = useState(chore.reward);
  const [mode, setMode] = useState<PayMode>(payMode(chore));
  const [minutes, setMinutes] = useState(chore.reward_minutes ?? 0);
  const [type, setType] = useState<"oneoff" | "recurring">(chore.type);
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">(
    (chore.cadence as "daily" | "weekly" | "monthly") ?? "weekly"
  );
  const [photoRequired, setPhotoRequired] = useState(chore.photo_required);
  const [race, setRace] = useState(chore.race ?? false);
  const [remindAt, setRemindAt] = useState(chore.reminder_time ?? "");
  const [limit, setLimit] = useState(chore.max_per_period ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function cancelEdit() {
    setName(chore.name);
    setReward(chore.reward);
    setMode(payMode(chore));
    setMinutes(chore.reward_minutes ?? 0);
    setType(chore.type);
    setCadence((chore.cadence as "daily" | "weekly" | "monthly") ?? "weekly");
    setPhotoRequired(chore.photo_required);
    setRace(chore.race ?? false);
    setRemindAt(chore.reminder_time ?? "");
    setLimit(chore.max_per_period ?? 0);
    setError("");
    setEditing(false);
  }

  async function save() {
    if (!name.trim()) return;
    const payError = validatePay({ pay_mode: mode, reward, reward_minutes: minutes });
    if (payError) { setError(payError); return; }
    setBusy(true);
    setError("");
    try {
      await client.updateChore(chore.id, {
        name: name.trim(),
        reward,
        pay_mode: mode,
        reward_minutes: minutes,
        type,
        cadence: type === "recurring" ? cadence : undefined,
        photo_required: photoRequired,
        race,
        reminder_time: remindAt,
        max_per_period: limit,
      });
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
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
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="card row" style={{ gap: 8, flexDirection: "column", alignItems: "stretch" }}>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <div className="chore-title" style={{ flex: 1 }}>
            <span style={{ fontWeight: 600 }}>{chore.name}</span>
            <span className="chore-badges">
              {chore.race && <span title="Race: first to finish wins">🏁</span>}
              {chore.photo_required && <span title="Photo required">📷</span>}
              {chore.reminder_time && <span title="Daily reminder">⏰ {chore.reminder_time}</span>}
            </span>
          </div>
          <button className="sm" onClick={() => setEditing(true)} title="Edit chore">✏️</button>
        </div>
        <AssignControl chore={chore} kids={kids} assignedKidIds={assignedKidIds} atLimit={atLimit} onAssigned={onChanged} />
        <div className="muted">
          <span className="balance" style={{ fontSize: 13 }}>{payLabel(chore, currencyName)}</span>
          {" "}· {chore.type}
          {chore.cadence ? ` (${chore.cadence})` : ""}
          {chore.due_at
            ? ` · due ${new Date(chore.due_at.replace(" ", "T")).toLocaleString()}`
            : ""}
          {limitLabel(chore) ? ` · max ${limitLabel(chore)}` : ""}
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
        <PayControls mode={mode} reward={reward} minutes={minutes} onMode={setMode} onReward={setReward} onMinutes={setMinutes} />
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
        <label className="inline" style={{ gap: 6 }}>
          Max per {limitUnit({ type, cadence })}
          <input
            type="number"
            min={0}
            step={1}
            aria-label="Max per period"
            value={limit || ""}
            placeholder="none"
            onChange={(e) => setLimit(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            style={{ width: 110 }}
          />
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

/** Pay mode + amounts for a chore: bucks, screen minutes, or both. */
function PayControls({
  mode, reward, minutes, onMode, onReward, onMinutes,
}: {
  mode: PayMode;
  reward: number;
  minutes: number;
  onMode: (m: PayMode) => void;
  onReward: (n: number) => void;
  onMinutes: (n: number) => void;
}) {
  return (
    <>
      <select aria-label="Pay mode" value={mode} onChange={(e) => onMode(e.target.value as PayMode)}>
        <option value="bucks">pays bucks</option>
        <option value="time">pays time</option>
        <option value="both">bucks + time</option>
      </select>
      {mode !== "time" && (
        <input
          type="number"
          min={0}
          value={reward}
          onChange={(e) => onReward(Number(e.target.value))}
          style={{ width: 90 }}
          placeholder="Reward"
          aria-label="Reward"
        />
      )}
      {mode !== "bucks" && (
        <input
          type="number"
          min={MINUTES_STEP}
          max={MAX_REWARD_MINUTES}
          step={MINUTES_STEP}
          value={minutes || ""}
          onChange={(e) => onMinutes(Number(e.target.value) || 0)}
          style={{ width: 80 }}
          placeholder="min"
          aria-label="Bonus minutes"
        />
      )}
    </>
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
  const [mode, setMode] = useState<PayMode>("bucks");
  const [minutes, setMinutes] = useState(0);
  const [type, setType] = useState<"oneoff" | "recurring">("oneoff");
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [photoRequired, setPhotoRequired] = useState(false);
  const [race, setRace] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [limit, setLimit] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!template) return;
    if (template.reminder_time || template.max_per_period) setAdvanced(true);
    setName(template.name);
    setReward(template.reward);
    setMode(payMode(template));
    setMinutes(template.reward_minutes ?? 0);
    setType(template.type);
    if (template.cadence && (template.cadence === "daily" || template.cadence === "weekly" || template.cadence === "monthly")) {
      setCadence(template.cadence);
    }
    setPhotoRequired(template.photo_required ?? false);
    setRace(template.race ?? false);
    setRemindAt(template.reminder_time ?? "");
    setLimit(template.max_per_period ?? 0);
  }, [template]);

  function reset() {
    setName("");
    setReward(10);
    setMode("bucks");
    setMinutes(0);
    setType("oneoff");
    setCadence("weekly");
    setPhotoRequired(false);
    setRace(false);
    setDueAt("");
    setRemindAt("");
    setLimit(0);
    onTemplateClear?.();
  }

  async function create() {
    if (!name.trim()) return;
    const payError = validatePay({ pay_mode: mode, reward, reward_minutes: minutes });
    if (payError) { setError(payError); return; }
    setBusy(true);
    setError("");
    try {
      await client.createChore({
        household,
        name: name.trim(),
        reward,
        pay_mode: mode,
        reward_minutes: minutes,
        type,
        cadence: type === "recurring" ? cadence : undefined,
        photo_required: photoRequired,
        race,
        due_at: dueAt ? new Date(dueAt).toISOString() : "",
        reminder_time: remindAt,
        max_per_period: limit,
        created_by: parentId,
        active: true,
      });
      reset();
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    if (!name.trim()) return;
    const payError = validatePay({ pay_mode: mode, reward, reward_minutes: minutes });
    if (payError) { setError(payError); return; }
    setBusy(true);
    setError("");
    try {
      await client.createTemplate({
        household,
        name: name.trim(),
        reward,
        pay_mode: mode,
        reward_minutes: minutes,
        type,
        cadence: type === "recurring" ? cadence : undefined,
        photo_required: photoRequired,
        race,
        reminder_time: remindAt,
        max_per_period: limit,
      });
    } catch (e) {
      setError(errorMessage(e));
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
        <PayControls mode={mode} reward={reward} minutes={minutes} onMode={setMode} onReward={setReward} onMinutes={setMinutes} />
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
        <button className="outlined sm" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
          Advanced {advanced ? "▲" : "▼"}
        </button>
      </div>
      {advanced && (
        <div className="inline" style={{ fontSize: 13, gap: 12, marginTop: 8 }}>
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
          <label className="inline" style={{ gap: 6 }}>
            Max per {limitUnit({ type, cadence })}
            <input
              type="number"
              min={0}
              step={1}
              aria-label="Max per period"
              value={limit || ""}
              placeholder="none"
              onChange={(e) => setLimit(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              style={{ width: 110 }}
            />
          </label>
        </div>
      )}
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

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete the "${name}" template? Existing chores aren't affected.`)) return;
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
                  {payLabel(t, "")} · {t.type}{t.cadence ? ` · ${t.cadence}` : ""}
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
                  onClick={() => void remove(t.id, t.name)}
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

/** Kid's picture; click it to choose a new photo (uploads immediately). */
function AvatarPicker({ kid, onSaved }: { kid: User; onSaved: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const form = new FormData();
      form.append("avatar", file);
      await client.pb.collection("users").update(kid.id, form);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <>
      <button
        type="button"
        className="kid-avatar avatar-picker"
        title={error || "Change photo (JPEG, PNG, WebP or GIF, up to 2 MB)"}
        aria-label={`Change ${kid.display_name}'s photo`}
        onClick={() => input.current?.click()}
        style={{ backgroundColor: `color-mix(in srgb, ${kidAccent(kid.color, "#2f7d4f")} 18%, transparent)` }}
      >
        {kid.avatar ? <img src={avatarUrl(client.pb, kid, "100x100")} alt="" /> : kid.avatar_emoji || "🧒"}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        data-testid={`avatar-file-${kid.id}`}
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }}
      />
      {error && <span className="error" style={{ fontSize: 12 }}>{error}</span>}
    </>
  );
}

function AvatarControl({ kid, onSaved }: { kid: User; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState(kid.avatar_emoji ?? "");
  const [color, setColor] = useState(kidAccent(kid.color, AVATAR_COLORS[0]));
  const [goodsRateOverride, setGoodsRateOverride] = useState(String(kid.goods_rate ?? ""));
  const [calmMode, setCalmMode] = useState(!!kid.calm_mode);
  const [simplified, setSimplified] = useState(!!kid.simplified_mode);
  const [flChildId, setFlChildId] = useState(kid.fl_child_id ?? "");
  const [flDeviceId, setFlDeviceId] = useState(kid.fl_device_id ?? "");
  const [digestWeekday, setDigestWeekday] = useState(kid.digest_weekday ?? "");
  const [digestWeekend, setDigestWeekend] = useState(kid.digest_weekend ?? "");
  const [flOpen, setFlOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button className="sm" style={{ fontSize: 13 }} onClick={() => setOpen(true)}>
        ⚙️ Edit avatar & settings
      </button>
    );
  }

  return (
    <div className="panel-full kid-settings">
      <div className="kid-settings-title">Avatar & rates</div>
      <div className="kid-settings-row">
      <input
        placeholder="Emoji (e.g. 🦊)"
        aria-label="Emoji"
        value={avatar}
        onChange={(e) => setAvatar(e.target.value)}
        style={{ width: 190 }}
        title="Click the picture at the top of the card to use a photo instead"
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
      </div>
      <div className="kid-settings-title">Chore summary push</div>
      <div className="kid-settings-row">
      <label className="muted" style={{ fontSize: 13 }} title={featureTip("chore_digest")}>
        weekdays{" "}
        <input
          type="time"
          aria-label="Chore summary weekday time"
          value={digestWeekday}
          onChange={(e) => setDigestWeekday(e.target.value)}
        />{" "}
        weekends{" "}
        <input
          type="time"
          aria-label="Chore summary weekend time"
          value={digestWeekend}
          onChange={(e) => setDigestWeekend(e.target.value)}
        />
      </label>
      </div>
      <div className="kid-settings-title">Modes</div>
      <div className="kid-settings-row">
      <label
        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}
        title="Quieter kid home: no badge shelf, confetti, or count-up"
      >
        <input type="checkbox" checked={calmMode} onChange={(e) => setCalmMode(e.target.checked)} />
        Calm mode
      </label>
      <label
        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}
        title={featureTip("simplified_mode")}
      >
        <input type="checkbox" checked={simplified} onChange={(e) => setSimplified(e.target.checked)} />
        Simplified mode
      </label>
      </div>
      <button
        type="button"
        className="goal-section-toggle"
        aria-expanded={flOpen}
        onClick={() => setFlOpen((v) => !v)}
      >
        <span className="twisty" aria-hidden="true">{flOpen ? "▾" : "▸"}</span>
        Family Link
      </button>
      {flOpen && (
        <div className="kid-settings-row">
      <input
        placeholder="Family Link child ID"
        aria-label="Family Link child ID"
        title={featureTip("fl_ids")}
        value={flChildId}
        onChange={(e) => setFlChildId(e.target.value)}
        style={{ width: 190 }}
      />
      <input
        placeholder="Family Link device ID"
        aria-label="Family Link device ID"
        title={featureTip("fl_ids")}
        value={flDeviceId}
        onChange={(e) => setFlDeviceId(e.target.value)}
        style={{ width: 190 }}
      />
        </div>
      )}
      <button
        className="primary sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await client.pb.collection("users").update(kid.id, {
              avatar_emoji: avatar.trim(),
              color,
              goods_rate: parseGoodsRateOverride(goodsRateOverride),
              calm_mode: calmMode,
              simplified_mode: simplified,
              fl_child_id: flChildId.trim(),
              fl_device_id: flDeviceId.trim(),
              digest_weekday: digestWeekday,
              digest_weekend: digestWeekend,
            });
            setOpen(false);
            onSaved();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Save
      </button>
      <button className="sm" onClick={() => setOpen(false)}>Cancel</button>
      {error && <p className="error" style={{ width: "100%", margin: 0 }}>{error}</p>}
    </div>
  );
}

function AssignControl({
  chore,
  kids,
  assignedKidIds,
  atLimit,
  onAssigned,
}: {
  chore: Chore;
  kids: User[];
  assignedKidIds?: Set<string>;
  atLimit?: Map<string, number>;
  onAssigned: () => void;
}) {
  // Picks persist immediately (localStorage) so a reload doesn't lose them before Assign is pressed.
  // Kids who already hold this chore show as checked + locked; only the open boxes are drafts.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const held = (id: string) => assignedKidIds?.has(id) ?? false;

  useEffect(() => {
    try {
      const saved = parseAssignDraft(localStorage.getItem(ASSIGN_DRAFT_KEY))[chore.id];
      if (saved) setSelected((cur) => (cur.size ? cur : saved));
    } catch {}
  }, [chore.id]);

  function persist(next: Set<string>) {
    try {
      const all = parseAssignDraft(localStorage.getItem(ASSIGN_DRAFT_KEY));
      all[chore.id] = next;
      localStorage.setItem(ASSIGN_DRAFT_KEY, serializeAssignDraft(all));
    } catch {}
  }

  function toggle(kidId: string) {
    const next = new Set(selected);
    if (next.has(kidId)) next.delete(kidId);
    else next.add(kidId);
    setSelected(next);
    persist(next);
    setMsg(null);
  }

  const picks = [...selected].filter((id) => !held(id) && kids.some((k) => k.id === id));

  async function assign() {
    if (picks.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const over = await client.assignLimitWarnings(chore.id, picks);
      if (over.length > 0) {
        const names = over
          .map((w) => `${kids.find((k) => k.id === w.childId)?.display_name ?? "A kid"} (${w.count} already)`)
          .join(", ");
        if (!window.confirm(`"${chore.name}" is limited to ${limitLabel(chore)}. ${names}. Assign anyway?`)) return;
      }
      for (const kidId of picks) {
        await client.assignChore(chore.id, kidId);
      }
      const names = picks.map((id) => kids.find((k) => k.id === id)?.display_name ?? "kid").join(", ");
      setSelected(new Set());
      persist(new Set());
      setMsg({ text: `Assigned to ${names} ✅`, ok: true });
      onAssigned();
    } catch (e) {
      setMsg({ text: errorMessage(e), ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline" style={{ flexShrink: 0 }}>
      {kids.map((k) => (
        <label
          key={k.id}
          title={held(k.id) ? "Already assigned" : undefined}
          style={{ display: "flex", alignItems: "center", gap: 4, cursor: held(k.id) ? "default" : "pointer", fontSize: 13 }}
        >
          <input
            type="checkbox"
            checked={held(k.id) || selected.has(k.id)}
            onChange={() => toggle(k.id)}
            disabled={busy || held(k.id)}
          />
          {k.avatar_emoji ? `${k.avatar_emoji} ` : ""}{k.display_name}
          {held(k.id) && <span className="muted"> ✓ assigned</span>}
          {!held(k.id) && atLimit?.has(k.id) && (
            <span className="muted" title={`Already at the limit (${limitLabel(chore)}). You can still assign to override.`}>
              {" "}· at limit ({limitLabel(chore)})
            </span>
          )}
        </label>
      ))}
      <button className="tonal sm" onClick={assign} disabled={busy || picks.length === 0}>
        {picks.length > 0 ? `Assign (${picks.length})` : "Assign"}
      </button>
      {msg && (
        <span role="status" className={msg.ok ? "muted" : "error"} style={{ flexBasis: "100%", fontSize: 13 }}>
          {msg.text}
        </span>
      )}
    </div>
  );
}

function KidEarnings({ kid, currencyName, onMore }: { kid: User; currencyName: string; onMore: () => void }) {
  const [rows, setRows] = useState<Expanded<Assignment>[]>([]);
  useEffect(() => {
    void client.listApprovedHistory(kid.id, 3).then((r) => setRows(r as Expanded<Assignment>[]));
  }, [kid.id, kid.balance]);
  return (
    <div className="goal-list">
      <button type="button" className="goal-section-toggle" onClick={onMore}>💰 Recent earnings</button>
      {rows.length === 0 && <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>No approved chores yet.</p>}
      {rows.map((a) => {
        const chore = a.expand?.chore as Chore | undefined;
        return (
          <div className="goal-row" key={a.id}>
            <span className="goal-name-static">{chore?.name ?? "Chore"}{a.reaction ? ` ${a.reaction}` : ""}</span>
            <span className="goal-progress muted">+{chore ? payLabel(chore, currencyName) : "?"}</span>
          </div>
        );
      })}
      {rows.length > 0 && (
        <button type="button" className="more-link" onClick={onMore}>More in ledger →</button>
      )}
    </div>
  );
}

function KidChores({ assignments, currencyName }: { assignments: Expanded<Assignment>[]; currencyName: string }) {
  const [open, setOpen] = useState(true);
  const STATUS: Record<string, string> = { assigned: "To do", completed: "Waiting", rejected: "Try again" };
  return (
    <div className="goal-list">
      <button type="button" className="goal-section-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="twisty" aria-hidden="true">{open ? "▾" : "▸"}</span>
        📋 Chores ({assignments.length})
      </button>
      {open && assignments.length === 0 && <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>Nothing assigned right now.</p>}
      {open &&
        assignments.map((a) => {
          const chore = a.expand?.chore as Chore | undefined;
          return (
            <div className="goal-row" key={a.id}>
              <span className="goal-name-static">
                {chore?.race ? "🏁 " : ""}
                {chore?.name ?? "Chore"}
              </span>
              <span className="goal-progress muted">
                {chore ? payLabel(chore, currencyName) : ""} · {STATUS[a.status] ?? a.status}
              </span>
            </div>
          );
        })}
    </div>
  );
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
    ({ kid: User } & MonthActivity)[]
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
        return { kid, ...summarizeMonthActivity(txns, assignments) };
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
                    {kid.avatar_emoji ? `${kid.avatar_emoji} ` : ""}{kid.display_name}
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
