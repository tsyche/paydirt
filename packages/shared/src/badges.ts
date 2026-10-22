// Badge shelf — the playful layer over the ledger. Pure computation so both
// apps (and tests) agree on what a kid has earned. Numbers come from history,
// streaks, goals, and balance; nothing here mutates state.

export interface BadgeStats {
  /** Approved chores (all-time count from history). */
  approvedCount: number;
  /** Consecutive earn-days. */
  streakDays: number;
  /** Savings goals achieved. */
  goalsAchieved: number;
  /** Current parentBucks balance. */
  balance: number;
}

export interface Badge {
  id: string;
  icon: string;
  label: string;
  earned: boolean;
  /** Progress toward the next tier, e.g. "3/10" — null when earned or no cap. */
  progress: string | null;
}

interface BadgeDef {
  id: string;
  icon: string;
  label: string;
  /** Earned when the tracked value reaches this. */
  threshold: number;
  stat: keyof BadgeStats;
}

const DEFS: BadgeDef[] = [
  { id: "first_chore", icon: "🌟", label: "First chore", threshold: 1, stat: "approvedCount" },
  { id: "ten_chores", icon: "💪", label: "10 chores", threshold: 10, stat: "approvedCount" },
  { id: "fifty_chores", icon: "🏆", label: "50 chores", threshold: 50, stat: "approvedCount" },
  { id: "streak_3", icon: "🔥", label: "3-day streak", threshold: 3, stat: "streakDays" },
  { id: "streak_7", icon: "⚡", label: "7-day streak", threshold: 7, stat: "streakDays" },
  { id: "streak_30", icon: "🚀", label: "30-day streak", threshold: 30, stat: "streakDays" },
  { id: "first_goal", icon: "🎯", label: "First goal", threshold: 1, stat: "goalsAchieved" },
  { id: "three_goals", icon: "🏅", label: "3 goals", threshold: 3, stat: "goalsAchieved" },
  { id: "century", icon: "💰", label: "100 in the bank", threshold: 100, stat: "balance" },
  { id: "half_k", icon: "💎", label: "500 in the bank", threshold: 500, stat: "balance" },
];

/**
 * Compute the full badge shelf for a kid. Unearned badges carry progress
 * (current/threshold) so the UI can show how close they are; earned ones
 * drop progress to null.
 */
export function computeBadges(stats: BadgeStats): Badge[] {
  return DEFS.map((def) => {
    const value = stats[def.stat];
    const earned = value >= def.threshold;
    return {
      id: def.id,
      icon: def.icon,
      label: def.label,
      earned,
      progress: earned ? null : `${value}/${def.threshold}`,
    };
  });
}

/** Badges earned so far (for counters / shelves that only show wins). */
export function earnedBadges(stats: BadgeStats): Badge[] {
  return computeBadges(stats).filter((b) => b.earned);
}

/**
 * Whether a balance change should fire the count-up + celebration. The parent
 * calm-mode dial silences playful extras; a decrease (deduction, spend) never
 * celebrates. Initial load (prev === null) is not a change either.
 */
export function shouldCelebrate(prev: number | null, next: number, calmMode: boolean): boolean {
  if (calmMode) return false;
  if (prev === null) return false;
  return next > prev;
}
