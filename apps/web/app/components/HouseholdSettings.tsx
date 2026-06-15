"use client";

import { useState } from "react";
import type { Household } from "@paydirt/shared";
import { client } from "../lib/client";

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
    expiry_days: household.expiry_days ?? 0,
    goods_rate: household.goods_rate ?? 0,
    nudge_hours: household.nudge_hours ?? 0,
    paused: household.paused ?? false,
    quiet_start: household.quiet_start ?? "",
    quiet_end: household.quiet_end ?? "",
    streak_bonus_3: household.streak_bonus_3 ?? 0,
    streak_bonus_7: household.streak_bonus_7 ?? 0,
    streak_bonus_14: household.streak_bonus_14 ?? 0,
    streak_bonus_30: household.streak_bonus_30 ?? 0,
  });

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

  return (
    <div className="settings-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Household settings</span>
        <button className="icon-btn" onClick={() => setOpen(false)} title="Close">✕</button>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <div className="settings-row">
          <label>Currency name</label>
          <input
            value={form.currency_name}
            placeholder="parentBucks"
            onChange={(e) => setForm({ ...form, currency_name: e.target.value })}
            style={{ width: 140 }}
          />
        </div>
        <div className="settings-row">
          <label>Bank threshold <span className="muted">(0 = off)</span></label>
          <input
            type="number"
            min={0}
            value={form.bank_threshold}
            onChange={(e) => setForm({ ...form, bank_threshold: num(e.target.value) })}
            style={{ width: 90 }}
          />
        </div>
        <div className="settings-row">
          <label>Rewards expire after days <span className="muted">(0 = off)</span></label>
          <input
            type="number"
            min={0}
            value={form.expiry_days}
            onChange={(e) => setForm({ ...form, expiry_days: num(e.target.value) })}
            style={{ width: 90 }}
          />
        </div>
        <div className="settings-row">
          <label>Bucks per $1 <span className="muted">(0 = off)</span></label>
          <input
            type="number"
            min={0}
            value={form.goods_rate}
            onChange={(e) => setForm({ ...form, goods_rate: num(e.target.value) })}
            style={{ width: 90 }}
          />
        </div>
        <div className="settings-row">
          <label>Nudge after hours unapproved <span className="muted">(0 = off)</span></label>
          <input
            type="number"
            min={0}
            value={form.nudge_hours}
            onChange={(e) => setForm({ ...form, nudge_hours: num(e.target.value) })}
            style={{ width: 90 }}
          />
        </div>
        <div className="settings-row">
          <label>🌙 Quiet hours start <span className="muted">(no notifications after)</span></label>
          <input
            type="time"
            value={form.quiet_start}
            onChange={(e) => setForm({ ...form, quiet_start: e.target.value })}
            style={{ width: 110 }}
          />
        </div>
        <div className="settings-row">
          <label>☀️ Quiet hours end <span className="muted">(resume notifications)</span></label>
          <input
            type="time"
            value={form.quiet_end}
            onChange={(e) => setForm({ ...form, quiet_end: e.target.value })}
            style={{ width: 110 }}
          />
        </div>
        <div className="settings-row">
          <label>🏖️ Vacation mode <span className="muted">(pause reminders &amp; expiry)</span></label>
          <input
            type="checkbox"
            checked={form.paused}
            onChange={(e) => setForm({ ...form, paused: e.target.checked })}
          />
        </div>
        <div style={{ marginTop: 8, fontWeight: 600, fontSize: 13 }}>
          🔥 Streak milestone bonuses <span className="muted">(0 = use default)</span>
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
            <label>{label}</label>
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
      </div>

      <div className="divider" />
      <div className="inline">
        <button className="primary sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="sm" onClick={() => { setOpen(false); setError(""); }}>
          Cancel
        </button>
      </div>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
