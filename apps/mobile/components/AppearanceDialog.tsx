import { Portal, Dialog, Button } from "react-native-paper";
import { AppearanceControls } from "./AppearanceControls";

/** Live appearance switcher dialog (palette + light/dark); opened from the header menu. */
export function AppearanceDialog({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Theme</Dialog.Title>
        <Dialog.Content>
          <AppearanceControls />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Done</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
