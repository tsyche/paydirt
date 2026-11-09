import { ArchiveButton, useArchives } from "./ArchiveActions";
import { useCallback } from "react";
import { bankedTimeLabel, householdDateTime, type ScreenGrantHistoryRow } from "@paydirt/shared";
import { client } from "../lib/client";
import { useHistoryFeed } from "../lib/useHistoryFeed";

export function PastScreenGrants({ householdId, reloadKey }: { householdId: string; reloadKey: number }) {
  const fetchPage = useCallback((after: ScreenGrantHistoryRow | undefined, limit: number) =>
    client.listScreenGrantHistoryPage(householdId, after, limit), [householdId]);
  const { version } = useArchives();
  const history = useHistoryFeed(fetchPage, reloadKey + version);
  if (!history.items.length && !history.busy && !history.error) return null;
  return <section aria-label="Past screen-time grants"><details aria-label="Past screen-time grants">
    <summary>Past screen-time grants</summary>
    {history.items.map((grant) => <div className="card" key={`${grant.bonus ? "bonus" : "purchase"}:${grant.id}`}>
      <strong>{grant.expand?.child?.display_name ?? "Child"} — {grant.description}</strong>
      <div>{bankedTimeLabel(grant)}</div>
      <div className="muted">{householdDateTime(grant.updated)}</div>
      <ArchiveButton kind={grant.bonus ? "time_grant" : "spend_request"} id={grant.id} label={grant.description || "time grant"} />
    </div>)}
    {history.error && <p className="error" role="alert">{history.error}</p>}
    {history.error && <button disabled={history.busy} onClick={() => void history.reload()}>Retry history</button>}
    {history.hasMore && <button disabled={history.busy} onClick={() => void history.loadMore()}>
      {history.busy ? "Loading…" : "Show more"}
    </button>}
  </details></section>;
}
