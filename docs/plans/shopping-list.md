# Household shopping list

**TL;DR:** Kids and parents flag "we're out of X" in one tap; parents see one de-duplicated list, mark things Bought or Dismissed, and the requester gets a push. It reuses the request-and-approve pattern, pays no grit, and starts as a small MVP.
**Status:** Draft
**Fold into:** [FEATURES.md](../../FEATURES.md), [DATA_MODEL.md](../DATA_MODEL.md)


## MVP

- One `shopping_items` collection: `household`, `name`, `status` (`requested`/`bought`/`dismissed`), `requested_by`, `resolved_by`, `resolved_at`. Resolved rows stay as history.
- Duplicate open requests collapse into one row ("asked by Kid 1 and Kid 2"); the second asker is added, not a new row.
- Kid UI (mobile only): free text plus one-tap staple tiles. A name requested 3+ times becomes a tile. Fits simplified mode.
- Parent list on **web and mobile** (parity): Bought / Dismiss, plus add-your-own.
- ntfy to parents is batched and respects quiet hours; a "Bought" push goes back to the requesting kid. A dismissed item does not re-ping.

## Decisions

- **No grit reward for requests.** It would reward spam; a parent can grant a bonus by hand.
- Guard rails: per-kid rate limit on new requests; kid list visibility remains an open question below.

## Later

- Photo of the empty item, store or aisle grouping, a "shopping now" checklist mode.

## Open questions

- Should kids see the whole open list or only their own requests?
- Do dismissed items need a reason shown to the kid?
