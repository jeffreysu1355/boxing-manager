# NPC Background Fight Simulation — Design Spec

## Overview

When the player simulates time forward, all non-gym boxers (federation-affiliated and free agents) should also be fighting in the background. Fight results update boxer records, rank points, and title belts. A new "Recent Results" page under League shows the last 12 months of NPC fights.

---

## Data Model Changes

### `Boxer` — add `nextFightDate`

Add one new optional field to the `Boxer` interface in `src/db/db.ts`:

```ts
nextFightDate?: string; // ISO date — when this boxer is next scheduled to fight
```

Set at world gen for all non-gym boxers (randomized within first 3–6 months from game start). Re-rolled after each fight by adding 90–180 random days to the fight date. Not set for gym-affiliated boxers (the player manages those).

### `Fight` — make `contractId` nullable

Change `contractId: number` → `contractId: number | null` in `src/db/db.ts`:

```ts
contractId: number | null; // null = NPC-simulated fight with no player contract
```

A `null` contractId is the canonical marker for NPC fights throughout the codebase. The `fightResultApplier.ts` skip-contract step (step 4) must guard on `contractId !== null` before looking up the contract.

No new store is needed — NPC fights are persisted in the existing `fights` store.

---

## Fight Scheduling & Matching

Implemented in a new file `src/lib/npcFightSim.ts`.

### Triggering

`simulateNpcFights(fromDate: string, toDate: string): Promise<void>` is called from TopNav's sim handler after `runTraining`, before re-fetching events.

### Matching algorithm

For each sim step:

1. Load all boxers where `gymId === null` (both free agents and federation boxers).
2. Collect every boxer whose `nextFightDate` falls within `(fromDate, toDate]`.
3. Maintain a `matchedThisStep: Set<number>` to prevent a boxer from fighting twice in one sim window.
4. For each eligible boxer (skip if already matched):
   a. Find candidates: same weight class, not already matched, `nextFightDate` either not set or not in this window (i.e., the opponent isn't also independently scheduled — they become the opponent of whoever triggers first).
   b. Score candidates by reputation:
      - **Seeking rank** (wins < losses, or win rate < 40%): prefer opponents 1 reputation tier above. Weight: same tier = 1, +1 tier = 3, other = 0.
      - **Padding record** (win rate ≥ 60%): occasionally (30% chance) targets -1 tier. Weight: same tier = 2, -1 tier = 1, other = 0.
      - **Default**: same tier preferred. Weight: same tier = 3, ±1 tier = 1, other = 0.
   c. Weighted-random pick among candidates with score > 0. If no candidates found, re-roll `nextFightDate` +30 days and skip.
5. Determine if title fight: both boxers in the same federation AND one (and only one) holds that federation's title for their weight class. Cross-federation fights are never title fights.
6. Simulate using existing `simulateFight()` from `src/lib/fightSim.ts`. Build a minimal `Fight` object (`Omit<Fight, 'id'>`) with `contractId: null` to pass as the third argument — persist it after simulation to get the assigned `id`.

### Post-fight updates

For each simulated fight:

1. Persist a `Fight` record with `contractId: null`, `date`, `federationId` (null if cross-federation), `weightClass`, `boxerIds`, `winnerId`, `method`, `finishingMove`, `round`, `time`, `isTitleFight`.
2. Update both boxers: append `FightRecord` to `boxer.record[]`, apply `applyRankChange()`.
3. If `isTitleFight`: transfer title via existing title store logic (same as `fightResultApplier.ts` step 3).
4. Re-roll `nextFightDate` on both boxers: `fightDate + rand(90, 180) days`.
5. Mark both as matched in `matchedThisStep`.

### Pruning

After all matches for a sim step are resolved, delete `Fight` records where `contractId === null` and `date < (currentDate minus 365 days)`. This keeps the store lean. Boxer `record[]` arrays are never pruned.

---

## Recent Results Page

### Route & navigation

- New page: `src/pages/League/RecentResults.tsx`
- Route: `/league/results`
- Added to `Sidebar` config under `/league` as "Results"
- Added to `routes.tsx` under the `league` children

### Data

Loads all `Fight` records where `contractId === null`, filters to those within the last 12 months of `currentDate`, sorted by date descending.

For each fight, looks up both boxer names from the `boxers` store (or displays "Unknown" if deleted).

### Display

A read-only table with columns:

| Date | Fighter A | vs | Fighter B | Winner | Method | Weight Class | Federation | Title Fight |
|------|-----------|----|-----------|----|--------|--------------|------------|-------------|

- Boxer names link to `/player/:id`
- Winner name is bolded
- Federation shows the federation name, or "Cross-Federation" if `federationId` is null
- Title Fight column shows "Title Fight" badge or empty

---

## World Gen Changes

In `generateWorld()` and `generateFreeAgents()` / `generateProspects()` in `src/db/worldGen.ts`:

Set `nextFightDate` on each newly created non-gym boxer:

```ts
nextFightDate: addDays('2026-01-01', rand(0, 180))
```

(Uses the same `addDays` utility from `src/lib/simTime.ts`.)

---

## Integration Point: TopNav

In `src/components/TopNav/TopNav.tsx`, after the `runTraining(...)` call:

```ts
await simulateNpcFights(currentDate, result.newDate);
```

---

## Testing

- `src/lib/npcFightSim.test.ts` — unit tests for matching logic (seeking rank, padding record, default), title fight detection, double-booking prevention, and `nextFightDate` re-roll.
- `src/db/worldGen.test.ts` — verify `nextFightDate` is set on generated boxers.
- `src/pages/League/RecentResults.test.ts` — verify page renders NPC fights from the store and filters by date range.
