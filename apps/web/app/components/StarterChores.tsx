"use client";

import { useState } from "react";
import { errorMessage, STARTER_BANDS } from "@paydirt/shared";
import { client } from "../lib/client";

/** Pick-and-add starter chores by age band. Chores already in the household (by name) are skipped. */
export function StarterChores({
  householdId,
  parentId,
  existingNames,
  onAdded,
}: {
  householdId: string;
  parentId: string;
  existingNames: string[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bandId, setBandId] = useState(STARTER_BANDS[0].id);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const have = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const band = STARTER_BANDS.find((b) => b.id === bandId) ?? STARTER_BANDS[0];
  const key = (name: string) => `${band.id}/${name}`;
  const addable = band.chores.filter((c) => !have.has(c.name.toLowerCase()));

  function toggle(name: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(key(name))) next.add(key(name));
      return next;
    });
  }

  function pickAll() {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const c of addable) next.add(key(c.name));
      return next;
    });
  }

  async function add() {
    const chosen = addable.filter((c) => picked.has(key(c.name)));
    if (chosen.length === 0) return;
    setBusy(true);
    setError("");
    try {
      for (const c of chosen) {
        await client.createChore({
          household: householdId,
          name: c.name,
          description: c.description,
          reward: c.reward,
          type: c.type,
          ...(c.cadence ? { cadence: c.cadence } : {}),
          photo_required: c.photo_required ?? false,
          created_by: parentId,
          active: true,
        });
      }
      setPicked(new Set());
      onAdded();
    } catch (e) {
      setError(errorMessage(e));
      onAdded(); // some may have been created before the failure
    } finally {
      setBusy(false);
    }
  }

  const count = addable.filter((c) => picked.has(key(c.name))).length;

  return (
    <div style={{ marginBottom: 10 }}>
      <button className="outlined sm" onClick={() => setOpen((o) => !o)} style={{ fontSize: 13 }}>
        🌱 Starter chores {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="card" style={{ marginTop: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="inline" style={{ gap: 6, flexWrap: "wrap" }}>
            {STARTER_BANDS.map((b) => (
              <button
                key={b.id}
                className={`sm ${b.id === bandId ? "tonal" : "outlined"}`}
                onClick={() => setBandId(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
          {band.chores.map((c) => {
            const exists = have.has(c.name.toLowerCase());
            return (
              <label key={c.name} className="inline" style={{ gap: 8, opacity: exists ? 0.5 : 1 }}>
                <input
                  type="checkbox"
                  checked={exists || picked.has(key(c.name))}
                  disabled={exists || busy}
                  onChange={() => toggle(c.name)}
                />
                <span style={{ fontSize: 14 }}>
                  <strong>{c.name}</strong>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>
                    {c.reward} · {c.cadence ?? "one-off"}
                    {c.photo_required ? " · 📷" : ""}
                    {exists ? " · already added" : ""}
                  </span>
                </span>
              </label>
            );
          })}
          {error && <p className="error">{error}</p>}
          <div className="inline" style={{ gap: 6 }}>
            <button className="sm" onClick={pickAll} disabled={busy || addable.length === 0}>
              Select all
            </button>
            <button className="sm" onClick={() => void add()} disabled={busy || count === 0}>
              {busy ? "Adding…" : `Add ${count} chore${count === 1 ? "" : "s"}`}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            Rewards are suggestions; edit any chore afterwards.
          </p>
        </div>
      )}
    </div>
  );
}
