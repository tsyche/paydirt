import { useState } from "react";
import { Appbar, Portal, Dialog, Button } from "react-native-paper";
import { AppearanceControls } from "./AppearanceControls";

/**
 * Appbar action that opens the live appearance switcher (palette + light/dark).
 * Drop into any `<Appbar.Header>`; safe to reuse across screens.
 */
export function AppearanceButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Appbar.Action
        icon="palette-outline"
        onPress={() => setOpen(true)}
        accessibilityLabel="Theme and colors"
      />
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>Theme</Dialog.Title>
          <Dialog.Content>
            <AppearanceControls />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
