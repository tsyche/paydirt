"use client";

import { DeliverySchedule } from "./DeliverySchedule";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Household } from "@paydirt/shared";
import { CURRENCY_PRESETS, DEFAULT_CURRENCY_NAME, currencyDisplayName, featureTip, kudosDefaultBucks, screenRate } from "@paydirt/shared";
import { client } from "../lib/client";

function Tip({ k }: { k: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [tapped, setTapped] = useState(false);
  const open = hover || focus || tapped;
  useEffect(() => {
    if (!open) return;
    const close = () => { setHover(false); setFocus(false); setTapped(false); };
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const t = featureTip(k);
  if (!t) return null;
  return (
    <span
      ref={root}
      className="settings-tip"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setTapped(false); }}
    >
      <button
        type="button"
        aria-label="More info"
        // Inside a <label>: stop the click from focusing the field.
        onClick={(e) => { e.preventDefault(); setTapped((value) => !value); }}
        onFocus={(e) => setFocus(e.currentTarget.matches(":focus-visible"))}
        onBlur={() => setFocus(false)}
        style={{
          cursor: "help",
          marginLeft: 4,
          padding: 0,
          border: 0,
          background: "none",
          color: "var(--muted, #888)",
          fontSize: 12,
        }}
      >
        ⓘ
      </button>
      {open && (
        <span role="note" className="settings-tip-content">
          {t}
        </span>
      )}
    </span>
  );
}

export function HouseholdSettings({
  household,
  onSaved,
}: {
  household: Household;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    currency_name: household.currency_name ?? "",
    bank_threshold: household.bank_threshold ?? 0,
    kudos_default_bucks: kudosDefaultBucks(household),
    grant_weekday_window: household.grant_weekday_window ?? "",
    grant_day_windows: household.grant_day_windows ?? "",
    grant_weekend_window: household.grant_weekend_window ?? "",
    grant_timezone: household.grant_timezone || "America/Los_Angeles",
    grant_expiry_days: household.grant_expiry_days ?? 0,
    expiry_days: household.expiry_days ?? 0,
    goods_rate: household.goods_rate ?? 0,
    screen_rate: screenRate(household),
    nudge_hours: household.nudge_hours ?? 0,
    paused: household.paused ?? false,
    kids_see_balances: household.kids_see_balances ?? false,
    quiet_start: household.quiet_start ?? "",
    quiet_end: household.quiet_end ?? "",
    streak_bonus_3: household.streak_bonus_3 ?? 0,
    streak_bonus_7: household.streak_bonus_7 ?? 0,
    streak_bonus_14: household.streak_bonus_14 ?? 0,
    streak_bonus_30: household.streak_bonus_30 ?? 0,
    allowance_amount: household.allowance_amount ?? 0,
    allowance_cadence: household.allowance_cadence ?? "weekly",
  });
  // Labels follow the currency name as it is typed, not the saved one.
  const cur = currencyDisplayName({ currency_name: form.currency_name });

  async function save() {
    setBusy(true);
    setError("");
    try {
      await client.updateHousehold(household.id, {
        ...form,
        currency_name: form.currency_name.trim(),
      });
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="outlined sm" onClick={() => setOpen(true)}>
        ⚙️ Settings{household.paused ? " · 🏖️ paused" : ""}
      </button>
    );
  }

  const num = (v: string) => (Number(v) >= 0 ? Number(v) : 0);

  // Portal to <body> so the modal escapes the app bar's backdrop-filter, which
  // would otherwise make position:fixed anchor to the 64px bar (clipping the top).
  return createPortal(
    <div className="settings-panel">
      <div className="edit-header">
        <div className="edit-header-bar">
          <strong>Editing household settings</strong>
          <span className="edit-header-actions">
            <button className="primary sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button className="sm" disabled={busy} onClick={() => { setOpen(false); setError(""); }}>Cancel</button>
          </span>
        </div>
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <details className="settings-group"><summary>Currency and reward defaults</summary>
        <div className="settings-row">
          <label>Currency name <Tip k="currency_name" /></label>
          <input
            value={form.currency_name}
            placeholder={DEFAULT_CURRENCY_NAME}
            onChange={(e) => setForm({ ...form, currency_name: e.target.value })}
            style={{ width: 140 }}
          />
        </div>
        <div className="settings-row">
          <label aria-label="Currency presets">Presets <Tip k="currency_presets" /></label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CURRENCY_PRESETS.map((preset) => (
              <button
                key={preset}
                className="sm"
                aria-pressed={form.currency_name.trim() === preset}
                onClick={() => setForm({ ...form, currency_name: preset })}
                style={
                  form.currency_name.trim() === preset
                    ? { fontWeight: 700, textDecoration: "underline" }
                    : undefined
                }
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <label>Bank threshold <Tip k="bank_threshold" /> <span className="muted">(0 = off)</span></label>
          <input
            type="number"
            min={0}
            value={form.bank_threshold}
            onChange={(e) => setForm({ ...form, bank_threshold: num(e.target.value) })}
            style={{ width: 90 }}
          />
        </div>
        <div className="settings-row">
          <label>⭐ Kudos default amount <Tip k="kudos_default_bucks" /></label>
          <input
            type="number"
            min={1}
            step="any"
            value={form.kudos_default_bucks}
            onChange={(e) => setForm({ ...form, kudos_default_bucks: Math.max(1, num(e.target.value)) })}
            style={{ width: 90 }}
          />
        </div>
        </details>
        <details className="settings-group"><summary>Screen-time delivery</summary>
        <div className="settings-row">
          <label>Queued grant expires after days (0 = never)
            <input type="number" min={0} max={365} value={form.grant_expiry_days} onChange={(e) => setForm({ ...form, grant_expiry_days: Number(e.target.value) })} />
          </label>
        </div>
        <DeliverySchedule value={form} onChange={(schedule) => setForm((old) => ({ ...old, ...schedule }))} />
        </details>
        <details className="settings-group"><summary>Reward expiry and conversion</summary>
        <div className="settings-row">
          <label>Rewards expire after days <Tip k="expiry_days" /> <span className="muted">(0 = off)</span></label>
          <input
            type="number"
            min={0}
            value={form.expiry_days}
            onChange={(e) => setForm({ ...form, expiry_days: num(e.target.value) })}
            style={{ width: 90 }}
          />
        </div>
        <div className="settings-row">
          <label>{cur} per $1 <Tip k="goods_rate" /> <span className="muted">(0 = off)</span></label>
          <input
            type="number"
            min={0}
            value={form.goods_rate}
            onChange={(e) => setForm({ ...form, goods_rate: num(e.target.value) })}
            style={{ width: 90 }}
          />
        </div>
        <div className="settings-row">
          <label>📱 {cur} per screen-time minute <Tip k="screen_rate" /></label>
          <input
            type="number"
            min={0}
            step="any"
            aria-label={`${cur} per screen-time minute`}
            value={form.screen_rate}
            onChange={(e) => setForm({ ...form, screen_rate: num(e.target.value) })}
            style={{ width: 90 }}
          />
        </div>
        </details>
        <details className="settings-group"><summary>Notifications</summary>
        <div className="settings-row">
          <label>Nudge after hours unapproved <Tip k="nudge_hours" /> <span className="muted">(0 = off)</span></label>
          <input
            type="number"
            min={0}
            value={form.nudge_hours}
            onChange={(e) => setForm({ ...form, nudge_hours: num(e.target.value) })}
            style={{ width: 90 }}
          />
        </div>
        <div className="settings-row">
          <label>🌙 Quiet hours start <Tip k="quiet_start" /> <span className="muted">(no notifications after)</span></label>
          <input
            type="time"
            value={form.quiet_start}
            onChange={(e) => setForm({ ...form, quiet_start: e.target.value })}
            style={{ width: 110 }}
          />
        </div>
        <div className="settings-row">
          <label>☀️ Quiet hours end <Tip k="quiet_end" /> <span className="muted">(resume notifications)</span></label>
          <input
            type="time"
            value={form.quiet_end}
            onChange={(e) => setForm({ ...form, quiet_end: e.target.value })}
            style={{ width: 110 }}
          />
        </div>
        </details>
        <details className="settings-group"><summary>Household preferences</summary>
        <div className="settings-row">
          <label>Household timezone (dates, resets, reminders, and schedules)
            <input placeholder="America/Los_Angeles" value={form.grant_timezone} onChange={(e) => setForm({ ...form, grant_timezone: e.target.value.trim() })} />
          </label>
        </div>
        <div className="settings-row">
          <label>🏖️ Vacation mode <Tip k="paused" /> <span className="muted">(pause reminders &amp; expiry)</span></label>
          <input
            type="checkbox"
            checked={form.paused}
            onChange={(e) => setForm({ ...form, paused: e.target.checked })}
          />
        </div>
        <div className="settings-row">
          <label>👀 Kids see each other's balance <Tip k="kids_see_balances" /></label>
          <input
            type="checkbox"
            checked={form.kids_see_balances}
            onChange={(e) => setForm({ ...form, kids_see_balances: e.target.checked })}
          />
        </div>
        </details>
        <details className="settings-group"><summary>Allowance and streak bonuses</summary>
        <div className="settings-row">
          <label>💵 Allowance amount <Tip k="allowance_amount" /> <span className="muted">(0 = off)</span></label>
          <input
            type="number"
            min={0}
            value={form.allowance_amount}
            onChange={(e) => setForm({ ...form, allowance_amount: num(e.target.value) })}
            style={{ width: 90 }}
          />
        </div>
        <div className="settings-row">
          <label>💵 Allowance cadence <Tip k="allowance_cadence" /></label>
          <select
            value={form.allowance_cadence}
            onChange={(e) => setForm({ ...form, allowance_cadence: e.target.value as "daily" | "weekly" })}
            style={{ width: 110 }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <div style={{ marginTop: 8, fontWeight: 600, fontSize: 13 }}>
          🔥 Streak milestone bonuses <Tip k="streak_bonus_3" /> <span className="muted">(0 = use default)</span>
        </div>
        {(
          [
            { key: "streak_bonus_3", label: "3-day bonus", placeholder: "5" },
            { key: "streak_bonus_7", label: "7-day bonus", placeholder: "15" },
            { key: "streak_bonus_14", label: "14-day bonus", placeholder: "40" },
            { key: "streak_bonus_30", label: "30-day bonus", placeholder: "100" },
          ] as const
        ).map(({ key, label, placeholder }) => (
          <div className="settings-row" key={key}>
            <label>{label} <Tip k={key} /></label>
            <input
              type="number"
              min={0}
              value={form[key]}
              placeholder={placeholder}
              onChange={(e) => setForm({ ...form, [key]: num(e.target.value) })}
              style={{ width: 90 }}
            />
          </div>
        ))}
        </details>
      </div>

    </div>,
    document.body,
  );
}
