import { useEffect, useState } from "react";
import { Button, ProgressBar, Text } from "react-native-paper";
import { View } from "react-native";
import type { Assignment } from "@paydirt/shared";
import { client } from "../lib/client";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export function ChoreTimer({ assignment, onStarted, onComplete }: { assignment: Assignment; onStarted: () => Promise<void>; onComplete: () => void }) {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!assignment.timer_started_at || !assignment.timer_minutes) return;
    const end = new Date(assignment.timer_started_at.replace(" ", "T")).getTime() + assignment.timer_minutes * 60000;
    if (end <= Date.now()) return;
    const identifier = `chore-timer-${assignment.id}`;
    void Notifications.scheduleNotificationAsync({
      identifier,
      content: { title: "Chore timer finished! ⏱", body: "You can mark your timed chore done.", data: { assignment: assignment.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(end), ...(Platform.OS === "android" ? { channelId: "paydirt-alerts" } : {}) },
    }).catch(() => {});
  }, [assignment.id, assignment.timer_started_at, assignment.timer_minutes]);
  const duration = (assignment.timer_minutes ?? 0) * 60000;
  if (!duration) return null;
  const start = assignment.timer_started_at ? new Date(assignment.timer_started_at.replace(" ", "T")).getTime() : null;
  const remaining = start === null ? duration : Math.max(0, start + duration - now);
  const seconds = Math.ceil(remaining / 1000);
  return <View style={{ gap: 8 }}>
    <Text accessibilityLiveRegion="polite">{start === null ? `${assignment.timer_minutes} minute chore` : remaining ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} left` : "Timer finished! You can mark it done."}</Text>
    <ProgressBar progress={start === null ? 0 : Math.min(1, Math.max(0, 1 - remaining / duration))} />
    {start === null && <Button disabled={busy} mode="contained-tonal" onPress={async () => {
      setBusy(true); setError("");
      try { await client.startChoreTimer(assignment.id); await onStarted(); }
      catch { setError("Could not start the timer. Refresh and try again."); }
      finally { setBusy(false); }
    }}>Start timer</Button>}
    {!!error && <Text>{error}</Text>}
    <Button mode="contained" disabled={start === null || remaining > 0 || busy} onPress={onComplete}>I did it!</Button>
  </View>;
}
