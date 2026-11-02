import { useState } from "react";
import { useWindowDimensions } from "react-native";
import { Appbar, Button, Chip, Dialog, Portal, Text } from "react-native-paper";
import { bankSummary } from "@paydirt/shared";

export interface GritRow {
  id: string;
  display_name: string;
  balance: number;
  goods_rate?: number | null;
}

const usd = (n: number | null) => (n === null ? "" : ` · $${n.toFixed(2)}`);

/**
 * Header balance: a compact chip (icon + number), collapsing to an icon on narrow
 * phones. Tap opens a dialog with grit, dollars and screen minutes per kid and, for
 * parents (`total`), combined. Rows without a numeric balance are dropped, so hidden
 * sibling balances never show.
 */
export function GritButton({
  rows,
  currency,
  goodsRate,
  screenRate,
  total = false,
}: {
  rows: GritRow[];
  currency: string;
  goodsRate: number;
  screenRate: number;
  total?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const bank = bankSummary(rows.filter((r) => typeof r.balance === "number"), goodsRate, screenRate);
  const shown = total ? bank.total.balance : (bank.rows[0]?.balance ?? 0);
  const label = `${shown} ${currency}`;
  const line = (n: number, dollars: number | null, minutes: number) =>
    `${n} ${currency}${usd(dollars)} · ≈${minutes} min`;
  return (
    <>
      {width < 400 ? (
        <Appbar.Action icon="cash" accessibilityLabel={label} onPress={() => setOpen(true)} />
      ) : (
        <Chip compact icon="cash" onPress={() => setOpen(true)} accessibilityLabel={label} testID="grit-chip">
          {shown}
        </Chip>
      )}
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>{currency}</Dialog.Title>
          <Dialog.Content style={{ gap: 6 }}>
            {bank.rows.map((r) => (
              <Text key={r.id} variant="bodyLarge">{r.name}: {line(r.balance, r.dollars, r.screenMinutes)}</Text>
            ))}
            {total && bank.rows.length > 1 ? (
              <Text variant="bodyLarge" style={{ fontWeight: "700" }}>
                Total: {line(bank.total.balance, bank.total.dollars, bank.total.screenMinutes)}
              </Text>
            ) : null}
            <Text variant="bodySmall">Screen time is what it could buy; a request still needs approval.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
