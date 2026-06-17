"use client";

import { useEffect, useState } from "react";

const PARTICLES = ["🪙", "🎉", "⭐", "🪙", "✨"];

/**
 * A quick coin-pop when a chore is approved — the little payoff that makes
 * earning feel good. Plays whenever `trigger` increments; reduced-motion is
 * honored in CSS. Mirrors the mobile Celebration so both surfaces feel alike.
 */
export function Celebration({ trigger }: { trigger: number }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 1100);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!on) return null;

  return (
    <div className="celebration" aria-hidden>
      {PARTICLES.map((emoji, i) => (
        <span
          key={i}
          className="celebration-bit"
          style={{ ["--i" as string]: String(i - (PARTICLES.length - 1) / 2) }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
