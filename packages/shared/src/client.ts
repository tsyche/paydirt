import PocketBase from "pocketbase";
import { Collections } from "./collections";
import type {
  Assignment,
  Broadcast,
  Chore,
  ChoreProposal,
  CurrencyTransaction,
  Household,
  SavingsGoal,
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

  // ── Households ─────────────────────────────────────────────────────────────

  getHousehold(id: string): Promise<Household> {
    return this.pb.collection(Collections.Households).getOne<Household>(id);
  }

  updateHousehold(id: string, data: Partial<Household>): Promise<Household> {
    return this.pb.collection(Collections.Households).update<Household>(id, data);
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

  /** A kid's actionable list: everything except settled (approved/closed) items. */
  listActiveAssignmentsForChild(childId: string): Promise<Assignment[]> {
    return this.pb.collection(Collections.Assignments).getFullList<Assignment>({
      filter: this.pb.filter("child = {:c} && status != 'approved' && status != 'closed'", {
        c: childId,
      }),
      sort: "-created",
      expand: "chore",
    });
  }

  /** A kid's approved history, newest first, capped (default 50). */
  async listApprovedHistory(childId: string, limit = 50): Promise<Assignment[]> {
    const result = await this.pb
      .collection(Collections.Assignments)
      .getList<Assignment>(1, limit, {
        filter: this.pb.filter("child = {:c} && status = 'approved'", { c: childId }),
        sort: "-approved_at",
        expand: "chore",
      });
    return result.items;
  }

  listPendingApprovals(householdId: string): Promise<Assignment[]> {
    return this.pb.collection(Collections.Assignments).getFullList<Assignment>({
      filter: this.pb.filter("status = 'completed' && chore.household = {:hh}", {
        hh: householdId,
      }),
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

  /** Kid replies to a rejection; parents get notified by the hook. */
  respondToRejection(assignmentId: string, message: string): Promise<Assignment> {
    return this.pb.collection(Collections.Assignments).update<Assignment>(assignmentId, {
      kid_response: message,
    });
  }

  /** Parent reacts to an approved chore with an emoji; the kid gets pinged. */
  reactToAssignment(assignmentId: string, emoji: string): Promise<Assignment> {
    return this.pb.collection(Collections.Assignments).update<Assignment>(assignmentId, {
      reaction: emoji,
    });
  }

  /** Kid sets a one-shot reminder; the cron fires and clears it. */
  setKidReminder(assignmentId: string, when: Date): Promise<Assignment> {
    return this.pb.collection(Collections.Assignments).update<Assignment>(assignmentId, {
      kid_reminder_at: when.toISOString(),
    });
  }

  // ── Swaps ────────────────────────────────────────────────────────────────────

  /** Kid offers their assignment to a sibling (guard validates the target). */
  offerSwap(assignmentId: string, siblingId: string): Promise<Assignment> {
    return this.pb.collection(Collections.Assignments).update<Assignment>(assignmentId, {
      swap_to: siblingId,
    });
  }

  /** The swap target takes over (accept) or passes (decline). */
  respondToSwap(assignment: Assignment, myId: string, accept: boolean): Promise<Assignment> {
    return this.pb.collection(Collections.Assignments).update<Assignment>(assignment.id, {
      child: accept ? myId : assignment.child,
      swap_to: "",
    });
  }

  /** Swap offers waiting on this kid's answer. */
  listIncomingSwaps(childId: string): Promise<Assignment[]> {
    return this.pb.collection(Collections.Assignments).getFullList<Assignment>({
      filter: this.pb.filter("swap_to = {:c} && status = 'assigned'", { c: childId }),
      sort: "-created",
      expand: "chore,child",
    });
  }

  // ── Races ────────────────────────────────────────────────────────────────────

  /** Assign a race chore to several kids at once; first approval wins. */
  async startRace(choreId: string, kidIds: string[]): Promise<Assignment[]> {
    const out: Assignment[] = [];
    for (const kidId of kidIds) {
      out.push(await this.assignChore(choreId, kidId));
    }
    return out;
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

  /**
   * Undo an approval by moving the assignment back to "completed". A server
   * hook writes the compensating negative ledger entry, so the balance and
   * the assignment status can't drift apart (and a double-undo is impossible —
   * the second attempt finds the status already changed).
   */
  undoApproval(assignmentId: string): Promise<Assignment> {
    return this.pb.collection(Collections.Assignments).update<Assignment>(assignmentId, {
      status: "completed",
      approved_at: "",
    });
  }

  /** Returns the N most recently approved assignments in a household, newest first. */
  async listRecentlyApproved(householdId: string, limit = 8): Promise<Assignment[]> {
    const result = await this.pb
      .collection(Collections.Assignments)
      .getList<Assignment>(1, limit, {
        filter: this.pb.filter("status = 'approved' && chore.household = {:hh}", {
          hh: householdId,
        }),
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

  listPendingSpendRequests(householdId: string): Promise<SpendRequest[]> {
    return this.pb.collection(Collections.SpendRequests).getFullList<SpendRequest>({
      filter: this.pb.filter("status = 'pending' && child.household = {:hh}", {
        hh: householdId,
      }),
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

  // ── Savings goals ────────────────────────────────────────────────────────────

  listGoals(childId: string): Promise<SavingsGoal[]> {
    return this.pb.collection(Collections.SavingsGoals).getFullList<SavingsGoal>({
      filter: this.pb.filter("child = {:c}", { c: childId }),
      sort: "achieved,target",
    });
  }

  createGoal(childId: string, name: string, target: number): Promise<SavingsGoal> {
    return this.pb.collection(Collections.SavingsGoals).create<SavingsGoal>({
      child: childId,
      name,
      target,
      achieved: false,
    });
  }

  deleteGoal(goalId: string): Promise<boolean> {
    return this.pb.collection(Collections.SavingsGoals).delete(goalId);
  }

  // ── Chore proposals ──────────────────────────────────────────────────────────

  proposeChore(
    householdId: string,
    childId: string,
    name: string,
    rewardRequested: number,
    description?: string,
  ): Promise<ChoreProposal> {
    return this.pb.collection(Collections.ChoreProposals).create<ChoreProposal>({
      household: householdId,
      child: childId,
      name,
      description: description ?? "",
      reward_requested: rewardRequested,
      status: "pending",
    });
  }

  listPendingProposals(householdId: string): Promise<ChoreProposal[]> {
    return this.pb.collection(Collections.ChoreProposals).getFullList<ChoreProposal>({
      filter: this.pb.filter("household = {:hh} && status = 'pending'", { hh: householdId }),
      sort: "created",
      expand: "child",
    });
  }

  /**
   * Parent accepts a proposal: creates the real chore (at the parent's chosen
   * reward), assigns it to the proposing kid, and marks the proposal approved.
   */
  async approveProposal(
    proposal: ChoreProposal,
    parentId: string,
    reward = proposal.reward_requested,
  ): Promise<Chore> {
    const chore = await this.createChore({
      household: proposal.household,
      name: proposal.name,
      description: proposal.description,
      reward,
      type: "oneoff",
      created_by: parentId,
      active: true,
    });
    await this.assignChore(chore.id, proposal.child);
    await this.pb.collection(Collections.ChoreProposals).update(proposal.id, {
      status: "approved",
      resolved_by: parentId,
    });
    return chore;
  }

  declineProposal(proposalId: string, parentId: string): Promise<ChoreProposal> {
    return this.pb.collection(Collections.ChoreProposals).update<ChoreProposal>(proposalId, {
      status: "declined",
      resolved_by: parentId,
    });
  }

  // ── Broadcasts ───────────────────────────────────────────────────────────────

  /** Parent sends a one-liner to every kid in the household (ntfy hook delivers it). */
  sendBroadcast(householdId: string, senderId: string, message: string): Promise<Broadcast> {
    return this.pb.collection(Collections.Broadcasts).create<Broadcast>({
      household: householdId,
      sender: senderId,
      message,
    });
  }

  // ── Realtime ─────────────────────────────────────────────────────────────────
  // PocketBase realtime rides on SSE. On React Native there is no native
  // EventSource — the mobile app installs the react-native-sse polyfill before
  // constructing the client (see apps/mobile/lib/client.ts).

  /**
   * Subscribe to everything a kid's home screen shows: their assignments
   * (including swap offers aimed at them), their goals, and their own user
   * record (balance/streak). Fires `onChange` on any event; callers are
   * expected to re-fetch. Returns an unsubscribe function.
   */
  async subscribeToKidUpdates(childId: string, onChange: () => void): Promise<() => void> {
    const unsubs = await Promise.all([
      this.pb.collection(Collections.Assignments).subscribe("*", onChange, {
        filter: this.pb.filter("child = {:c} || swap_to = {:c}", { c: childId }),
      }),
      this.pb.collection(Collections.SavingsGoals).subscribe("*", onChange, {
        filter: this.pb.filter("child = {:c}", { c: childId }),
      }),
      this.pb.collection(Collections.Users).subscribe(childId, onChange),
    ]);
    return () => {
      for (const unsub of unsubs) void unsub();
    };
  }
}
