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
}

// ─── Users ───────────────────────────────────────────────────────────────────

export type UserRole = "parent" | "child";

/** Extends PocketBase's built-in auth collection. */
export interface User extends BaseRecord {
  email: string;
  role: UserRole;
  display_name: string;
  household: string; // -> households.id
  /** ntfy topic this user's devices subscribe to. */
  ntfy_topic?: string;
  /** Cached parentBucks balance (children). Maintained by a PocketBase hook on transaction create. */
  balance: number;
  /** Larger tap targets, icon-heavy UI, minimal reading. Default on for youngest. */
  simplified_mode: boolean;
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
}

// ─── Assignments ─────────────────────────────────────────────────────────────

export type AssignmentStatus = "assigned" | "completed" | "approved" | "rejected";

/**
 * A chore assigned to one child. Status flows:
 * assigned → completed (child marks done) → approved | rejected (parent).
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
