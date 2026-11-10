import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button, Switch, Text } from "react-native-paper";
import { canCancelTimeGrant, errorMessage, householdDateTime, timeBankEventLabel, timeBankTotals } from "@paydirt/shared";
import { client } from "../lib/client";
import { useRealtimeResume } from "../lib/useRealtimeResume";

type Bank = Awaited<ReturnType<typeof client.getTimeBank>>;
type Pending = { minutes: number; key: string; allowQueue: boolean };

/** Same accounting and history in both kid layouts and parent summary/detail. */
export function EarnedTimeBank({ childId, kidControl = false, detail = true }: {
  childId: string; kidControl?: boolean; detail?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(5);
  const [bank, setBank] = useState<Bank | null>(null);
  const [minutes, setMinutes] = useState(15);
  const [allowQueue, setAllowQueue] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(!kidControl);
  const running = useRef(false);
  const storageKey = `paydirt-time-redemption:${childId}`;
  const reload = useCallback(async () => {
    try { setBank(await client.getTimeBank(childId)); } catch (e) { setError(errorMessage(e)); }
  }, [childId]);
  // The enclosing screen rebuilds SSE; this independent detail catches up too.
  useRealtimeResume(reload, false);
  useEffect(() => {
    void reload();
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void client.subscribeToKidUpdates(childId, () => { void reload(); }).then((stop) => {
      if (active) unsubscribe = stop; else stop();
    }).catch((e) => setError(errorMessage(e)));
    return () => { active = false; unsubscribe?.(); };
  }, [childId, reload]);
  useEffect(() => {
    if (!kidControl) return;
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (raw) setPending(JSON.parse(raw) as Pending);
      setReady(true);
    }).catch((e) => setError(errorMessage(e)));
  }, [kidControl, storageKey]);
  async function redeem() {
    if (running.current || !ready) return;
    running.current = true; setBusy(true); setError(""); setNotice("");
    const request = pending || { minutes: selected, key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, allowQueue };
    try {
      // Persist before sending: a lost response or app restart retries the same debit.
      await AsyncStorage.setItem(storageKey, JSON.stringify(request));
      setPending(request);
      await client.redeemSavedTime(request.minutes, request.key, request.allowQueue || allowQueue);
      await AsyncStorage.removeItem(storageKey);
      setPending(null);
      setNotice(`${request.minutes} minutes requested. Your remaining saved time stays in your bank.`);
      await reload();
    } catch (e) {
      // A validation/auth rejection happens before the transaction commits.
      // Keep uncertain network results, but let a rejected request be corrected.
      if ([400, 401, 403].includes((e as { status?: number }).status || 0)) {
        await AsyncStorage.removeItem(storageKey);
        setPending(null);
      }
      setError(errorMessage(e));
    }
    finally { running.current = false; setBusy(false); }
  }
  const totals = bank ? timeBankTotals(bank.ledger, bank.grants, bank.purchases) : null;
  const maximum = Math.min(60, Math.floor((totals?.available || 0) / 15) * 15);
  const selected = pending?.minutes ?? Math.min(minutes, maximum || 15);
  const summary = totals ? `Banked time: ${totals.available} min` : error ? "Banked time unavailable" : "Loading banked time…";
  if (!kidControl && !detail) return <Text>{summary}</Text>;
  return <View style={{ gap: 10 }}>
    {!kidControl && <Button accessibilityLabel={expanded ? "Hide bank details" : "Show bank details"} icon={expanded ? "chevron-up" : "chevron-down"} onPress={() => setExpanded(!expanded)}>{summary}</Button>}
    {(kidControl || expanded) && <>
    <Text variant="titleMedium" accessibilityRole="header">Saved earned time</Text>
    {totals && !kidControl ? <View style={{ gap: 4 }} accessibilityLabel="Earned time totals">
      <Text>{totals.available} min saved</Text>
      <Text>{totals.reserved} min reserved for review</Text>
      <Text>{totals.requested} min requested</Text>
      <Text>{totals.queued} min queued</Text>
    </View> : !kidControl ? <Text>Loading saved time…</Text> : null}
    {kidControl && <>
      <Text variant="headlineSmall">{totals ? `${totals.available} min saved` : "Loading saved time…"}</Text>
      <Text>Choose how much to use. The rest stays saved.</Text>
      <Text>15-minute steps · Up to 1 hour at a time · No Grit charge</Text>
      <Text variant="titleSmall">Time to use</Text>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Button accessibilityLabel="Use 15 fewer minutes" disabled={busy || !!pending || selected <= 15} onPress={() => setMinutes(selected - 15)}>−15</Button>
        <Text>{selected} min</Text>
        <Button accessibilityLabel="Use 15 more minutes" disabled={busy || !!pending || selected + 15 > maximum} onPress={() => setMinutes(selected + 15)}>+15</Button>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Switch accessibilityLabel="Queue for next allowed window" value={allowQueue} onValueChange={setAllowQueue} disabled={busy} />
        <Text style={{ flex: 1 }}>Queue for the next allowed window if outside allowed hours</Text>
      </View>
      <Button mode="contained" loading={busy} disabled={busy || !ready || (!pending && selected > maximum)} onPress={() => { void redeem(); }}>
        {pending ? `Retry Use ${selected} minutes` : `Use ${selected} minutes`}
      </Button>
      {!!notice && <Text accessibilityRole="alert">{notice}</Text>}
      {totals && totals.available < 15 && <Text>Save at least 15 minutes to use time.</Text>}
      {pending && <Text>A request is saved on this device. Retry to confirm its result before starting another.</Text>}
      {bank?.grants.filter(canCancelTimeGrant).map((grant) => <Button key={grant.id} disabled={busy} onPress={async () => {
        setBusy(true);
        try { await client.cancelSavedTime(grant.redemption!); await reload(); }
        catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
      }}>Return {grant.minutes} undelivered minutes to savings</Button>)}
    </>}
    {kidControl && detail && <Button onPress={() => setExpanded(!expanded)}>{expanded ? "Hide time details" : "Show time details"}</Button>}
    {kidControl && expanded && totals && <View style={{ gap: 4 }}>
      <Text>{totals.reserved} min reserved for review</Text>
      <Text>{totals.requested} min requested</Text>
      <Text>{totals.queued} min queued</Text>
    </View>}
    {!!error && <Text accessibilityRole="alert">{error}</Text>}
    {detail && (!kidControl || expanded) && bank && bank.ledger.length > 0 && <>
      <Text variant="titleSmall">Earned-time history</Text>
      {bank.ledger.slice(0, historyLimit).map((row) => <Text key={row.id}>{householdDateTime(row.created)} · {timeBankEventLabel(row.kind)} · {row.minutes} min</Text>)}
      {bank.ledger.length > historyLimit && <Button onPress={() => setHistoryLimit(historyLimit + 10)}>Show more earned-time history</Button>}
    </>}
    </>}
  </View>;
}
