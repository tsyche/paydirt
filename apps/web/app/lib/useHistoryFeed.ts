import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, historyPrefix, type HistoryPage } from "@paydirt/shared";

/** Keep expanded history visible through realtime refreshes; load only ten more per tap. */
export function useHistoryFeed<T>(
  fetchPage: (after: T | undefined, limit: number) => Promise<HistoryPage<T>>,
  refreshKey: number,
) {
  const [page, setPage] = useState<HistoryPage<T>>({ items: [], hasMore: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(page);
  const wanted = useRef(5);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const loader = useRef(fetchPage);
  const apply = useCallback((next: HistoryPage<T>, request: number) => {
    if (request !== generation.current) return;
    current.current = next;
    setPage(next);
    setError("");
  }, []);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    inFlight.current = true;
    setBusy(true);
    try { apply(await historyPrefix(fetchPage, wanted.current), request); }
    catch (e) { if (request === generation.current) setError(errorMessage(e)); }
    finally {
      if (request === generation.current) { inFlight.current = false; setBusy(false); }
    }
  }, [fetchPage, apply]);
  useEffect(() => {
    if (loader.current !== fetchPage) {
      loader.current = fetchPage;
      wanted.current = 5;
      current.current = { items: [], hasMore: false };
      setPage(current.current);
    }
    void reload();
    return () => { generation.current++; };
  }, [fetchPage, refreshKey, reload]);
  async function loadMore() {
    if (inFlight.current || !current.current.hasMore) return;
    const request = ++generation.current;
    inFlight.current = true;
    wanted.current = current.current.items.length + 10;
    setBusy(true);
    try {
      const next = await fetchPage(current.current.items.at(-1), 10);
      apply({ items: [...current.current.items, ...next.items], hasMore: next.hasMore }, request);
    } catch (e) { if (request === generation.current) setError(errorMessage(e)); }
    finally {
      if (request === generation.current) { inFlight.current = false; setBusy(false); }
    }
  }
  return { ...page, busy, error, reload, loadMore };
}
