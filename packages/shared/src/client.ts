import PocketBase from "pocketbase";
import { Collections } from "./collections";
import type {
  Assignment,
  Chore,
  CurrencyTransaction,
  SpendRequest,
  User,
} from "./types";

/**
 * Typed PayDirt client wrapping the PocketBase SDK. Both web and mobile
 * construct their own PocketBase instance (each platform stores auth
 * differently) and hand it to this class.
 */
export class PaydirtClient {
  readonly pb: PocketBase;

  constructor(urlOrClient: string | PocketBase) {
    this.pb =
      typeof urlOrClient === "string" ? new PocketBase(urlOrClient) : urlOrClient;
    // The SDK auto-cancels duplicate in-flight requests by key. With React
    // strict mode (dev) firing effects twice and our parallel dashboard loads,
    // that cancels legitimate requests — they surface as "cancelled" in the
    // network tab and can reject the load. We don't rely on dedup, so disable it.
    this.pb.autoCancellation(false);
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<User> {
    const auth = await this.pb
      .collection(Collections.Users)
      .authWithPassword(email, password);
    return auth.record as unknown as User;
  }

  logout(): void {
    this.pb.authStore.clear();
  }

  get currentUser(): User | null {
    return (this.pb.authStore.record as unknown as User) ?? null;
  }

  get isParent(): boolean {
    return this.currentUser?.role === "parent";
  }

  // ── Chores ──────────────────────────────────────────────────────────────────

  listChildren(householdId: string): Promise<User[]> {
    return this.pb.collection(Collections.Users).getFullList<User>({
      filter: this.pb.filter("household = {:hh} && role = 'child'", { hh: householdId }),
      sort: "display_name",
    });
  }

  listChores(householdId: string): Promise<Chore[]> {
    return this.pb.collection(Collections.Chores).getFullList<Chore>({
      filter: this.pb.filter("household = {:hh} && active = true", { hh: householdId }),
      sort: "name",
    });
  }

  createChore(data: Partial<Chore>): Promise<Chore> {
    return this.pb.collection(Collections.Chores).create<Chore>(data);
  }

  updateChore(id: string, data: Partial<Chore>): Promise<Chore> {
    return this.pb.collection(Collections.Chores).update<Chore>(id, data);
  }

  /** Soft delete — keep history intact, drop it from active lists. */
  deactivateChore(id: string): Promise<Chore> {
    return this.pb.collection(Collections.Chores).update<Chore>(id, { active: false });
  }

  // ── Assignments ──────────────────────────────────────────────────────────────

  /** Assign a chore to one child. Call once per child for multi-kid chores. */
  assignChore(choreId: string, childId: string): Promise<Assignment> {
    return this.pb.collection(Collections.Assignments).create<Assignment>({
      chore: choreId,
      child: childId,
      status: "assigned",
    });
  }

  listAssignmentsForChild(childId: string): Promise<Assignment[]> {
    return this.pb.collection(Collections.Assignments).getFullList<Assignment>({
      filter: this.pb.filter("child = {:c}", { c: childId }),
      sort: "-created",
      expand: "chore",
    });
  }

  listPendingApprovals(_householdId: string): Promise<Assignment[]> {
    return this.pb.collection(Collections.Assignments).getFullList<Assignment>({
      filter: "status = 'completed'",
      sort: "completed_at",
      expand: "chore,child",
    });
  }

  /** Child marks a chore done. Optional photo proof (FormData on the platform side). */
  markComplete(assignmentId: string, photo?: Blob): Promise<Assignment> {
    const data: Record<string, unknown> = {
      status: "completed",
      completed_at: new Date().toISOString(),
    };
    if (photo) data.photo = photo;
    return this.pb.collection(Collections.Assignments).update<Assignment>(assignmentId, data);
  }

  /** Parent approval — the hook creates the earn transaction and bumps balance. */
  approveAssignment(assignmentId: string): Promise<Assignment> {
    return this.pb.collection(Collections.Assignments).update<Assignment>(assignmentId, {
      status: "approved",
      approved_at: new Date().toISOString(),
    });
  }

  rejectAssignment(assignmentId: string, message?: string): Promise<Assignment> {
    return this.pb.collection(Collections.Assignments).update<Assignment>(assignmentId, {
      status: "rejected",
      rejection_message: message ?? "",
    });
  }

  // ── Currency ─────────────────────────────────────────────────────────────────

  async getBalance(userId: string): Promise<number> {
    const user = await this.pb.collection(Collections.Users).getOne<User>(userId);
    return user.balance;
  }

  listTransactions(userId: string): Promise<CurrencyTransaction[]> {
    return this.pb.collection(Collections.CurrencyTransactions).getFullList<CurrencyTransaction>({
      filter: this.pb.filter("user = {:u}", { u: userId }),
      sort: "-created",
    });
  }

  /** Parent grants or docks parentBucks outside of chores. */
  adjustBalance(userId: string, amount: number, reason: string): Promise<CurrencyTransaction> {
    return this.pb.collection(Collections.CurrencyTransactions).create<CurrencyTransaction>({
      user: userId,
      amount,
      type: "manual_adjustment",
      reason,
    });
  }

  /** Writes a compensating negative entry to undo a chore approval. */
  reverseApproval(kidId: string, reward: number, choreName: string): Promise<CurrencyTransaction> {
    return this.adjustBalance(kidId, -reward, `Reversal: ${choreName}`);
  }

  /** Returns the N most recently approved assignments, newest first. */
  async listRecentlyApproved(limit = 8): Promise<Assignment[]> {
    const result = await this.pb
      .collection(Collections.Assignments)
      .getList<Assignment>(1, limit, {
        filter: "status = 'approved'",
        sort: "-approved_at",
        expand: "chore,child",
      });
    return result.items;
  }

  // ── Spend requests ───────────────────────────────────────────────────────────

  submitSpendRequest(
    childId: string,
    amount: number,
    description: string,
  ): Promise<SpendRequest> {
    return this.pb.collection(Collections.SpendRequests).create<SpendRequest>({
      child: childId,
      amount,
      description,
      status: "pending",
    });
  }

  listSpendRequestsForChild(childId: string): Promise<SpendRequest[]> {
    return this.pb.collection(Collections.SpendRequests).getFullList<SpendRequest>({
      filter: this.pb.filter("child = {:c}", { c: childId }),
      sort: "-created",
    });
  }

  listPendingSpendRequests(_householdId: string): Promise<SpendRequest[]> {
    return this.pb.collection(Collections.SpendRequests).getFullList<SpendRequest>({
      filter: "status = 'pending'",
      sort: "created",
      expand: "child",
    });
  }

  /** Approval — the hook validates balance and creates the spend transaction. */
  approveSpendRequest(id: string, resolvedBy: string): Promise<SpendRequest> {
    return this.pb.collection(Collections.SpendRequests).update<SpendRequest>(id, {
      status: "approved",
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    });
  }

  denySpendRequest(id: string, resolvedBy: string): Promise<SpendRequest> {
    return this.pb.collection(Collections.SpendRequests).update<SpendRequest>(id, {
      status: "denied",
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    });
  }
}
