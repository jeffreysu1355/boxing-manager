# World Gen Cross-Reference Fights

**Date:** 2026-04-25  
**Status:** Approved

## Problem

`generateFightRecord` builds each boxer's fight history independently using randomly generated opponent names. When two real boxers happen to share a name match, the fight only appears on one boxer's record. The opponent has no corresponding entry and their player page cannot be linked.

## Goal

When world gen creates a fight between two real boxers (same federation, same weight class), the fight should appear on both boxers' records as mirrored entries (one win, one loss), and the opponent name should link to the opponent's player page.

## Data Change

Add `opponentId: number | null` to the `FightRecord` interface in `db.ts`:

```ts
export interface FightRecord {
  result: 'win' | 'loss' | 'draw';
  opponentName: string;
  opponentId: number | null;   // new — links to a real boxer; null = fictional opponent
  method: string;
  finishingMove: string | null;
  round: number;
  time: string;
  federation: string;
  date: string;
}
```

No DB migration needed. Existing records without `opponentId` return `undefined` from IndexedDB; render code treats `undefined | null` the same way.

`generateFightRecord` sets `opponentId: null` on all entries it creates (fictional opponents).

## World Gen Change

After all boxers in a federation are inserted (end of the per-federation loop in `generateWorld`), call a new function:

```
crossReferenceFights(federationId, boxerIds)
```

**Algorithm:**

1. Fetch all just-inserted boxers by their IDs.
2. For each boxer A, iterate their `record` array by index.
3. For each fight where `opponentId === null`, with 40% probability, attempt to replace it with a real opponent:
   - Collect eligible real boxers: same federation, same weight class, not boxer A, not already paired with A for this fight.
   - If none available, skip (keep fictional).
   - Otherwise pick one at random (boxer B).
4. Update boxer A's fight entry: set `opponentName = boxerB.name`, `opponentId = boxerB.id`.
5. Push a mirror `FightRecord` onto boxer B's record:
   - `result`: opposite of A's result (`win` ↔ `loss`; `draw` stays `draw`)
   - `opponentName`: boxer A's name, `opponentId`: boxer A's id
   - All other fields (`method`, `finishingMove`, `round`, `time`, `federation`, `date`) copied from A's entry.
6. Save boxer A and boxer B.

**Constraint:** Track which (A, B) pairs have been linked per fight slot to avoid duplicate pairings. A simple `Set<string>` of `"minId-maxId"` keys is sufficient.

## Render Change

In `PlayerPage.tsx`, when rendering the fight history table, check `fight.opponentId`:

- If `opponentId` is non-null: render opponent name as `<Link to={/player/${fight.opponentId}}>{fight.opponentName}</Link>`
- Otherwise: render plain text

## Out of Scope

- Cross-federation fights in world gen
- Retroactively fixing existing saves (requires a new game)
- Simulated fight records (handled separately by the Sim Fight flow)
