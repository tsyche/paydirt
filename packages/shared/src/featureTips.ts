// One shared map of short explanations so web (hover) and mobile (info dialog)
// stay in sync. Keys are stable identifiers; values are one-line explanations.
export const FEATURE_TIPS: Record<string, string> = {
  currency_name:
    "The name of your family's virtual currency (e.g. Grit, Nuggets). Shown everywhere balances appear.",
  currency_presets:
    "One-click themed currency names. Pick one or type your own above.",
  bank_threshold:
    "When a kid's balance reaches this amount, it auto-banks into savings. 0 = off.",
  kudos_default_bucks:
    "Starting amount for a parent Great work award. Each award can still use a different amount.",
  expiry_days:
    "Days before unspent earnings expire. 0 = never expire (recommended for young kids).",
  goods_rate:
    "Grit required per $1 of real-world goods. A higher rate means the same grit buys less. Example: 176 grit buys $2 at 88 grit/$1, or $1 at 176 grit/$1. 0 = hide dollars.",
  nudge_hours:
    "Hours after a chore is completed before parents get a nudge to approve. 0 = never nudge.",
  quiet_start:
    "No notifications are sent after this time. Leave blank to disable quiet hours.",
  quiet_end: "Notifications resume at this time.",
  paused:
    "Vacation mode: suspends reminders, nudges, the weekly digest, and currency expiry.",
  kids_see_balances:
    "Let kids see their siblings' parentBucks balances. Off = each kid sees only their own (enforced by the server).",
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
  allowance_amount:
    "ParentBucks granted to each kid on the allowance cadence. 0 = off.",
  allowance_cadence:
    "How often the allowance is paid: daily or weekly.",
  goods_rate_kid:
    "Per-kid override of the household grit-per-dollar rate. A higher rate means the same grit buys less money. 0 = use the household default.",
  screen_rate:
    "Grit cost per minute when buying extra screen time. Saved chore-earned minutes cost no extra Grit. A higher rate means the same grit buys less time. Example: 30 grit buys 10 minutes at 3 grit/min, or 5 minutes at 6 grit/min. Kids ask in 15-minute steps, up to an hour per request.",
  chore_digest:
    "One push a day listing the kid's open chores, sent at this time (weekday / weekend). Blank = no summary. New recurring chores no longer push at 3 AM.",
  fl_ids:
    "Family Link child + device IDs for this kid's tablet. Set them to grant approved screen time automatically; leave blank to grant by hand.",
};

export function featureTip(key: string): string | undefined {
  return FEATURE_TIPS[key];
}
