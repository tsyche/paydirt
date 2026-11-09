// Screen-time pricing. Kids pick a preset; cost = minutes × the household's
// `screen_rate` (parentBucks per minute). One request maxes out at an hour —
// a kid who wants more sends several. pb_hooks/currency.pb.js mirrors these
// rules server-side (hooks can't import TS) and overwrites the client's amount.

export const SCREEN_PRESETS = [15, 30, 45, 60] as const;

export type ScreenPreset = (typeof SCREEN_PRESETS)[number];

/** Rate used when the household hasn't set one (0/unset). */
export const DEFAULT_SCREEN_RATE = 1;

export function isScreenPreset(minutes: unknown): minutes is ScreenPreset {
  return (SCREEN_PRESETS as readonly unknown[]).includes(minutes);
}

/** parentBucks per minute for a household; 0/unset/invalid → default. */
export function screenRate(household?: { screen_rate?: number } | null): number {
  const r = household?.screen_rate;
  return typeof r === "number" && r > 0 ? r : DEFAULT_SCREEN_RATE;
}

/** Whole-buck cost of `minutes` at `rate`; fractions round up. */
export function screenCost(minutes: ScreenPreset, rate: number): number {
  return Math.ceil(minutes * rate);
}

/** Request description, e.g. "30 min screen time". */
export function screenDescription(minutes: ScreenPreset): string {
  return `${minutes} min screen time`;
}

/** Parent-facing state; queued grants must finish before any manual action. */
export function screenGrantLabel(status?: string): string {
  switch (status) {
    case "queued": return "Grant pending — wait before granting manually";
    case "granted": return "Granted automatically";
    case "manual_done": return "Granted manually";
    default: return "Needs manual review";
  }
}

/** Minutes still owed, excluding successful deliveries from earlier windows. */
export function bankedTimeLabel(grant: {
  minutes?: number; screen_minutes?: number; grant_delivered_seconds?: number; grant_status?: string;
}): string {
  const remaining = Math.max(0, (grant.minutes || grant.screen_minutes || 0) - (grant.grant_delivered_seconds || 0) / 60);
  if (grant.grant_status === "queued") {
    return `${remaining} min queued — delivered automatically during allowed hours`;
  }
  if (grant.grant_status === "manual") return `${remaining} min still owed — needs manual review`;
  return screenGrantLabel(grant.grant_status);
}
