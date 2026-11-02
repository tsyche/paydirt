import { useState } from "react";
import { useWindowDimensions } from "react-native";
import { Appbar, Button, Chip, Dialog, Portal, Text } from "react-native-paper";

export interface GritRow {
  name: string;
  balance: number;
}

/**
 * Header balance: a compact chip (icon + number), collapsing to an icon on narrow
 * phones. Tap opens a dialog with the rows (`total` adds a sum for parents).
 * Rows without a numeric balance are dropped, so hidden sibling balances never show.
 */
export function GritButton({
  rows,
  currency,
  total = false,
}: {
  rows: GritRow[];
  currency: string;
  total?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const shown = rows.filter((r) => typeof r.balance === "number");
  const sum = shown.reduce((n, r) => n + r.balance, 0);
  const label = `${total ? sum : (shown[0]?.balance ?? 0)} ${currency}`;
  return (
    <>
      {width < 400 ? (
        <Appbar.Action icon="cash" accessibilityLabel={label} onPress={() => setOpen(true)} />
      ) : (
        <Chip compact icon="cash" onPress={() => setOpen(true)} accessibilityLabel={label} testID="grit-chip">
          {total ? sum : (shown[0]?.balance ?? 0)}
        </Chip>
      )}
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>{currency}</Dialog.Title>
          <Dialog.Content style={{ gap: 6 }}>
            {shown.map((r) => (
              <Text key={r.name} variant="bodyLarge">{r.name}: {r.balance}</Text>
            ))}
            {total && shown.length > 1 ? (
              <Text variant="bodyLarge" style={{ fontWeight: "700" }}>Total: {sum}</Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
