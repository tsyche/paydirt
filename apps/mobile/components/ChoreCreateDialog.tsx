import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { Button, Dialog, HelperText, Portal } from "react-native-paper";

export function ChoreCreateDialog({ visible, title, actionLabel, busy, canCreate, error, onCancel, onCreate, children }: {
  visible: boolean; title: string; actionLabel: string; busy: boolean; canCreate: boolean; error: string;
  onCancel: () => void; onCreate: () => void; children: ReactNode;
}) {
  if (!visible) return null;
  return <Portal>
    <Dialog visible onDismiss={() => { if (!busy) onCancel(); }} style={{ maxHeight: "90%" }}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Actions>
        <Button disabled={busy} onPress={onCancel}>Cancel</Button>
        <Button mode="contained" loading={busy} disabled={busy || !canCreate} onPress={onCreate}>{actionLabel}</Button>
      </Dialog.Actions>
      <HelperText type="error" visible={!!error} accessibilityLiveRegion="polite">{error}</HelperText>
      <Dialog.ScrollArea style={{ paddingHorizontal: 12 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>{children}</ScrollView>
      </Dialog.ScrollArea>
    </Dialog>
  </Portal>;
}
