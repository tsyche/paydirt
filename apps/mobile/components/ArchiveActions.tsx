import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, View } from "react-native";
import { IconButton, Portal, Snackbar, Text, useTheme } from "react-native-paper";
import { completesArchiveSwipe, errorMessage, startsArchiveSwipe, type ArchiveKind } from "@paydirt/shared";
import { client } from "../lib/client";

const ArchiveContext = createContext({
  version: 0, working: false,
  archive: async (_kind: ArchiveKind, _id: string, _refresh?: () => void) => {},
  restore: async (_id: string, _refresh?: () => void) => {},
});

export function ArchiveProvider({ children, userId }: { children: ReactNode; userId?: string }) {
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<{ id: string; refresh?: () => void } | null>(null);
  const busy = useRef(false);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void client.subscribeToArchives(() => setVersion((v) => v + 1)).then((fn) => {
      if (disposed) fn(); else stop = fn;
    }).catch(() => {});
    return () => { disposed = true; stop?.(); };
  }, [userId]);
  async function restore(id: string, refresh?: () => void) {
    if (busy.current) return;
    busy.current = true; setWorking(true);
    try {
      await client.restoreArchivedItem(id);
      setUndo(null); setNotice("Restored.");
      setVersion((v) => v + 1); refresh?.();
    } catch (e) { setNotice(errorMessage(e)); }
    finally { busy.current = false; setWorking(false); }
  }
  async function archive(kind: ArchiveKind, id: string, refresh?: () => void) {
    if (busy.current) return;
    busy.current = true; setWorking(true);
    try {
      setUndo(null); setNotice("Archiving…");
      const item = await client.archiveItem(kind, id);
      setUndo({ id: item.id, refresh }); setNotice("Archived.");
      setVersion((v) => v + 1); refresh?.();
    } catch (e) { setNotice(errorMessage(e)); }
    finally { busy.current = false; setWorking(false); }
  }
  return <ArchiveContext.Provider value={{ version, working, archive, restore }}>
    {children}
    <Portal><Snackbar visible={!!notice} duration={6000} onDismiss={() => { setNotice(""); setUndo(null); }}
      action={undo ? { label: "Undo", onPress: () => void restore(undo.id, undo.refresh) } : undefined}>
      {notice}
    </Snackbar></Portal>
  </ArchiveContext.Provider>;
}

export const useArchives = () => useContext(ArchiveContext);

/** Horizontal swipes archive in either direction; ordinary vertical scrolling stays free. */
export function ArchiveRow({ kind, id, label, onChanged, children }: {
  kind: ArchiveKind; id: string; label: string; onChanged?: () => void; children: ReactNode;
}) {
  const { archive, working } = useArchives();
  const theme = useTheme();
  const offset = useRef(new Animated.Value(0)).current;
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => startsArchiveSwipe(g.dx, g.dy),
    onPanResponderMove: (_, g) => offset.setValue(Math.max(-120, Math.min(120, g.dx))),
    onPanResponderRelease: (_, g) => {
      Animated.spring(offset, { toValue: 0, useNativeDriver: false }).start();
      if (completesArchiveSwipe(g.dx, g.dy)) void archive(kind, id, onChanged);
    },
    onPanResponderTerminate: () => Animated.spring(offset, { toValue: 0, useNativeDriver: false }).start(),
  }), [archive, id, kind, offset, onChanged]);
  return <View style={{ overflow: "hidden", borderRadius: 12, marginVertical: 4 }}>
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={{ position: "absolute", inset: 0, backgroundColor: theme.colors.secondaryContainer, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
      <Text>Archive</Text><Text>Archive</Text>
    </View>
    <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX: offset }], backgroundColor: theme.colors.surface }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>{children}</View>
        <IconButton icon="archive-outline" accessibilityLabel={`Archive ${label}`} disabled={working} onPress={() => void archive(kind, id, onChanged)} />
      </View>
    </Animated.View>
  </View>;
}
