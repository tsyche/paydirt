import { useState, type ReactNode } from "react";
import { AppearanceDialog } from "./AppearanceDialog";
import { InboxDialog, useUnreadAlerts } from "./InboxDialog";
import { HeaderNavigation } from "./HeaderNavigation";

/** Shared header actions and dialogs for parents and both kid layouts. */
export function HeaderMenu({ userId, onLogout, onSettings, overviewAction }: { userId: string; onLogout: () => void; onSettings?: () => void; overviewAction?: ReactNode }) {
  const [theme, setTheme] = useState(false);
  const [inbox, setInbox] = useState(false);
  const { unread, markSeen } = useUnreadAlerts(userId, inbox);
  return (
    <>
      <HeaderNavigation unread={!!unread} onInbox={() => { markSeen(); setInbox(true); }} onTheme={() => setTheme(true)} onLogout={onLogout} onSettings={onSettings} overviewAction={overviewAction} />
      <AppearanceDialog visible={theme} onDismiss={() => setTheme(false)} />
      <InboxDialog userId={userId} visible={inbox} onDismiss={() => setInbox(false)} />
    </>
  );
}
