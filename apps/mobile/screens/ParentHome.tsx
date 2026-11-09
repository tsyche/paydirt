import { SwipeActionsRow } from "../components/SwipeActionsRow";
import { TimeField } from "../components/TimeField";
import { localDateKey, localDateInstant, householdDateTime } from "@paydirt/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ScrollView, StyleSheet, RefreshControl, Alert, Image, Modal, TouchableOpacity } from "react-native";
import {
  Appbar,
  BottomNavigation,
  Card,
  Text,
  Button,
  Chip,
  Icon,
  Dialog,
  Portal,
  Snackbar,
  Divider,
  Switch,
  SegmentedButtons,
  useTheme,
} from "react-native-paper";
import { TextInput } from "../components/TextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Assignment, Chore, ChoreProposal, ChoreTemplate, Household, PayMode, RecentAssignmentRow, SpendRequest, TimeGrant, User } from "@paydirt/shared";
import { kidsAtLimit, knownChoreNames, parseAssignDraft, serializeAssignDraft, currencyDisplayName, screenRate, effectiveGoodsRate, bankedTimeLabel, errorMessage, kidAccent, limitLabel, limitUnit, payLabel, payMode, validatePay, waitingActionCount } from "@paydirt/shared";
import { client } from "../lib/client";
import { isNetworkError } from "../lib/reachability";
import { useRealtimeResume } from "../lib/useRealtimeResume";
import { tabForNotificationType } from "../lib/deepLinks";
import { Avatar } from "../components/Avatar";
import { ChoreNotes } from "../components/ChoreNotes";
import { RecurringDueFields } from "../components/RecurringDueFields";
import { PartialCredit } from "../components/PartialCredit";
import { ApprovalFeedback } from "../components/ApprovalFeedback";
import { BrandTitle } from "../components/BrandTitle";
import { AppearanceControls } from "../components/AppearanceControls";
import { ChunkyButton } from "../components/ChunkyButton";
import { Celebration } from "../components/Celebration";
import { KidDetail } from "../components/KidDetail";
import { RecentlyApproved } from "../components/RecentlyApproved";
import { PastScreenGrants } from "../components/PastScreenGrants";
import { StarterChores } from "../components/StarterChores";
import { PayModeFields } from "../components/PayModeFields";
import { ChoreCreateDialog } from "../components/ChoreCreateDialog";
import { OfflineBanner } from "../components/OfflineBanner";
import { HouseholdSettings } from "../components/HouseholdSettings";
import { GritButton } from "../components/GritButton";
import { OverviewModalButton } from "../components/OverviewView";
import { LedgerView } from "../components/LedgerView";
import { ActivityReport } from "../components/ActivityReport";
import { HeaderMenu } from "../components/HeaderMenu";
import { useTabHistory } from "../lib/useTabHistory";

/** Status colors for the kid-chip icons and their key (always green / yellow). */
const OK_GREEN = "#2e7d32";
const WARN_YELLOW = "#f9a825";

const PARENT_TABS = [
  { key: "approvals", title: "Approvals", focusedIcon: "inbox", unfocusedIcon: "inbox-outline" },
  { key: "kids", title: "Kids", focusedIcon: "account-child", unfocusedIcon: "account-child-outline" },
  { key: "chores", title: "Chores", focusedIcon: "clipboard-list", unfocusedIcon: "clipboard-list-outline" },
  { key: "ledger", title: "Ledger", focusedIcon: "book-open", unfocusedIcon: "book-open-outline" },
  { key: "settings", title: "Settings", focusedIcon: "cog", unfocusedIcon: "cog-outline" },
];

type ExpandedAssignment = Assignment & { expand?: { chore?: Chore; child?: User } };
type ExpandedSpend = SpendRequest & { expand?: { child?: User } };
type ExpandedGrant = TimeGrant & { expand?: { child?: User } };
type ExpandedProposal = ChoreProposal & { expand?: { child?: User } };


// Wrapping chip-style metadata (stacks on narrow screens) instead of one dot-separated line.
function MetaWrap({ items, color }: { items: string[]; color: string }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {items.filter(Boolean).map((item, i) => (
        <Text
          key={`${i}-${item}`}
          variant="bodySmall"
          style={{ color, borderWidth: StyleSheet.hairlineWidth, borderColor: color, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}
        >
          {item}
        </Text>
      ))}
    </View>
  );
}

export function ParentHome({
  user,
  onLogout,
  notificationRoute,
  notificationSetupNeeded,
  onOpenNotificationSetup,
}: {
  user: User;
  onLogout: () => void;
  // A tapped push notification's routing info (see App.tsx + lib/deepLinks.ts). Optional
  // so ParentHome stays usable standalone (e.g. in tests) without a Linking listener.
  notificationRoute?: { type: string | null; nonce: number } | null;
  // True while ntfy notification setup is incomplete (no subscribed topic /
  // unconfirmed delivery) — shows a persistent banner that reopens the wizard.
  notificationSetupNeeded?: boolean;
  onOpenNotificationSetup?: () => void;
}) {
  const theme = useTheme();
  const [household, setHousehold] = useState<Household | null>(null);
  const [hhSettingsOpen, setHhSettingsOpen] = useState(false);
  const [kids, setKids] = useState<User[]>([]);
  const [approvals, setApprovals] = useState<ExpandedAssignment[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [rejectingAssignmentId, setRejectingAssignmentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [spend, setSpend] = useState<ExpandedSpend[]>([]);
  const [screenGrants, setScreenGrants] = useState<ExpandedSpend[]>([]);
  const [bonusGrants, setBonusGrants] = useState<ExpandedGrant[]>([]);
  const [proposals, setProposals] = useState<ExpandedProposal[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [archivedChores, setArchivedChores] = useState<Chore[]>([]);
  const [showArchivedChores, setShowArchivedChores] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [snack, setSnack] = useState("");
  const [tab, setTab] = useTabHistory("approvals");
  const [detailKid, setDetailKid] = useState<string | null>(null);
  const [ledgerKid, setLedgerKid] = useState<string | undefined>();
  const [approvedKey, setApprovedKey] = useState(0);
  const [celebrate, setCelebrate] = useState(0);
  const party = () => setCelebrate((n) => n + 1);

  // Create chore form state
  const [showCreateChore, setShowCreateChore] = useState(false);
  const [choreName, setChoreName] = useState("");
  const [choreNotes, setChoreNotes] = useState("");
  const [timerMinutes, setTimerMinutes] = useState("0");
  const [choreDueTime, setChoreDueTime] = useState("");
  const [choreDueDay, setChoreDueDay] = useState("1");
  const [choreReward, setChoreReward] = useState("10");
  const [chorePayMode, setChorePayMode] = useState<PayMode>("bucks");
  const [choreMinutes, setChoreMinutes] = useState("");
  const [choreType, setChoreType] = useState<"oneoff" | "recurring">("oneoff");
  const [choreCadence, setChoreCadence] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [chorePhoto, setChorePhoto] = useState(false);
  const [choreRace, setChoreRace] = useState(false);
  const [choreReminder, setChoreReminder] = useState("");
  const [creatingChore, setCreatingChore] = useState(false);
  const [choreCreateError, setChoreCreateError] = useState("");
  useEffect(() => { setChoreCreateError(""); }, [choreName, chorePayMode, choreReward, choreMinutes]);

  // Due date for new chore
  const [choreDueAt, setChoreDueAt] = useState("");
  const [choreLimit, setChoreLimit] = useState("");
  const [showAdvancedChore, setShowAdvancedChore] = useState(false);

  // Proposal → create-chore prefill (approve sends the idea through the form)
  const [proposalFill, setProposalFill] = useState<ExpandedProposal | null>(null);
  const [reasonDialog, setReasonDialog] = useState<{ kind: "decline" | "deny"; id: string } | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");

  // Template state
  const [templates, setTemplates] = useState<ChoreTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Inline chore edit state
  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTimerMinutes, setEditTimerMinutes] = useState("0");
  const [editDueTime, setEditDueTime] = useState("");
  const [editDueDay, setEditDueDay] = useState("1");
  const [editReward, setEditReward] = useState("10");
  const [editPayMode, setEditPayMode] = useState<PayMode>("bucks");
  const [editMinutes, setEditMinutes] = useState("");
  const [editType, setEditType] = useState<"oneoff" | "recurring">("oneoff");
  const [editCadence, setEditCadence] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [editPhoto, setEditPhoto] = useState(false);
  const [editRace, setEditRace] = useState(false);
  const [editReminder, setEditReminder] = useState("");
  const [editLimit, setEditLimit] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editAdvanced, setEditAdvanced] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Assignment state: choreId → Set of selected kidIds
  const [heldByChore, setHeldByChore] = useState<Record<string, Set<string>>>({});
  const [recentRows, setRecentRows] = useState<RecentAssignmentRow[]>([]);
  const [assignSelections, setAssignSelections] = useState<Record<string, Set<string>>>({});
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});
  // Picks persist immediately so an app update/restart doesn't lose them before Assign is pressed.
  const draftKey = `paydirt.assignDraft.${user.household}`;
  const draftLoaded = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(draftKey)
      .then((raw) => {
        const saved = parseAssignDraft(raw);
        setAssignSelections((cur) => ({ ...saved, ...cur }));
      })
      .catch(() => {})
      .finally(() => {
        draftLoaded.current = true;
      });
  }, [draftKey]);
  useEffect(() => {
    if (!draftLoaded.current) return;
    AsyncStorage.setItem(draftKey, serializeAssignDraft(assignSelections)).catch(() => {});
  }, [assignSelections, draftKey]);


  // Co-parent management
  const [coParents, setCoParents] = useState<User[]>([]);
  const [showAddParent, setShowAddParent] = useState(false);
  const [newParentEmail, setNewParentEmail] = useState("");
  const [newParentName, setNewParentName] = useState("");
  const [newParentPass, setNewParentPass] = useState("");
  const [addingParent, setAddingParent] = useState(false);

  const currencyName = currencyDisplayName(household);
  const goodsRate = household?.goods_rate ?? 0;

  const reload = useCallback(async () => {
    setRefreshing(true);
    setApprovedKey((k) => k + 1);
    try {
      const [hh, k, a, s, c, archived, p, grants, bonus, active, recent] = await Promise.all([
        client.getHousehold(user.household),
        client.listChildren(user.household),
        client.listPendingApprovals(user.household),
        client.listPendingSpendRequests(user.household),
        client.listChores(user.household),
        client.listArchivedChores(user.household),
        client.listPendingProposals(user.household),
        client.listScreenTimeGrants(user.household, 0),
        client.listBonusGrants(user.household, 0),
        client.listActiveAssignmentsForHousehold(user.household),
        client.listRecentAssignmentsForHousehold(user.household),
      ]);
      setHousehold(hh);
      setKids(k);
      setApprovals(a as ExpandedAssignment[]);
      setSpend(s as ExpandedSpend[]);
      setScreenGrants(grants as ExpandedSpend[]);
      setBonusGrants(bonus as ExpandedGrant[]);
      setChores(c);
      setArchivedChores(archived);
      setHeldByChore(active.reduce<Record<string, Set<string>>>((m, x) => { (m[x.chore] ??= new Set()).add(x.child); return m; }, {}));
      setRecentRows(recent);
      setProposals(p as ExpandedProposal[]);
    } catch (e) {
      // Network failures already surface via the offline banner — an extra
      // toast on top would just be noise. Anything else still gets one.
      if (!isNetworkError(e)) setSnack(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [user.household]);

  useEffect(() => {
    void reload();
    let unsub: (() => void) | undefined;
    let disposed = false;
    client
      .subscribeToDashboardUpdates(user.household, () => void reload())
      .then((fn) => {
        if (disposed) fn();
        else unsub = fn;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unsub?.();
    };
  }, [reload, user.household]);

  // Rebuild the realtime socket + re-fetch on foreground and on reconnect —
  // a dead SSE socket fires no error, so without this events silently stop
  // after backgrounding or a network blip (see useRealtimeResume).
  useRealtimeResume(reload);

  // Switch to the tab a tapped notification targets (see App.tsx's Linking wiring). Keyed
  // off notificationRoute's nonce, not its tab, so tapping the same notification type twice
  // in a row still re-navigates even though the resolved tab didn't change.
  useEffect(() => {
    if (!notificationRoute) return;
    const target = tabForNotificationType(notificationRoute.type);
    if (target) setTab(target);
  }, [notificationRoute]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) setSnack(ok);
      await reload();
    } catch (e) {
      setSnack(errorMessage(e));
    }
  };

  function confirmReject(assignmentId: string) {
    setRejectionReason("");
    setRejectingAssignmentId(assignmentId);
  }

  function rejectWithReason() {
    if (!rejectingAssignmentId) return;
    const assignmentId = rejectingAssignmentId;
    setRejectingAssignmentId(null);
    void act(
      () => client.rejectAssignment(assignmentId, rejectionReason.trim()),
      "Rejected."
    );
  }

  function startProposalApprove(proposal: ExpandedProposal) {
    // Approving a kid idea opens the create-chore form prefilled from the idea;
    // the proposal flips to approved only when the chore is saved (else cancel).
    setProposalFill(proposal);
    setChoreName(proposal.name);
    setChoreNotes(proposal.description ?? "");
    setChoreReward(String(proposal.reward_requested ?? 10));
    setChorePayMode("bucks");
    setChoreMinutes("");
    setChoreType("oneoff");
    setTimerMinutes("0");
    setChoreDueTime("");
    setChoreDueDay("1");
    setChoreCadence("weekly");
    setChoreReminder("");
    setChoreCreateError("");
    setShowTemplates(false);
    setChorePhoto(false);
    setChoreRace(false);
    setChoreDueAt("");
    setChoreLimit("");
    setShowAdvancedChore(false);
    setShowCreateChore(true);
  }

  function submitReasonDialog() {
    if (!reasonDialog) return;
    const { kind, id } = reasonDialog;
    const reason = reasonDraft.trim();
    setReasonDialog(null);
    setReasonDraft("");
    if (kind === "decline") {
      void act(() => client.declineProposal(id, user.id, reason), "Declined.");
    } else {
      void act(() => client.denySpendRequest(id, user.id, reason), "Spend denied.");
    }
  }

  async function addCoParent() {
    if (!newParentEmail.trim() || !newParentName.trim() || !newParentPass) return;
    setAddingParent(true);
    try {
      await client.createCoParent(newParentEmail.trim(), newParentName.trim(), newParentPass);
      const updated = await client.listParents(user.household);
      setCoParents(updated);
      setShowAddParent(false);
      setNewParentEmail("");
      setNewParentName("");
      setNewParentPass("");
      setSnack("Co-parent added ✅");
    } catch (e) {
      setSnack("Failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAddingParent(false);
    }
  }

  async function broadcast() {
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    try {
      await client.sendBroadcast(user.household, user.id, broadcastMsg.trim());
      setBroadcastMsg("");
      setSnack("Sent to all kids 📣");
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setBroadcasting(false);
    }
  }

  // Whole number >= 0; blank/garbage = 0 (no limit). Always sent so an edit can clear it.
  function parseLimit(v: string): number {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  async function createChore() {
    if (!choreName.trim()) return;
    const payError = validatePay({ pay_mode: chorePayMode, reward: Number(choreReward) || 0, reward_minutes: Number(choreMinutes) || 0 });
    if (payError) { setChoreCreateError(payError); setSnack(payError); return; }
    setChoreCreateError("");
    setCreatingChore(true);
    try {
      const chore = await client.createChore({
        household: user.household,
        name: choreName.trim(),
        description: choreNotes.trim(),
        timer_minutes: Number(timerMinutes),
        due_time: choreType === "recurring" ? choreDueTime.trim() : "",
        due_day: Number(choreDueDay),
        reward: Number(choreReward) || 0,
        pay_mode: chorePayMode,
        reward_minutes: Number(choreMinutes) || 0,
        type: choreType,
        cadence: choreType === "recurring" ? choreCadence : undefined,
        photo_required: chorePhoto,
        race: choreRace,
        reminder_time: choreReminder.trim() || undefined,
        due_at: choreDueAt.trim() ? localDateInstant(choreDueAt.trim()) : undefined,
        max_per_period: parseLimit(choreLimit),
        created_by: user.id,
        active: true,
      });
      if (proposalFill) {
        await client.approveProposal(proposalFill, user.id, Number(choreReward) || proposalFill.reward_requested, chore.id);
        setProposalFill(null);
        setSnack("Idea approved — chore created 🎉");
      } else {
        setSnack("Chore created ✅");
      }
      setChoreName("");
      setChoreNotes("");
      setTimerMinutes("0");
      setChoreDueTime("");
      setChoreDueDay("1");
      setChoreReward("10");
      setChorePayMode("bucks");
      setChoreMinutes("");
      setChoreType("oneoff");
      setChoreCadence("weekly");
      setChorePhoto(false);
      setChoreRace(false);
      setChoreReminder("");
      setChoreDueAt("");
      setChoreLimit("");
      setShowCreateChore(false);
      await reload();
    } catch (e) {
      setChoreCreateError(errorMessage(e));
      setSnack(errorMessage(e));
    } finally {
      setCreatingChore(false);
    }
  }

  function applyTemplate(t: ChoreTemplate) {
    setChoreName(t.name);
    setChoreNotes(t.description ?? "");
    setTimerMinutes(String(t.timer_minutes ?? 0));
    setChoreDueTime(t.due_time ?? "");
    setChoreDueDay(String(t.due_day ?? 1));
    setChoreReward(String(t.reward));
    setChorePayMode(payMode(t));
    setChoreMinutes(t.reward_minutes ? String(t.reward_minutes) : "");
    setChoreType(t.type);
    if (t.cadence === "daily" || t.cadence === "weekly" || t.cadence === "monthly") {
      setChoreCadence(t.cadence);
    }
    setChorePhoto(t.photo_required);
    setChoreRace(t.race ?? false);
    setChoreReminder(t.reminder_time ?? "");
    setChoreLimit(t.max_per_period ? String(t.max_per_period) : "");
    if (t.reminder_time || t.max_per_period) setShowAdvancedChore(true);
    setShowTemplates(false);
  }

  function confirmDeleteTemplate(t: ChoreTemplate) {
    Alert.alert("Delete template", `Delete the "${t.name}" template? Existing chores aren't affected.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void client
            .deleteTemplate(t.id)
            .then(() => setTemplates((prev) => prev.filter((x) => x.id !== t.id)))
            .catch((e) => setSnack(errorMessage(e))),
      },
    ]);
  }

  async function saveAsTemplate() {
    if (!choreName.trim()) return;
    const payError = validatePay({ pay_mode: chorePayMode, reward: Number(choreReward) || 0, reward_minutes: Number(choreMinutes) || 0 });
    if (payError) { setSnack(payError); return; }
    setSavingTemplate(true);
    try {
      const t = await client.createTemplate({
        household: user.household,
        name: choreName.trim(),
        description: choreNotes.trim(),
        timer_minutes: Number(timerMinutes),
        due_time: choreType === "recurring" ? choreDueTime.trim() : "",
        due_day: Number(choreDueDay),
        reward: Number(choreReward) || 0,
        pay_mode: chorePayMode,
        reward_minutes: Number(choreMinutes) || 0,
        type: choreType,
        cadence: choreType === "recurring" ? choreCadence : undefined,
        photo_required: chorePhoto,
        race: choreRace,
        reminder_time: choreReminder.trim() || undefined,
        max_per_period: parseLimit(choreLimit),
      });
      setTemplates((prev) => [...prev, t]);
      setSnack("Template saved 📋");
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setSavingTemplate(false);
    }
  }

  function startEditChore(chore: Chore) {
    setEditingChoreId(chore.id);
    setEditName(chore.name);
    setEditNotes(chore.description ?? "");
    setEditTimerMinutes(String(chore.timer_minutes ?? 0));
    setEditDueTime(chore.due_time ?? "");
    setEditDueDay(String(chore.due_day ?? 1));
    setEditReward(String(chore.reward));
    setEditPayMode(payMode(chore));
    setEditMinutes(chore.reward_minutes ? String(chore.reward_minutes) : "");
    setEditType(chore.type);
    setEditCadence((chore.cadence as "daily" | "weekly" | "monthly") ?? "weekly");
    setEditPhoto(chore.photo_required ?? false);
    setEditRace(chore.race ?? false);
    setEditReminder(chore.reminder_time ?? "");
    setEditDueAt(chore.due_at ? localDateKey(chore.due_at) : "");
    setEditLimit(chore.max_per_period ? String(chore.max_per_period) : "");
    setEditAdvanced(Boolean(chore.reminder_time || chore.due_at || chore.max_per_period));
  }

  async function saveChoreEdit(choreId: string) {
    if (!editName.trim()) return;
    const payError = validatePay({ pay_mode: editPayMode, reward: Number(editReward) || 0, reward_minutes: Number(editMinutes) || 0 });
    if (payError) { setSnack(payError); return; }
    setSavingEdit(true);
    try {
      await client.updateChore(choreId, {
        name: editName.trim(),
        description: editNotes.trim(),
        timer_minutes: Number(editTimerMinutes),
        due_time: editType === "recurring" ? editDueTime.trim() : "",
        due_day: Number(editDueDay),
        reward: Number(editReward) || 0,
        pay_mode: editPayMode,
        reward_minutes: Number(editMinutes) || 0,
        type: editType,
        cadence: editType === "recurring" ? editCadence : undefined,
        photo_required: editPhoto,
        race: editRace,
        reminder_time: editReminder.trim() || undefined,
        due_at: editDueAt.trim() ? localDateInstant(editDueAt.trim()) : "",
        max_per_period: parseLimit(editLimit),
      });
      setEditingChoreId(null);
      setSnack("Chore updated ✅");
      await reload();
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setSavingEdit(false);
    }
  }

  function confirmDeactivate(choreId: string, choreName: string) {
    Alert.alert("Archive chore", `Archive "${choreName}"? It won't be assignable.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: () => void act(() => client.deactivateChore(choreId), "Chore archived."),
      },
    ]);
  }

  async function restoreChore(chore: Chore) {
    try {
      await client.updateChore(chore.id, { active: true });
      await reload();
      setSnack(`Restored ${chore.name}.`);
    } catch (e) {
      setSnack(errorMessage(e));
    }
  }

  useEffect(() => {
    if (showCreateChore) {
      client.listTemplates(user.household).then(setTemplates).catch(() => {});
    }
  }, [showCreateChore, user.household]);

  useEffect(() => {
    if (tab === "settings") {
      client.listParents(user.household).then(setCoParents).catch(() => {});
    }
  }, [tab, user.household]);

  function toggleKidForChore(choreId: string, kidId: string) {
    setAssignSelections((prev) => {
      const cur = new Set(prev[choreId] ?? []);
      if (cur.has(kidId)) cur.delete(kidId);
      else cur.add(kidId);
      return { ...prev, [choreId]: cur };
    });
  }

  async function assignChore(choreId: string) {
    const selected = assignSelections[choreId];
    if (!selected || selected.size === 0) return;
    setAssigning((prev) => ({ ...prev, [choreId]: true }));
    try {
      const ids = [...selected].filter((id) => kids.some((k) => k.id === id) && !heldByChore[choreId]?.has(id));
      if (ids.length === 0) {
        setAssignSelections((prev) => ({ ...prev, [choreId]: new Set() }));
        return;
      }
      const over = await client.assignLimitWarnings(choreId, ids);
      if (over.length > 0) {
        const chore = chores.find((c) => c.id === choreId);
        const names = over.map((w) => `${kids.find((k) => k.id === w.childId)?.display_name ?? "A kid"} (${w.count} already)`).join(", ");
        const go = await new Promise<boolean>((resolve) =>
          Alert.alert(
            "Over the usual limit",
            `"${chore?.name ?? "This chore"}" is limited to ${chore ? limitLabel(chore) : "its limit"}. ${names}. Assign anyway?`,
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Assign anyway", onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
          ),
        );
        if (!go) return;
      }
      for (const kidId of ids) {
        await client.assignChore(choreId, kidId);
      }
      setAssignSelections((prev) => ({ ...prev, [choreId]: new Set() }));
      setSnack("Assigned ✅");
      await reload();
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setAssigning((prev) => ({ ...prev, [choreId]: false }));
    }
  }

  const waitingCount = waitingActionCount({ approvals, spend, proposals, screenGrants, bonusGrants });

  if (detailKid) {
    return (
      <KidDetail
        kidId={detailKid}
        household={household}
        onClose={() => {
          setDetailKid(null);
          void reload();
        }}
        onOpenLedger={(id) => {
          setLedgerKid(id);
          setDetailKid(null);
          setTab("ledger");
          void reload();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.Content
          title={<BrandTitle size={30} tagline />}
          subtitle={waitingCount > 0 ? `${waitingCount} item${waitingCount === 1 ? "" : "s"} waiting` : "All clear 🎉"}
        />
        <GritButton rows={kids} currency={currencyName} goodsRate={goodsRate} screenRate={screenRate(household)} total />
        <HeaderMenu userId={user.id} onLogout={onLogout} onSettings={() => setHhSettingsOpen(true)} overviewAction={<OverviewModalButton household={household} kids={kids} chores={chores} heldByChore={heldByChore} />} />
      </Appbar.Header>

      <OfflineBanner />

      {notificationSetupNeeded && onOpenNotificationSetup && (
        <Card style={[styles.broadcastCard, styles.bannerCard]}>
          <Card.Content style={styles.bannerContent}>
            <Text variant="titleSmall" style={styles.bannerTitle}>
              🔔 Notifications not set up
            </Text>
            <Text variant="bodySmall" style={styles.bannerBody}>
              Approvals, spend requests, and broadcasts won&apos;t reach this device until you
              subscribe the ntfy app to your topic.
            </Text>
            <Button
              mode="contained"
              compact
              icon="bell-ring-outline"
              onPress={onOpenNotificationSetup}
              style={styles.bannerBtn}
            >
              Set up notifications
            </Button>
          </Card.Content>
        </Card>
      )}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      >
        {/* Kids tab */}
        {tab === "kids" && kids.length > 0 && (
          <View style={styles.kidsRow}>
            {kids.map((kid) => (
              <Card
                key={kid.id}
                onPress={() => setDetailKid(kid.id)}
                style={[styles.kidChipWrap, { borderLeftColor: kidAccent(kid.color, theme.colors.primary) }]}
              >
                <View style={styles.kidChipRow}>
                  <Avatar user={kid} size={36} />
                  <View style={styles.flex1}>
                    <Text style={styles.kidName}>{kid.display_name}</Text>
                    <Text style={[styles.kidBalance, { color: theme.colors.primary }]}>
                      {kid.balance} {currencyName}
                      {effectiveGoodsRate(kid.goods_rate, goodsRate) > 0 ? `  ·  $${(kid.balance / effectiveGoodsRate(kid.goods_rate, goodsRate)).toFixed(2)}` : ""}
                    </Text>
                  </View>
                  <Text style={[styles.kidChevron, { color: theme.colors.onSurfaceVariant }]}>›</Text>
                </View>
              </Card>
            ))}
          </View>
        )}
        {tab === "kids" && kids.length > 0 && (
          <>
            <Card style={styles.broadcastCard}>
              <Card.Content style={styles.broadcastContent}>
                <TextInput
                  mode="outlined"
                  label="Message all kids"
                  placeholder="e.g. Dinner in 10 minutes!"
                  value={broadcastMsg}
                  onChangeText={setBroadcastMsg}
                  style={styles.broadcastInput}
                  dense
                />
                <Button
                  mode="contained-tonal"
                  onPress={broadcast}
                  disabled={broadcasting || !broadcastMsg.trim()}
                  icon="bullhorn"
                  style={styles.broadcastBtn}
                >
                  Send
                </Button>
              </Card.Content>
            </Card>
          </>
        )}
        {tab === "kids" && kids.length > 0 && <ActivityReport kids={kids} currencyName={currencyName} />}

        {tab === "ledger" && household && (
          <>
            <LedgerView household={household} initialKidId={ledgerKid} />
          </>
        )}
        {/* Settings tab: appearance + household */}
        {tab === "settings" && (
          <>
        <Card style={styles.broadcastCard}>
          <Card.Content>
            <Button mode="contained" icon="cog" onPress={() => setHhSettingsOpen(true)} style={{ marginBottom: 8 }}>
              Household settings
            </Button>
          </Card.Content>
        </Card>
        <Card style={styles.broadcastCard}>
          <Card.Content>
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              CO-PARENTS
            </Text>
            {coParents.filter((p) => p.id !== user.id).length === 0 ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
                No co-parents yet. Add one so another parent can log in.
              </Text>
            ) : (
              coParents
                .filter((p) => p.id !== user.id)
                .map((p) => (
                  <Text key={p.id} variant="bodyMedium" style={{ marginBottom: 4 }}>
                    {p.display_name} — {p.email}
                  </Text>
                ))
            )}
            {!showAddParent ? (
              <Button
                mode="text"
                icon="account-plus"
                compact
                onPress={() => setShowAddParent(true)}
              >
                Add co-parent
              </Button>
            ) : (
              <View style={{ gap: 8, marginTop: 4 }}>
                <TextInput
                  mode="outlined"
                  label="Email"
                  value={newParentEmail}
                  onChangeText={setNewParentEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  dense
                />
                <TextInput
                  mode="outlined"
                  label="Display name"
                  value={newParentName}
                  onChangeText={setNewParentName}
                  dense
                />
                <TextInput
                  mode="outlined"
                  label="Password"
                  value={newParentPass}
                  onChangeText={setNewParentPass}
                  secureTextEntry
                  dense
                />
                <View style={styles.rowBtns}>
                  <Button
                    onPress={() => {
                      setShowAddParent(false);
                      setNewParentEmail("");
                      setNewParentName("");
                      setNewParentPass("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={addCoParent}
                    loading={addingParent}
                    disabled={
                      addingParent ||
                      !newParentEmail.trim() ||
                      !newParentName.trim() ||
                      !newParentPass
                    }
                  >
                    Add
                  </Button>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
        <Card style={styles.broadcastCard}>
          <Card.Content>
            <AppearanceControls />
          </Card.Content>
        </Card>
          </>
        )}

        {/* Approvals tab: proposals + approvals + spend */}
        {tab === "approvals" && (
          <>
        {/* Pending approvals */}
        <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
          PENDING APPROVALS {approvals.length > 0 ? `(${approvals.length})` : ""}
        </Text>

        {approvals.length === 0 ? (
          <Text style={[styles.emptyNote, { color: theme.colors.onSurfaceVariant }]}>
            Nothing waiting to approve.
          </Text>
        ) : (
          <>
            {approvals.length > 1 && (
              <Button
                mode="contained"
                icon="check-all"
                style={styles.approveAllBtn}
                onPress={() => {
                  party();
                  void act(
                    () => Promise.all(approvals.map((a) => client.approveAssignment(a.id))).then(() => {}),
                    `Approved all ${approvals.length}! 🎉`
                  );
                }}
              >
                Approve all ({approvals.length})
              </Button>
            )}
            {approvals.map((a) => {
              const chore = a.expand?.chore;
              const child = a.expand?.child;
              return (
                <Card key={a.id} style={styles.approvalCard}>
                  <Card.Content>
                    <View style={styles.approvalRow}>
                      <View style={styles.approvalInfo}>
                        <Text variant="titleMedium" style={styles.choreName}>
                          {chore?.name ?? "Chore"}
                        </Text>
                        <ChoreNotes text={chore?.description} />
                        {!!a.timer_minutes && <Text variant="bodySmall">⏱ {a.timer_minutes} min · {a.timer_started_at ? `started ${householdDateTime(a.timer_started_at)}` : "not started"}</Text>}
                        {!!a.due_at && <Text variant="bodySmall">Due {householdDateTime(a.due_at)}</Text>}
                        <View style={styles.approvalMeta}>
                          {child && (
                            <Chip compact style={styles.kidChip}>
                              {child.avatar_emoji || "🧒"} {child.display_name}
                            </Chip>
                          )}
                          {chore && (
                            <Chip compact style={[styles.rewardChip, { backgroundColor: theme.colors.primaryContainer }]}>
                              +{payLabel(chore, currencyName)}
                            </Chip>
                          )}
                        </View>
                        {a.needs_help ? (
                          <Text variant="bodySmall" style={[styles.resubNote, { color: theme.colors.error }]}>
                            🆘 Kid asked for help
                          </Text>
                        ) : null}
                        {a.rejection_message ? (
                          <Text variant="bodySmall" style={[styles.resubNote, { color: theme.colors.onSurfaceVariant }]}>
                            ↩️ Resubmitted — you said: {a.rejection_message}
                          </Text>
                        ) : null}
                        {a.kid_response ? (
                          <Text variant="bodySmall" style={[styles.resubNote, { color: theme.colors.onSurfaceVariant }]}>
                            💬 {a.kid_response}
                          </Text>
                        ) : null}
                        {a.photo ? (
                          <TouchableOpacity onPress={() => setPhotoPreview(client.getPhotoUrl(a))}>
                            <Image
                              source={{ uri: client.getPhotoUrl(a) }}
                              style={styles.photoThumb}
                            />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.approvalActions}>
                      <View style={styles.approvalPrimaryActions}>
                        <ChunkyButton
                          label="Approve"
                          icon="check"
                          onPress={() => {
                            party();
                            void act(() => client.approveAssignment(a.id), "Approved! 🎉");
                          }}
                          style={styles.approveBtn}
                        />
                        <Button
                          mode="outlined"
                          icon="close"
                          onPress={() => confirmReject(a.id)}
                          style={styles.rejectBtn}
                          contentStyle={styles.actionBtnContent}
                          textColor={theme.colors.error}
                        >
                          Reject
                        </Button>
                      </View>
                      <ApprovalFeedback choreName={chore?.name ?? "Chore"}
                        rewardLabel={chore ? `${payLabel(chore, currencyName)}.${payMode(chore) !== "bucks" ? " Screen-time grants cannot be undone." : ""}` : "Full chore reward."}
                        onApprove={async (comment) => {
                          await client.approveAssignment(a.id, 100, comment);
                          party();
                          setSnack("Approved — feedback sent.");
                          await reload();
                        }}
                      />
                      {chore && <PartialCredit chore={chore} currency={currencyName} onApprove={async (percent) => {
                        await client.approveAssignment(a.id, percent);
                        await reload();
                      }} />}
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </>
        )}

        {/* Spend requests */}
        {spend.length > 0 && (
          <>
            <Divider style={styles.divider} />
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              SPEND REQUESTS ({spend.length})
            </Text>
            {spend.map((s) => {
              const child = s.expand?.child;
              return (
                <Card key={s.id} style={styles.approvalCard}>
                  <Card.Content>
                    <Text variant="titleMedium">{s.description}</Text>
                    <View style={styles.approvalMeta}>
                      {child && (
                        <Chip compact style={styles.kidChip}>
                          {child.avatar_emoji || "🧒"} {child.display_name}
                        </Chip>
                      )}
                      <Chip compact style={[styles.rewardChip, { backgroundColor: theme.colors.secondaryContainer }]}>
                        {s.amount} {currencyName}
                        {effectiveGoodsRate(child?.goods_rate, goodsRate) > 0 ? ` ≈ $${(s.amount / effectiveGoodsRate(child?.goods_rate, goodsRate)).toFixed(2)}` : ""}
                      </Chip>
                    </View>
                    <View style={styles.approvalActions}>
                      <Button
                        mode="contained"
                        icon="check"
                        disabled={(child?.balance ?? 0) < s.amount}
                        onPress={() =>
                          act(() => client.approveSpendRequest(s.id, user.id), "Spend approved!")
                        }
                        style={styles.approveBtn}
                        contentStyle={styles.actionBtnContent}
                      >
                        Approve
                      </Button>
                      <Button
                        mode="outlined"
                        icon="close"
                        onPress={() => { setReasonDraft(""); setReasonDialog({ kind: "deny", id: s.id }); }}
                        style={styles.rejectBtn}
                        contentStyle={styles.actionBtnContent}
                        textColor={theme.colors.error}
                      >
                        Deny
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </>
        )}
        {/* Chore ideas from kids */}
        {proposals.length > 0 && (
          <>
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              CHORE IDEAS ({proposals.length})
            </Text>
            {proposals.map((p) => {
              const kid = p.expand?.child;
              return (
                <Card key={p.id} style={styles.approvalCard}>
                  <Card.Content>
                    <Text variant="titleMedium">
                      💡 {p.name}
                      {p.description ? ` — ${p.description}` : ""}
                    </Text>
                    <View style={styles.approvalMeta}>
                      {kid && (
                        <Chip compact style={styles.kidChip}>
                          {kid.avatar_emoji || "🧒"} {kid.display_name}
                        </Chip>
                      )}
                      <Chip compact style={[styles.rewardChip, { backgroundColor: theme.colors.secondaryContainer }]}>
                        asks {p.reward_requested} {currencyName}
                      </Chip>
                    </View>
                    <View style={styles.approvalActions}>
                      <Button
                        mode="contained"
                        icon="check"
                        onPress={() => startProposalApprove(p)}
                        style={styles.approveBtn}
                        contentStyle={styles.actionBtnContent}
                      >
                        Approve
                      </Button>
                      <Button
                        mode="outlined"
                        icon="close"
                        onPress={() => { setReasonDraft(""); setReasonDialog({ kind: "decline", id: p.id }); }}
                        style={styles.rejectBtn}
                        contentStyle={styles.actionBtnContent}
                        textColor={theme.colors.error}
                      >
                        Decline
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </>
        )}

        <Text variant="labelLarge" style={styles.sectionLabel}>PENDING SCREEN-TIME GRANTS</Text>
        {screenGrants.length === 0 && bonusGrants.length === 0 && <Text style={styles.emptyNote}>Nothing waiting.</Text>}
        {(["manual", "queued"] as const).map((group) => {
          const matches = (status?: string) => status === group;
          const grants = [
            ...bonusGrants.filter((g) => matches(g.grant_status)).map((g) => ({ ...g, bonus: true })),
            ...screenGrants.filter((g) => matches(g.grant_status)).map((g) => ({ ...g, bonus: false })),
          ];
          if (!grants.length) return null;
          return <View key={group}>
            <Divider style={styles.divider} />
            <Text variant="labelLarge" style={styles.sectionLabel}>
              {group === "manual" ? "TIME GRANTS NEEDING ACTION" : "TIME GRANTS WAITING FOR DELIVERY"}
            </Text>
            {grants.map((grant) => <Card key={grant.id} style={[styles.approvalCard, styles.grantCard]}>
              <Card.Content>
                <Text variant="titleMedium">{grant.expand?.child?.display_name ?? "Child"} — {grant.description}</Text>
                <Text>{bankedTimeLabel(grant)}</Text>
                {!!grant.grant_error && <Text>{grant.grant_error}</Text>}
                {group === "manual" && <Button onPress={() =>
                  Alert.alert("Confirm manual grant", "Check Family Link first. Has this time been granted manually?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Confirm", onPress: () => void act(
                      () => grant.bonus ? client.confirmBonusGrant(grant.id) : client.confirmManualGrant(grant.id),
                      "Manual grant recorded.",
                    ) },
                  ])
                }>Mark granted manually</Button>}
              </Card.Content>
            </Card>)}
          </View>;
        })}
        {household && <PastScreenGrants householdId={household.id} reloadKey={approvedKey} />}
        {household && (
          <RecentlyApproved
            householdId={household.id}
            currencyName={currencyName}
            reloadKey={approvedKey}
            onChanged={() => void reload()}
            onMessage={setSnack}
          />
        )}
          </>
        )}

        {/* Chores tab */}
        {tab === "chores" && (
          <>
        <View style={styles.sectionHeader}>
          <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
            CHORES ({chores.length})
          </Text>
          <Button
            mode="contained-tonal"
            icon={showCreateChore ? "chevron-up" : "plus"}
            onPress={() => {
              if (showCreateChore) setProposalFill(null);
              setShowCreateChore(!showCreateChore);
            }}
          >
            {showCreateChore ? "Cancel" : "Add"}
          </Button>
        </View>
        <View style={{ marginBottom: 8, gap: 2 }}>
          <View style={styles.keyRow}>
            <Icon source="check-circle" size={16} color={OK_GREEN} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Already assigned</Text>
          </View>
          <View style={styles.keyRow}>
            <Icon source="alert-circle" size={16} color={WARN_YELLOW} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>At repeat limit (can still override)</Text>
          </View>
        </View>

        <StarterChores
          householdId={user.household}
          parentId={user.id}
          existingNames={knownChoreNames(chores)}
          onAdded={() => void reload()}
          onMessage={setSnack}
        />

          </>
        )}

        <ChoreCreateDialog
          visible={showCreateChore}
          title={proposalFill ? "Review chore idea" : "New chore"}
          actionLabel={proposalFill ? "Create and approve" : "Create chore"}
          busy={creatingChore}
          canCreate={!!choreName.trim()}
          error={choreCreateError}
          onCancel={() => { setShowCreateChore(false); setProposalFill(null); }}
          onCreate={() => void createChore()}
        >
          <View style={styles.createChoreContent}>
              {templates.length > 0 && (
                <>
                  <Button
                    mode="outlined"
                    compact
                    icon={showTemplates ? "chevron-up" : "clipboard-list-outline"}
                    onPress={() => setShowTemplates((v) => !v)}
                    style={{ borderRadius: 8, marginBottom: 4 }}
                  >
                    📋 Templates ({templates.length}) {showTemplates ? "▲" : "▼"}
                  </Button>
                  {showTemplates && templates.map((t) => (
                    <View key={t.id} style={styles.templateRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium" style={{ fontWeight: "600" }}>{t.name}</Text>
                        <MetaWrap
                          color="gray"
                          items={[payLabel(t, ""), t.type, t.cadence ?? "", t.photo_required ? "📷" : "", t.race ? "🏁" : ""]}
                        />
                      </View>
                      <Button
                        mode="text"
                        compact
                        icon="delete-outline"
                        onPress={() => confirmDeleteTemplate(t)}
                        textColor={theme.colors.error}
                        style={{ minWidth: 0 }}
                      >{""}</Button>
                      <Button
                        mode="contained-tonal"
                        compact
                        onPress={() => applyTemplate(t)}
                        style={{ borderRadius: 8 }}
                      >
                        Use
                      </Button>
                    </View>
                  ))}
                </>
              )}
              {proposalFill && (
                <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                  💡 From {proposalFill.expand?.child?.display_name ?? "a kid"}'s idea — save to approve it, or close to leave it pending.
                </Text>
              )}
              <TextInput
                mode="outlined"
                label="Chore name"
                value={choreName}
                onChangeText={setChoreName}
                dense
              />
              <TextInput mode="outlined" label="Instructions (optional, visible to kids)" value={choreNotes} onChangeText={setChoreNotes} multiline maxLength={1000} />
              <TextInput label="Timer minutes (0 = off, max 480)" value={timerMinutes} onChangeText={setTimerMinutes} keyboardType="number-pad" />
              {choreType === "recurring" && <RecurringDueFields cadence={choreCadence} time={choreDueTime} day={choreDueDay} onTime={setChoreDueTime} onDay={setChoreDueDay} />}
              <PayModeFields
                mode={chorePayMode}
                reward={choreReward}
                minutes={choreMinutes}
                onMode={setChorePayMode}
                onReward={setChoreReward}
                onMinutes={setChoreMinutes}
                currencyName={currencyName}
              />
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>Type</Text>
              <SegmentedButtons
                value={choreType}
                onValueChange={(v) => setChoreType(v as "oneoff" | "recurring")}
                buttons={[
                  { value: "oneoff", label: "One-off" },
                  { value: "recurring", label: "Recurring" },
                ]}
                style={styles.segmented}
              />
              {choreType === "recurring" && (
                <>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>Cadence</Text>
                  <SegmentedButtons
                    value={choreCadence}
                    onValueChange={(v) => setChoreCadence(v as "daily" | "weekly" | "monthly")}
                    buttons={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                    ]}
                    style={styles.segmented}
                  />
                </>
              )}
              <View style={styles.switchRow}>
                <Text>📷 Photo required</Text>
                <Switch value={chorePhoto} onValueChange={setChorePhoto} />
              </View>
              <View style={styles.switchRow}>
                <Text>🏁 Race (first to finish wins)</Text>
                <Switch value={choreRace} onValueChange={setChoreRace} />
              </View>
              <Button
                mode="text"
                compact
                icon={showAdvancedChore ? "chevron-up" : "chevron-down"}
                onPress={() => setShowAdvancedChore((v) => !v)}
                style={{ alignSelf: "flex-start" }}
              >
                Advanced (reminder, limit, due date)
              </Button>
              {showAdvancedChore && (
                <>
              <TimeField label="Reminder time (optional)" value={choreReminder} onChange={setChoreReminder} />
              <TextInput
                mode="outlined"
                label={`Max per ${limitUnit({ type: choreType, cadence: choreCadence })} (optional)`}
                value={choreLimit}
                onChangeText={setChoreLimit}
                keyboardType="number-pad"
                placeholder="no limit"
                dense
                style={{ marginTop: 4 }}
              />
              <TextInput
                mode="outlined"
                label="Due date (optional)"
                value={choreDueAt}
                onChangeText={setChoreDueAt}
                keyboardType="numbers-and-punctuation"
                placeholder="YYYY-MM-DD"
                dense
                style={{ marginTop: 4 }}
              />
                </>
              )}
              <Button
                mode="outlined"
                onPress={saveAsTemplate}
                disabled={savingTemplate || !choreName.trim()}
                style={{ borderRadius: 12 }}
                icon="content-save-outline"
              >
                {savingTemplate ? "Saving…" : "Save as template"}
              </Button>
          </View>
        </ChoreCreateDialog>

        {tab === "chores" && (
          <>
        {chores.length === 0 && !showCreateChore && (
          <Text style={[styles.emptyNote, { color: theme.colors.onSurfaceVariant }]}>
            No active chores. Tap Add to create one.
          </Text>
        )}

        {chores.map((chore) => {
          const sel = assignSelections[chore.id] ?? new Set<string>();
          const held = heldByChore[chore.id] ?? new Set<string>();
          const atLimit = kidsAtLimit(chore, recentRows);
          const picks = [...sel].filter((id) => !held.has(id)).length;
          const busy = assigning[chore.id] ?? false;
          const isEditing = editingChoreId === chore.id;
          return (
            <SwipeActionsRow key={chore.id} disabled={isEditing || busy || savingEdit}
              onArchive={() => confirmDeactivate(chore.id, chore.name)} onEdit={() => startEditChore(chore)}>
            <Card style={styles.approvalCard}>
              <Card.Content>
                {isEditing ? (
                  <View style={styles.createChoreContent}>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Editing: {chore.name}</Text>
                    <View style={[styles.approvalActions, { marginTop: 8 }]}>
                      <Button mode="contained" icon="check" onPress={() => void saveChoreEdit(chore.id)} disabled={savingEdit || !editName.trim()} style={[styles.approveBtn, { borderRadius: 12 }]}>
                        {savingEdit ? "Saving…" : "Save"}
                      </Button>
                      <Button mode="outlined" onPress={() => setEditingChoreId(null)} style={[styles.rejectBtn, { borderRadius: 12 }]}>
                        Cancel
                      </Button>
                    </View>
                    <TextInput mode="outlined" label="Chore name" value={editName} onChangeText={setEditName} dense />
                    <TextInput mode="outlined" label="Instructions (optional, visible to kids)" value={editNotes} onChangeText={setEditNotes} multiline maxLength={1000} />
                    <TextInput label="Timer minutes (0 = off, max 480)" value={editTimerMinutes} onChangeText={setEditTimerMinutes} keyboardType="number-pad" />
                    {editType === "recurring" && <RecurringDueFields cadence={editCadence} time={editDueTime} day={editDueDay} onTime={setEditDueTime} onDay={setEditDueDay} />}
                    <PayModeFields
                      mode={editPayMode}
                      reward={editReward}
                      minutes={editMinutes}
                      onMode={setEditPayMode}
                      onReward={setEditReward}
                      onMinutes={setEditMinutes}
                      currencyName={currencyName}
                    />
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>Type</Text>
                    <SegmentedButtons
                      value={editType}
                      onValueChange={(v) => setEditType(v as "oneoff" | "recurring")}
                      buttons={[{ value: "oneoff", label: "One-off" }, { value: "recurring", label: "Recurring" }]}
                      style={styles.segmented}
                    />
                    {editType === "recurring" && (
                      <>
                        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>Cadence</Text>
                        <SegmentedButtons
                          value={editCadence}
                          onValueChange={(v) => setEditCadence(v as "daily" | "weekly" | "monthly")}
                          buttons={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]}
                          style={styles.segmented}
                        />
                      </>
                    )}
                    <View style={styles.switchRow}>
                      <Text>📷 Photo required</Text>
                      <Switch value={editPhoto} onValueChange={setEditPhoto} />
                    </View>
                    <View style={styles.switchRow}>
                      <Text>🏁 Race (first to finish wins)</Text>
                      <Switch value={editRace} onValueChange={setEditRace} />
                    </View>
                    <Button mode="text" compact icon={editAdvanced ? "chevron-up" : "chevron-down"} onPress={() => setEditAdvanced((v) => !v)} style={{ alignSelf: "flex-start" }}>
                      Advanced (reminder, limit, due date)
                    </Button>
                    {editAdvanced && (
                      <>
                      <TimeField label="Reminder time (optional)" value={editReminder} onChange={setEditReminder} />
                      <TextInput mode="outlined" label={`Max per ${limitUnit({ type: editType, cadence: editCadence })} (optional)`} value={editLimit} onChangeText={setEditLimit} keyboardType="number-pad" placeholder="no limit" dense style={{ marginTop: 4 }} />
                      <TextInput mode="outlined" label="Due date (optional)" value={editDueAt} onChangeText={setEditDueAt} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" dense style={{ marginTop: 4 }} />
                      </>
                    )}

                  </View>
                ) : (
                  <>
                    <View style={styles.choreRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.choreTitle}>
                          <Text variant="titleSmall" style={{ fontWeight: "700" }}>{chore.name}</Text>
                          {(chore.race || chore.photo_required || chore.reminder_time) && (
                            <Text variant="bodySmall">
                              {chore.race ? "🏁 " : ""}{chore.photo_required ? "📷 " : ""}{chore.reminder_time ? `⏰ ${chore.reminder_time}` : ""}
                            </Text>
                          )}
                        </View>
                        <MetaWrap
                          color={theme.colors.onSurfaceVariant}
                          items={[
                            payLabel(chore, currencyName),
                            chore.cadence ? `${chore.type} (${chore.cadence})` : chore.type,
                            limitLabel(chore) ? `max ${limitLabel(chore)}` : "",
                            chore.due_at ? `📅 ${localDateKey(chore.due_at)}` : "",
                          ]}
                        />
                      </View>
                      <Button mode="text" compact accessibilityLabel={`Edit ${chore.name}`} onPress={() => startEditChore(chore)} icon="pencil" style={{ minWidth: 0 }}>{""}</Button>
                    </View>
                    <View style={styles.assignRow}>
                      {kids.length > 0 && (
                      <>
                        {kids.map((kid) => (
                          <Chip
                            key={kid.id}
                            selected={held.has(kid.id) || sel.has(kid.id)}
                            disabled={held.has(kid.id)}
                            onPress={() => toggleKidForChore(chore.id, kid.id)}
                            compact
                            icon={
                              held.has(kid.id)
                                ? ({ size }: { size: number }) => <Icon source="check-circle" size={size} color={OK_GREEN} />
                                : atLimit.has(kid.id)
                                  ? ({ size }: { size: number }) => <Icon source="alert-circle" size={size} color={WARN_YELLOW} />
                                  : undefined
                            }
                            style={styles.kidAssignChip}
                          >
                            {kid.display_name}
                          </Chip>
                        ))}
                        <Button
                          mode="contained-tonal"
                          onPress={() => void assignChore(chore.id)}
                          disabled={busy || picks === 0}
                          compact
                          style={styles.assignBtn}
                        >
                          Assign
                        </Button>
                      </>
                      )}
                      <Button mode="text" compact accessibilityLabel={`Archive ${chore.name}`} onPress={() => confirmDeactivate(chore.id, chore.name)} icon="archive-outline" textColor={theme.colors.error} style={{ minWidth: 0, marginLeft: "auto" }}>{""}</Button>
                    </View>
                  </>
                )}
              </Card.Content>
            </Card>
            </SwipeActionsRow>
          );
        })}
        {archivedChores.length > 0 && (
          <View style={{ gap: 8, marginTop: 16 }}>
            <Divider />
            <Button mode="outlined" icon={showArchivedChores ? "chevron-up" : "chevron-down"}
              accessibilityLabel={`Archived chores, ${archivedChores.length}`}
              onPress={() => setShowArchivedChores((open) => !open)}>
              Archived chores ({archivedChores.length})
            </Button>
            {showArchivedChores && archivedChores.map((chore) => (
              <Card key={chore.id} mode="outlined">
                <Card.Content style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <Text variant="titleSmall" style={{ flex: 1 }}>{chore.name}</Text>
                  <Button mode="text" accessibilityLabel={`Restore ${chore.name}`}
                    onPress={() => void restoreChore(chore)}>Restore</Button>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}
          </>
        )}

      </ScrollView>

      <BottomNavigation.Bar
        navigationState={{
          index: Math.max(0, PARENT_TABS.findIndex((t) => t.key === tab)),
          routes: PARENT_TABS.map((t) =>
            t.key === "approvals" && waitingCount > 0 ? { ...t, badge: waitingCount } : t,
          ),
        }}
        onTabPress={({ route }) => setTab(route.key)}
      />

            <Modal visible={photoPreview !== null} transparent onRequestClose={() => setPhotoPreview(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" }} onPress={() => setPhotoPreview(null)} activeOpacity={1}>
          {photoPreview ? (
            <Image source={{ uri: photoPreview }} style={{ width: "90%", height: "80%", resizeMode: "contain" }} />
          ) : null}
        </TouchableOpacity>
      </Modal>
{household && hhSettingsOpen && (
        <HouseholdSettings
          household={household}
          visible={hhSettingsOpen}
          onDismiss={() => setHhSettingsOpen(false)}
          onSaved={() => void reload()}
        />
      )}
<Snackbar visible={!!snack} onDismiss={() => setSnack("")} duration={4000}>
        {snack}
      </Snackbar>

      <Celebration trigger={celebrate} />
      <Portal>
        <Dialog visible={rejectingAssignmentId !== null} onDismiss={() => setRejectingAssignmentId(null)}>
          <Dialog.Title>Send chore back</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Tell them what to fix. They will see this message.</Text>
            <TextInput
              mode="outlined"
              label="What needs redone?"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              maxLength={1000}
              autoFocus
              style={styles.rejectionInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRejectingAssignmentId(null)}>Cancel</Button>
            <Button mode="contained" onPress={rejectWithReason}>Send back</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={reasonDialog !== null} onDismiss={() => setReasonDialog(null)}>
          <Dialog.Title>{reasonDialog?.kind === "decline" ? "Decline chore idea" : "Deny screen-time request"}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Tell them why. They will see this message.</Text>
            <TextInput
              mode="outlined"
              label="Reason (optional)"
              value={reasonDraft}
              onChangeText={setReasonDraft}
              multiline
              maxLength={1000}
              autoFocus
              style={styles.rejectionInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setReasonDialog(null)}>Cancel</Button>
            <Button mode="contained" onPress={submitReasonDialog}>{reasonDialog?.kind === "decline" ? "Decline" : "Deny"}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },

  kidsRow: { gap: 8 },
  kidChipWrap: { borderRadius: 16, borderLeftWidth: 5 },
  kidChipRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  flex1: { flex: 1 },
  kidChevron: { fontSize: 40, lineHeight: 40, opacity: 0.6, marginLeft: "auto" },
  kidName: { fontSize: 14, fontWeight: "700" },
  kidBalance: { fontSize: 13, fontWeight: "600" },

  broadcastCard: { borderRadius: 16 },
  bannerCard: { borderWidth: 1, borderColor: "#F59E0B" },
  bannerContent: { gap: 8 },
  bannerTitle: { fontWeight: "700" },
  bannerBody: { opacity: 0.8 },
  bannerBtn: { alignSelf: "flex-start", borderRadius: 10 },
  broadcastContent: { gap: 8 },
  rowBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  broadcastInput: { flex: 1 },
  broadcastBtn: { borderRadius: 12, alignSelf: "flex-end" },

  sectionLabel: { marginTop: 6, letterSpacing: 1, fontSize: 11 },
  emptyNote: { fontSize: 14, opacity: 0.7 },

  approveAllBtn: { borderRadius: 12, marginBottom: 4 },

  approvalCard: { borderRadius: 16 },
  grantCard: { marginBottom: 8 },
  approvalRow: { flexDirection: "row", justifyContent: "space-between" },
  approvalInfo: { flex: 1 },
  choreName: { fontWeight: "700", marginBottom: 6 },
  approvalMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  kidChip: {},
  rewardChip: {},
  resubNote: { marginTop: 4, fontStyle: "italic" },
  photoThumb: { width: 100, height: 100, borderRadius: 8, marginTop: 8 },
  approvalActions: { gap: 8, marginTop: 10 },
  approvalPrimaryActions: { flexDirection: "row", gap: 8 },
  approveBtn: { flex: 1, borderRadius: 12 },
  rejectBtn: { flex: 1, borderRadius: 12 },
  actionBtnContent: { paddingVertical: 4 },
  rejectionInput: { marginTop: 12 },

  divider: { marginVertical: 8 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  createChoreContent: { gap: 6 },
  rewardInput: { width: 120 },
  segmented: { marginTop: 2 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  templateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4, gap: 8 },
  choreTitle: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 8 },
  choreRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  keyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  assignRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" },
  kidAssignChip: {},
  assignBtn: { borderRadius: 12 },
});
