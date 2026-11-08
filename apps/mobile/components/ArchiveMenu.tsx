import { useState } from "react";
import { IconButton, Menu } from "react-native-paper";

/** Keeps archive available to touch, keyboard, and screen-reader users. */
export function ArchiveMenu({ label, disabled, onArchive }: { label: string; disabled: boolean; onArchive: () => void }) {
  const [open, setOpen] = useState(false);
  return <Menu visible={open} onDismiss={() => setOpen(false)} anchorPosition="bottom"
    anchor={<IconButton icon="dots-vertical" accessibilityLabel={`More actions for ${label}`} disabled={disabled} onPress={() => setOpen(true)} />}>
    <Menu.Item leadingIcon="archive-outline" title="Archive" disabled={disabled} onPress={() => { setOpen(false); onArchive(); }} />
  </Menu>;
}
