import { useState } from "react";
import { Alert, View, useWindowDimensions } from "react-native";
import { deviceType, DeviceType } from "expo-device";
import { Appbar, Badge, Menu } from "react-native-paper";

/** Direct navigation needs both a tablet classification and room for all actions. */
export function HeaderNavigation({ unread, onInbox, onTheme, onLogout, onSettings }: {
  unread: boolean; onInbox: () => void; onTheme: () => void; onLogout: () => void; onSettings?: () => void;
}) {
  const { width } = useWindowDimensions();
  const direct = deviceType === DeviceType.TABLET && width >= 768;
  const [menu, setMenu] = useState(false);
  const confirmLogout = () => Alert.alert("Sign out?", "You will need to sign in again to use PayDirt.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: onLogout },
  ]);
  const pick = (fn: () => void) => () => { setMenu(false); fn(); };
  return (<>
      {direct ? <>
        <Appbar.Action icon={unread ? "bell-badge" : "bell-outline"} accessibilityLabel={unread ? "Alerts, new alerts" : "Alerts"} onPress={onInbox} />
        <Appbar.Action icon="palette-outline" accessibilityLabel="Theme and colors" onPress={onTheme} />
        {onSettings ? <Appbar.Action icon="cog-outline" accessibilityLabel="Household settings" onPress={onSettings} /> : null}
        <Appbar.Action icon="logout" accessibilityLabel="Sign out" onPress={confirmLogout} />
      </> : <Menu
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
        <Menu.Item leadingIcon="palette-outline" title="Theme and colors" onPress={pick(onTheme)} />
        <Menu.Item
          leadingIcon={unread ? "bell-badge" : "bell-outline"}
          title={unread ? "Alerts (new)" : "Alerts"}
          onPress={pick(onInbox)}
        />
        {onSettings ? <Menu.Item leadingIcon="cog-outline" title="Household settings" onPress={pick(onSettings)} /> : null}
        <Menu.Item leadingIcon="logout" title="Sign out" onPress={pick(onLogout)} />
      </Menu>}
  </>);
}
