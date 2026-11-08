import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { Portal, Snackbar } from "react-native-paper";
import { errorMessage, type ArchiveKind } from "@paydirt/shared";
import { SwipeActionsRow } from "./SwipeActionsRow";
import { ArchiveMenu } from "./ArchiveMenu";
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

/** Personal history archives to the left; the menu provides an accessible action. */
export function ArchiveRow({ kind, id, label, onChanged, children }: {
  kind: ArchiveKind; id: string; label: string; onChanged?: () => void; children: ReactNode;
}) {
  const { archive, working } = useArchives();
  const onArchive = () => void archive(kind, id, onChanged);
  return <SwipeActionsRow disabled={working} onArchive={onArchive}>
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1 }}>{children}</View>
      <ArchiveMenu label={label} disabled={working} onArchive={onArchive} />
    </View>
  </SwipeActionsRow>;
}
