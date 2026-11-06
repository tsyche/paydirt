import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { errorMessage, type ArchiveKind } from "@paydirt/shared";
import { client } from "../lib/client";

const ArchiveContext = createContext({ version: 0, working: false, archive: async (_kind: ArchiveKind, _id: string) => {}, restore: async (_id: string) => {} });
export const useArchives = () => useContext(ArchiveContext);
export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<string | null>(null);
  const busy = useRef(false);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    void client.subscribeToArchives(() => setVersion((v) => v + 1)).then((fn) => { if (disposed) fn(); else stop = fn; }).catch(() => {});
    return () => { disposed = true; stop?.(); };
  }, []);
  async function restore(id: string) {
    if (busy.current) return;
    busy.current = true; setWorking(true);
    try {
      await client.restoreArchivedItem(id);
      setUndo(null); setNotice("Restored."); setVersion((v) => v + 1);
    } catch (e) { setNotice(errorMessage(e)); }
    finally { busy.current = false; setWorking(false); }
  }
  async function archive(kind: ArchiveKind, id: string) {
    if (busy.current) return;
    busy.current = true; setWorking(true);
    try {
      setUndo(null); setNotice("Archiving…");
      const item = await client.archiveItem(kind, id);
      setUndo(item.id); setNotice("Archived."); setVersion((v) => v + 1);
    } catch (e) { setNotice(errorMessage(e)); }
    finally { busy.current = false; setWorking(false); }
  }
  return <ArchiveContext.Provider value={{ version, working, archive, restore }}>
    {children}
    {notice && <div className="archive-notice" role="status">
      {notice} {undo && <button onClick={() => void restore(undo)}>Undo</button>}
      <button aria-label="Close archive message" onClick={() => { setNotice(""); setUndo(null); }}>✕</button>
    </div>}
  </ArchiveContext.Provider>;
}
export function ArchiveButton({ kind, id, label }: { kind: ArchiveKind; id: string; label: string }) {
  const { archive, working } = useArchives();
  return <button type="button" className="sm" aria-label={`Archive ${label}`} disabled={working} onClick={() => void archive(kind, id)}>Archive</button>;
}
