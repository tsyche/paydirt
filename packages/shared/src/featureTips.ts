// One shared map of short explanations so web (hover) and mobile (info dialog)
// stay in sync. Keys are stable identifiers; values are one-line explanations.
export const FEATURE_TIPS: Record<string, string> = {
  currency_name:
    "The name of your family's virtual currency (e.g. Grit, Nuggets). Shown everywhere balances appear.",
  currency_presets:
    "One-click themed currency names. Pick one or type your own above.",
  bank_threshold:
    "When a kid's balance reaches this amount, it auto-banks into savings. 0 = off.",
  expiry_days:
    "Days before unspent earnings expire. 0 = never expire (recommended for young kids).",
  goods_rate:
    "How many parentBucks equal $1 of real-world goods. Used to show dollar equivalents. 0 = hide dollars.",
  nudge_hours:
    "Hours after a chore is completed before parents get a nudge to approve. 0 = never nudge.",
  quiet_start:
    "No notifications are sent after this time. Leave blank to disable quiet hours.",
  quiet_end: "Notifications resume at this time.",
  paused:
    "Vacation mode: suspends reminders, nudges, the weekly digest, and currency expiry.",
  streak_bonus_3: "Bonus parentBucks awarded at a 3-day chore streak. 0 = use the default (5).",
  streak_bonus_7: "Bonus parentBucks awarded at a 7-day chore streak. 0 = use the default (15).",
  streak_bonus_14: "Bonus parentBucks awarded at a 14-day chore streak. 0 = use the default (40).",
  streak_bonus_30: "Bonus parentBucks awarded at a 30-day chore streak. 0 = use the default (100).",
  calm_mode:
    "Quieter home screen: hides the badge shelf, confetti, and balance count-up. For kids who find animations overwhelming.",
  simplified_mode:
    "Larger tap targets and icons with minimal reading. Default on for the youngest kids.",
  race_mechanic:
    "A chore assignable to several kids; the first one approved wins the reward.",
  goods_rate_kid:
    "Per-kid override of the household bucks-per-dollar rate. 0 = use the household default.",
};

export function featureTip(key: string): string | undefined {
  return FEATURE_TIPS[key];
}
