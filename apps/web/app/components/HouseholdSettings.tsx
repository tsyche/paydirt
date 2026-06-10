"use client";

import { useState } from "react";
import type { Household } from "@paydirt/shared";
import { client } from "../lib/client";

// Collapsible household knobs: currency name, bank threshold, expiry,
// goods rate, approval nudges, vacation mode. All numeric fields use
// 0 = off (matching the hooks/cron behavior).
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
      <button style={{ fontSize: 12, opacity: 0.7 }} onClick={() => setOpen(true)}>
        ⚙️ Settings{household.paused ? " · 🏖️ paused" : ""}
      </button>
    );
  }

  const num = (v: string) => (Number(v) >= 0 ? Number(v) : 0);

  return (
    <div className="card stack" style={{ minWidth: 280 }}>
      <label className="row" style={{ fontSize: 13 }}>
        Currency name
        <input
          value={form.currency_name}
          placeholder="parentBucks"
          onChange={(e) => setForm({ ...form, currency_name: e.target.value })}
          style={{ width: 130 }}
        />
      </label>
      <label className="row" style={{ fontSize: 13 }}>
        Bank threshold (0 = off)
        <input
          type="number"
          min={0}
          value={form.bank_threshold}
          onChange={(e) => setForm({ ...form, bank_threshold: num(e.target.value) })}
          style={{ width: 80 }}
        />
      </label>
      <label className="row" style={{ fontSize: 13 }}>
        Rewards expire after (days, 0 = off)
        <input
          type="number"
          min={0}
          value={form.expiry_days}
          onChange={(e) => setForm({ ...form, expiry_days: num(e.target.value) })}
          style={{ width: 80 }}
        />
      </label>
      <label className="row" style={{ fontSize: 13 }}>
        Bucks per $1 (0 = off)
        <input
          type="number"
          min={0}
          value={form.goods_rate}
          onChange={(e) => setForm({ ...form, goods_rate: num(e.target.value) })}
          style={{ width: 80 }}
        />
      </label>
      <label className="row" style={{ fontSize: 13 }}>
        Nudge me after (hours unapproved, 0 = off)
        <input
          type="number"
          min={0}
          value={form.nudge_hours}
          onChange={(e) => setForm({ ...form, nudge_hours: num(e.target.value) })}
          style={{ width: 80 }}
        />
      </label>
      <label className="row" style={{ fontSize: 13 }}>
        🏖️ Vacation mode (pause reminders & expiry)
        <input
          type="checkbox"
          checked={form.paused}
          onChange={(e) => setForm({ ...form, paused: e.target.checked })}
        />
      </label>
      <div className="inline">
        <button className="primary" onClick={save} disabled={busy}>
          Save
        </button>
        <button onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
