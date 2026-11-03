import { useState } from "react";
import { Alert } from "react-native";
import { Button, Dialog, Portal, Text, TextInput } from "react-native-paper";
import { partialPay, type Chore } from "@paydirt/shared";

export function PartialCredit({ chore, currency, onApprove }: {
  chore: Chore; currency: string; onApprove: (percent: number) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState("50");
  const [busy, setBusy] = useState(false);
  const value = Number(percent);
  const pay = partialPay(chore, value);
  const valid = Number.isInteger(value) && value > 0 && value < 100 && (pay.bucks > 0 || pay.minutes > 0);
  return <>
    <Button onPress={() => setOpen(true)}>Partial credit</Button>
    <Portal><Dialog visible={open} onDismiss={() => { if (!busy) setOpen(false); }}>
      <Dialog.Title>Partial credit</Dialog.Title>
      <Dialog.Content>
        {[25, 50, 75].map((n) => <Button key={n} onPress={() => setPercent(String(n))}>{n}%</Button>)}
        <TextInput label="Credit percent (1–99)" keyboardType="number-pad" value={percent} onChangeText={setPercent} />
        <Text>{pay.bucks} {currency} + {pay.minutes} min. This closes the chore; the remainder is not owed. Time grants cannot be undone.</Text>
      </Dialog.Content>
      <Dialog.Actions>
        <Button disabled={busy} onPress={() => setOpen(false)}>Cancel</Button>
        <Button disabled={busy || !valid} onPress={async () => {
          setBusy(true);
          try { await onApprove(value); setOpen(false); }
          catch { Alert.alert("Partial credit failed", "Refresh and try again."); }
          finally { setBusy(false); }
        }}>Approve {value}%</Button>
      </Dialog.Actions>
    </Dialog></Portal>
  </>;
}
