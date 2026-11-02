import { useState } from "react";
import { Appbar, Badge, Menu } from "react-native-paper";
import { View } from "react-native";
import { AppearanceDialog } from "./AppearanceDialog";
import { InboxDialog, useUnreadAlerts } from "./InboxDialog";

/**
 * Header overflow menu: Theme, Alerts, Sign out, plus Household settings when `onSettings` is given (parents). A dot on the icon (and on the Alerts
 * row) shows unread alerts, so folding the bell away doesn't hide new ones.
 */
export function HeaderMenu({ userId, onLogout, onSettings }: { userId: string; onLogout: () => void; onSettings?: () => void }) {
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(false);
  const [inbox, setInbox] = useState(false);
  const { unread, markSeen } = useUnreadAlerts(userId, inbox);
  const pick = (fn: () => void) => () => { setMenu(false); fn(); };
  return (
    <>
      <Menu
        visible={menu}
        onDismiss={() => setMenu(false)}
        anchorPosition="bottom"
        anchor={
          <View>
            <Appbar.Action
              icon="menu"
              onPress={() => setMenu(true)}
              accessibilityLabel={unread ? "Menu, new alerts" : "Menu"}
              testID="header-menu"
            />
            {unread ? <Badge size={10} style={{ position: "absolute", top: 8, right: 8 }} testID="alerts-dot" /> : null}
          </View>
        }
      >
        <Menu.Item leadingIcon="palette-outline" title="Theme and colors" onPress={pick(() => setTheme(true))} />
        <Menu.Item
          leadingIcon={unread ? "bell-badge" : "bell-outline"}
          title={unread ? "Alerts (new)" : "Alerts"}
          onPress={pick(() => { markSeen(); setInbox(true); })}
        />
        {onSettings ? <Menu.Item leadingIcon="cog-outline" title="Household settings" onPress={pick(onSettings)} /> : null}
        <Menu.Item leadingIcon="logout" title="Sign out" onPress={pick(onLogout)} />
      </Menu>
      <AppearanceDialog visible={theme} onDismiss={() => setTheme(false)} />
      <InboxDialog userId={userId} visible={inbox} onDismiss={() => setInbox(false)} />
    </>
  );
}
