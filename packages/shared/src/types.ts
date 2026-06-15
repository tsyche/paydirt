// PayDirt MVP data model.
// Mirrors the PocketBase collections defined in pocketbase/pb_migrations/.
// Keep this file and the migrations in lockstep.

/** Fields PocketBase adds to every record. */
export interface BaseRecord {
  id: string;
  created: string; // ISO datetime
  updated: string; // ISO datetime
}

// ─── Households ──────────────────────────────────────────────────────────────

export interface Household extends BaseRecord {
  name: string;
  /** Display name for the virtual currency, e.g. "GoldCoins". Defaults to "parentBucks" when empty. */
  currency_name?: string;
  /** Notify a kid when their balance crosses this. 0/unset = off. */
  bank_threshold?: number;
  /** Earned rewards lapse after this many days (daily cron). 0/unset = off. */
  expiry_days?: number;
  /** Bucks per $1 for physical-goods conversion display. 0/unset = off. */
  goods_rate?: number;
  /** Remind parents when a completion waits this many hours. 0/unset = off. */
  nudge_hours?: number;
  /** Vacation mode: cron reminders/nudges/digest/expiry are suspended. */
  paused?: boolean;
  /** "HH:MM" start of nightly quiet window (no push notifications sent). */
  quiet_start?: string;
  /** "HH:MM" end of nightly quiet window. Wrap-around midnight is supported. */
  quiet_end?: string;
  /** Override streak milestone bonus amounts. 0/unset = use hardcoded default. */
  streak_bonus_3?: number;
  streak_bonus_7?: number;
  streak_bonus_14?: number;
  streak_bonus_30?: number;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export type UserRole = "parent" | "child";

/** Extends PocketBase's built-in auth collection. */
export interface User extends BaseRecord {
  email: string;
  role: UserRole;
  display_name: string;
  household: string; // -> households.id
  /** Emoji avatar shown on both apps (e.g. "🦊"). Set by parent. */
  avatar?: string;
  /** Accent color hex for the avatar badge (e.g. "#8e24aa"). Set by parent. */
  color?: string;
  /** ntfy topic this user's devices subscribe to. */
  ntfy_topic?: string;
  /** UnifiedPush endpoint URL from the ntfy distributor. Set by the app on login. */
  up_endpoint?: string;
  /** Cached parentBucks balance (children). Maintained by a PocketBase hook on transaction create. */
  balance: number;
  /** Larger tap targets, icon-heavy UI, minimal reading. Default on for youngest. */
  simplified_mode: boolean;
  /** Consecutive days with an approved chore. Maintained by hooks + daily cron. */
  streak_count?: number;
}

// ─── Chores ──────────────────────────────────────────────────────────────────

export type ChoreType = "oneoff" | "recurring";

export interface Chore extends BaseRecord {
  household: string; // -> households.id
  name: string;
  description?: string;
  /** parentBucks awarded on parent approval. */
  reward: number;
  type: ChoreType;
  /** "daily" | "weekly" | custom string; only meaningful when type === "recurring". */
  cadence?: string;
  photo_required: boolean;
  created_by: string; // -> users.id (parent)
  active: boolean;
  /** Optional deadline (one-offs). Cron escalates reminders: 24h → 2h → overdue. */
  due_at?: string;
  /** Race chore: assigned to several kids; first approval wins, others close. */
  race?: boolean;
  /** "HH:MM" server-local; cron reminds assigned kids daily at this time. */
  reminder_time?: string;
}

// ─── Chore Templates ─────────────────────────────────────────────────────────

/** Household-level reusable chore definition. Apply to create a new Chore. */
export interface ChoreTemplate extends BaseRecord {
  household: string;
  name: string;
  description?: string;
  reward: number;
  type: ChoreType;
  cadence?: string;
  photo_required: boolean;
  race?: boolean;
  reminder_time?: string;
}

// ─── Assignments ─────────────────────────────────────────────────────────────

export type AssignmentStatus = "assigned" | "completed" | "approved" | "rejected" | "closed";

/**
 * A chore assigned to one child. Status flows:
 * assigned → completed (child marks done) → approved | rejected (parent).
 * rejected → completed again (resubmit; server requires a fresh photo).
 * "closed" = race lost; set by the race hook, terminal and non-actionable.
 * One chore can have multiple assignments (one per child).
 */
export interface Assignment extends BaseRecord {
  chore: string; // -> chores.id
  child: string; // -> users.id
  status: AssignmentStatus;
  completed_at?: string;
  approved_at?: string;
  /** PocketBase file name; present when photo proof was attached. */
  photo?: string;
  rejection_message?: string;
  /** Kid's reply to a rejection; parents are notified and see it on approval. */
  kid_response?: string;
  /** Parent's emoji reaction to an approved chore. */
  reaction?: string;
  /** Deadline escalation progress (cron-managed): 0 none, 1 24h, 2 2h, 3 overdue. */
  reminder_stage?: number;
  /** Kid-set one-shot reminder; cron fires and clears it. */
  kid_reminder_at?: string;
  /** Last scheduled-reminder send (cron dedupe marker). */
  last_reminded?: string;
  /** Last approval-nudge send (cron dedupe marker). */
  nudged_at?: string;
  /** Pending swap offer to a sibling; they accept (take over) or decline. */
  swap_to?: string; // -> users.id
}

// ─── Savings Goals ───────────────────────────────────────────────────────────

/** Kid-owned target; a hook marks it achieved when the balance crosses target. */
export interface SavingsGoal extends BaseRecord {
  child: string; // -> users.id
  name: string;
  target: number;
  achieved: boolean;
  achieved_at?: string;
}

// ─── Chore Proposals ─────────────────────────────────────────────────────────

export type ChoreProposalStatus = "pending" | "approved" | "declined";

/** A kid pitches a chore + asking price; a parent approves or declines. */
export interface ChoreProposal extends BaseRecord {
  household: string; // -> households.id
  child: string; // -> users.id
  name: string;
  description?: string;
  reward_requested: number;
  status: ChoreProposalStatus;
  resolved_by?: string; // -> users.id (parent)
}

// ─── Currency ────────────────────────────────────────────────────────────────

export type TransactionType = "earn" | "spend" | "manual_adjustment";

/**
 * Append-only ledger. Positive amount = earn, negative = spend.
 * The sum of a user's transactions equals their balance; the cached
 * User.balance is maintained by a hook so the ledger stays the source of truth.
 */
export interface CurrencyTransaction extends BaseRecord {
  user: string; // -> users.id (child)
  amount: number;
  type: TransactionType;
  reason?: string;
  related_assignment?: string; // -> assignments.id
  related_spend_request?: string; // -> spend_requests.id
}

// ─── Broadcasts ──────────────────────────────────────────────────────────────

/**
 * A one-liner from a parent to every kid in the household. Creating a record
 * triggers the ntfy hook that fans the message out to each kid's topic.
 */
export interface Broadcast extends BaseRecord {
  household: string; // -> households.id
  sender: string; // -> users.id (parent)
  message: string;
}

// ─── Spend Requests ──────────────────────────────────────────────────────────

export type SpendRequestStatus = "pending" | "approved" | "denied";

export interface SpendRequest extends BaseRecord {
  child: string; // -> users.id
  /** parentBucks to deduct on approval. */
  amount: number;
  /** What the child wants, e.g. "30 minutes screen time". */
  description: string;
  status: SpendRequestStatus;
  resolved_at?: string;
  resolved_by?: string; // -> users.id (parent)
}
