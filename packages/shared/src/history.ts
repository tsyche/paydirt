import type { SpendRequest, TimeGrant, User } from "./types";

export interface HistoryPage<T> {
  items: T[];
  hasMore: boolean;
}

export type ScreenGrantHistoryRow = (SpendRequest | TimeGrant) & {
  bonus: boolean;
  expand?: { child?: User };
};

/** Fill a visible page even when entire underlying pages have been archived. */
export async function visibleHistoryPage<T>(
  fetchPage: (after: T | undefined, limit: number) => Promise<HistoryPage<T>>,
  visible: (item: T) => boolean,
  after: T | undefined,
  limit: number,
): Promise<HistoryPage<T>> {
  const items: T[] = [];
  let cursor = after;
  while (items.length <= limit) {
    const page = await fetchPage(cursor, Math.max(20, limit + 1 - items.length));
    items.push(...page.items.filter(visible));
    if (items.length > limit || !page.hasMore || !page.items.length) break;
    cursor = page.items.at(-1);
  }
  return { items: items.slice(0, limit), hasMore: items.length > limit };
}

/** Refresh the visible prefix without imposing a permanent history cap. */
export async function historyPrefix<T>(
  fetchPage: (after: T | undefined, limit: number) => Promise<HistoryPage<T>>,
  count: number,
): Promise<HistoryPage<T>> {
  const items: T[] = [];
  let hasMore = false;
  while (items.length < count) {
    const page = await fetchPage(items.at(-1), Math.min(100, count - items.length));
    items.push(...page.items);
    hasMore = page.hasMore;
    if (!hasMore || page.items.length === 0) break;
  }
  return { items, hasMore };
}
