"use client";

import { useEffect, useMemo, useState } from "react";
import type { Assignment, Chore, Household, User } from "@paydirt/shared";
import {
  addSummaries, costStrip, currencyDisplayName, errorMessage, pctChange, periodRange, periodWeeks, screenRate,
  splitSpend, summarizePeriod, toDollars, weeklyPotential,
} from "@paydirt/shared";
import type { PeriodKind, PeriodSummary, SpendSplit } from "@paydirt/shared";
import { client } from "../lib/client";

const KINDS: { key: PeriodKind; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const usd = (n: number | null) => (n === null ? "–" : `$${n.toFixed(2)}`);

/** Parent-only: what the economy actually cost over a period, plus each kid's weekly potential. */
export function OverviewView({
  household,
  kids,
  chores,
  activeAssignments,
}: {
  household: Household | null;
  kids: User[];
  chores: Chore[];
  activeAssignments: Assignment[];
}) {
  const [kind, setKind] = useState<PeriodKind>("month");
  const [offset, setOffset] = useState(0);
  const [cur, setCur] = useState<Record<string, PeriodSummary> | null>(null);
  const [prev, setPrev] = useState<PeriodSummary | null>(null);
  const [split, setSplit] = useState<SpendSplit | null>(null);
  const [error, setError] = useState("");

  const currency = currencyDisplayName(household);
  const goodsRate = household?.goods_rate ?? 0;
  const sRate = screenRate(household);
  const kidIds = useMemo(() => kids.map((k) => k.id), [kids]);
  const range = periodRange(kind, new Date(), offset);

  useEffect(() => {
    if (kidIds.length === 0) return;
    let live = true;
    const load = async (off: number) => {
      const r = periodRange(kind, new Date(), off);
      const [txns, done, reqs] = await Promise.all([
        client.listTransactionsInRange(kidIds, r.start, r.end),
        client.listApprovedInRange(kidIds, r.start, r.end),
        client.listSpendRequestsInRange(kidIds, r.start, r.end),
      ]);
      return {
        split: splitSpend(txns, reqs),
        byKid: Object.fromEntries(
          kidIds.map((id) => [
            id,
            summarizePeriod(txns.filter((t) => t.user === id), done.filter((a) => a.child === id)),
          ]),
        ),
      };
    };
    setError("");
    void Promise.all([load(offset), load(offset - 1)])
      .then(([c, p]) => {
        if (!live) return;
        setCur(c.byKid);
        setSplit(c.split);
        setPrev(addSummaries(Object.values(p.byKid)));
      })
      .catch((e) => live && setError(errorMessage(e)));
    return () => { live = false; };
  }, [kidIds, kind, offset]);

  const total = cur ? addSummaries(Object.values(cur)) : null;
  const delta = total && prev ? pctChange(total.earned, prev.earned) : null;

  const potential = kids.map((k) => {
    const ids = new Set(activeAssignments.filter((a) => a.child === k.id).map((a) => a.chore));
    return { kid: k, p: weeklyPotential(chores.filter((c) => ids.has(c.id)), goodsRate, sRate) };
  });

  const weeklyBucks = potential.reduce((n, { p }) => n + p.bucks, 0);
  const strip = total ? costStrip(total.earned, weeklyBucks, periodWeeks(range), goodsRate) : null;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {KINDS.map((k) => (
          <button
            key={k.key}
            className={`sm${kind === k.key ? " primary" : ""}`}
            aria-pressed={kind === k.key}
            onClick={() => { setKind(k.key); setOffset(0); }}
          >
            {k.label}
          </button>
        ))}
        <button className="sm" aria-label="Previous period" onClick={() => setOffset((o) => o - 1)}>◀</button>
        <span style={{ fontWeight: 600 }}>{range.label}</span>
        <button className="sm" aria-label="Next period" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0}>▶</button>
      </div>
      {error && <p className="error">{error}</p>}

      {total && strip && (
        <>
          <div className="stat-grid" data-testid="cost-strip">
            <div className="stat">
              <span className="muted">Paid vs. potential</span>
              <strong>{strip.paid} / {strip.max} {currency}</strong>
              <span className="muted">
                {strip.pct === null ? "no ceiling" : `${strip.pct}% of max`} · {usd(strip.paidDollars)} of {usd(strip.maxDollars)}
              </span>
            </div>
            <div className="stat">
              <span className="muted">Screen time redeemed</span>
              <strong>{split?.screenBucks ?? 0} {currency}</strong>
              <span className="muted">{split?.screenMinutes ?? 0} min · not real money</span>
            </div>
            <div className="stat">
              <span className="muted">Real-money redeemed</span>
              <strong>{usd(toDollars(split?.goodsBucks ?? 0, goodsRate))}</strong>
              <span className="muted">{split?.goodsBucks ?? 0} {currency} on goods</span>
            </div>
          </div>
          <div className="stat-grid">
            <div className="stat">
              <span className="muted">Earned by kids</span>
              <strong>{total.earned} {currency}</strong>
              <span className="muted">
                {usd(toDollars(total.earned, goodsRate))}
                {delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta}% vs last ${kind}` : ""}
              </span>
            </div>
            <div className="stat">
              <span className="muted">Redeemed</span>
              <strong>{total.spent} {currency}</strong>
              <span className="muted">{usd(toDollars(total.spent, goodsRate))}</span>
            </div>
            <div className="stat">
              <span className="muted">Bonus time from chores</span>
              <strong>{total.bonusMinutes} min</strong>
              <span className="muted">{total.chores} chores done</span>
            </div>
            <div className="stat">
              <span className="muted">Parent adjustments</span>
              <strong>{total.adjustments >= 0 ? "+" : ""}{total.adjustments} {currency}</strong>
              <span className="muted">bonuses less deductions</span>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Kid</th><th className="num">Chores</th><th className="num">Streak</th><th className="num">Earned</th><th className="num">Redeemed</th><th className="num">Bonus min</th></tr>
            </thead>
            <tbody>
              {kids.map((k) => {
                const s = cur?.[k.id];
                return (
                  <tr key={k.id}>
                    <td data-label="Kid">{k.display_name}</td>
                    <td data-label="Chores" className="num">{s?.chores ?? 0}</td>
                    <td data-label="Streak" className="num">{k.streak_count ?? 0}d</td>
                    <td data-label="Earned" className="num">{s?.earned ?? 0}</td>
                    <td data-label="Redeemed" className="num">{s?.spent ?? 0}</td>
                    <td data-label="Bonus min" className="num">{s?.bonusMinutes ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <h4 style={{ margin: "8px 0 0" }}>Weekly potential per kid</h4>
      <table className="data-table">
        <thead>
          <tr><th>Kid</th><th className="num">Recurring</th><th className="num">{currency}/wk</th><th className="num">Bonus min</th><th className="num">$ equiv</th><th className="num">Screen min</th></tr>
        </thead>
        <tbody>
          {potential.map(({ kid, p }) => (
            <tr key={kid.id}>
              <td data-label="Kid">{kid.display_name}</td>
              <td data-label="Recurring" className="num">{p.chores}{p.oneOffs ? ` (+${p.oneOffs} one-off)` : ""}</td>
              <td data-label={`${currency}/wk`} className="num">{p.bucks}</td>
              <td data-label="Bonus min" className="num">{p.bonusMinutes}</td>
              <td data-label="$ equiv" className="num">{usd(p.dollars)}</td>
              <td data-label="Screen min" className="num">{p.screenMinutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Dollars use today's rate ({goodsRate > 0 ? `${goodsRate} ${currency} = $1` : "no dollar rate set"}); past periods shift if it changes.
        Potential is a ceiling: limits are advisory, one-offs are not counted, and screen minutes use {sRate} {currency}/min.
      </p>
    </div>
  );
}

/** Chart-icon button in the app bar that opens the Overview in a modal. */
export function OverviewModalButton(props: {
  household: Household | null;
  kids: User[];
  chores: Chore[];
  activeAssignments: Assignment[];
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button className="outlined sm" aria-label="Overview" title="Overview" onClick={() => setOpen(true)}>📊</button>
      {open && (
        <div className="settings-panel overview-modal" role="dialog" aria-modal="true" aria-label="Overview">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>📊 Overview</h3>
            <button className="outlined sm" onClick={() => setOpen(false)}>Close</button>
          </div>
          <OverviewView {...props} />
        </div>
      )}
    </>
  );
}
