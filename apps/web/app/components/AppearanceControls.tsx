"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  PALETTES,
  type PaletteId,
  type ThemeMode,
} from "@paydirt/shared";

const MODE_KEY = "paydirt-mode";
const PALETTE_KEY = "paydirt-palette";

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
  document.documentElement.setAttribute("data-theme", theme);
}

function applyPalette(id: PaletteId) {
  if (id === DEFAULT_PALETTE) document.documentElement.removeAttribute("data-palette");
  else document.documentElement.setAttribute("data-palette", id);
}

/**
 * App-bar appearance switcher: a palette icon that opens a popover with the
 * color dots and a System/Light/Dark toggle. Applies live and persists to
 * localStorage; the inline script in layout.tsx restores it before paint.
 */
export function AppearanceControls() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE);
  const [palette, setPalette] = useState<PaletteId>(DEFAULT_PALETTE);
  const ref = useRef<HTMLDivElement>(null);

  // Hydrate from storage (the pre-paint script already applied the attributes).
  useEffect(() => {
    const savedMode = localStorage.getItem(MODE_KEY) as ThemeMode | null;
    const savedPalette = localStorage.getItem(PALETTE_KEY) as PaletteId | null;
    if (savedMode === "system" || savedMode === "light" || savedMode === "dark") {
      setMode(savedMode);
    }
    if (savedPalette && PALETTES.some((p) => p.id === savedPalette)) {
      setPalette(savedPalette);
    }
  }, []);

  // Follow the OS when in System mode.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function chooseMode(next: ThemeMode) {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
    applyTheme(next);
  }

  function choosePalette(id: PaletteId) {
    setPalette(id);
    localStorage.setItem(PALETTE_KEY, id);
    applyPalette(id);
  }

  return (
    <div className="appearance" ref={ref}>
      <button
        className="icon-btn"
        aria-label="Theme and colors"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        🎨
      </button>
      {open && (
        <div className="appearance-popover" role="dialog" aria-label="Appearance">
          <h3>Color</h3>
          <div className="palette-dots">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                className="palette-dot"
                data-palette={p.id}
                aria-label={`${p.label} color theme`}
                aria-pressed={palette === p.id}
                style={{ background: p.swatch, ["--dot-color" as string]: p.swatch }}
                onClick={() => choosePalette(p.id)}
              />
            ))}
          </div>
          <h3>Appearance</h3>
          <div className="mode-toggle">
            {(["system", "light", "dark"] as ThemeMode[]).map((m) => (
              <button
                key={m}
                aria-pressed={mode === m}
                onClick={() => chooseMode(m)}
              >
                {m === "system" ? "Auto" : m === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
