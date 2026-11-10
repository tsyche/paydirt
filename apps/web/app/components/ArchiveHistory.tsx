import { ConversationButton, ConversationLink } from "./ChoreConversation";
import { useCallback } from "react";
import { archiveDetails, archiveLabel, householdDateTime, type ArchivedItem } from "@paydirt/shared";
import { client } from "../lib/client";
import { useHistoryFeed } from "../lib/useHistoryFeed";
import { useArchives } from "./ArchiveActions";

export function ArchiveHistory() {
  const { version, restore, working } = useArchives();
  const fetchPage = useCallback((after: ArchivedItem | undefined, limit: number) => client.listArchivesPage(after, limit), []);
  const history = useHistoryFeed(fetchPage, version);
  return <section aria-label="Archived items">
    <h2>Archived</h2><p className="muted">Personal history. Restoring an item does not award it again.</p>
    {!history.busy && !history.items.length && !history.error && <p>No archived items.</p>}
    {history.items.map((item) => <div className="card row" key={item.id}>
      <div><strong>{archiveLabel(item)}</strong><p>{archiveDetails(item)}</p><div className="muted">Archived {householdDateTime(item.created)}</div></div>
      {item.assignment && <ConversationButton assignmentId={item.assignment} />}
      <ConversationLink source={item.expand?.inbox?.source} />
      <button disabled={working} onClick={() => void restore(item.id)}>Restore</button>
    </div>)}
    {history.error && <><p className="error" role="alert">{history.error}</p><button onClick={() => void history.reload()}>Retry</button></>}
    {history.hasMore && <button disabled={history.busy} onClick={() => void history.loadMore()}>Show more</button>}
  </section>;
}
