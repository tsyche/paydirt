import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { errorMessage } from "@paydirt/shared";
import { client } from "../lib/client";

type Preview = Awaited<ReturnType<typeof client.previewExpiry>>;

export function ExpiryPreview({ householdId, days, currency, paused, onReady }: {
  householdId: string; days: number; currency: string; paused: boolean; onReady: (days: number | null) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    onReady(null); setError("");
    const timer = setTimeout(() => {
      void client.previewExpiry(householdId, days).then((value) => {
        if (live) { setPreview(value); onReady(days); }
      }).catch((e) => { if (live) setError(errorMessage(e)); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [householdId, days, onReady]);
  return <View accessibilityLabel="Reward expiry preview" accessibilityLiveRegion="polite" style={{ gap: 6 }}>
    {error ? <Text>Expiry preview unavailable: {error}. Change the days to retry.</Text>
      : preview?.days !== days ? <Text>Checking expiry…</Text>
      : <><Text>Expiry preview — {days === 0 ? "expiry is off" : "unspent earnings that would expire today"}:</Text>
        {preview.children.map((kid) => <Text key={kid.id}>{kid.display_name}: {kid.lapse} {currency} would expire today</Text>)}
        <Text>Estimate from the current ledger; saving does not deduct rewards. {paused ? "No rewards expire while the household is paused." : "Scheduled expiry uses the balance at the time it runs."}</Text></>}
  </View>;
}
