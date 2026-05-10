# Schedule Fight: Opponent Reputation Filter

**Date:** 2026-05-09

## Problem

The opponent list on the Schedule Fight page shows all boxers of the same weight class across all reputation levels. With many NPC boxers in the database this becomes tedious to scroll through.

## Solution

Add a reputation filter bar above the opponent list. It defaults to the gym boxer's own reputation level and lets the user step up/down through tiers using arrow buttons or a dropdown.

---

## State

Add one new piece of state to the `Schedule` component:

```ts
const [reputationFilter, setReputationFilter] = useState<ReputationLevel | null>(null);
```

`null` = not yet initialized (no event selected yet).

**Reset rules:**
- When the selected boxer changes: set to `null` (will re-initialize once an event is picked)
- When the selected event changes: set to `selectedGymBoxer.reputation`
- Both of these already trigger `setSelectedOpponentId(null)` — reputation reset happens in the same handler

---

## UI: Reputation Filter Bar

Rendered at the top of the opponent panel, only when an event is selected.

```
[ ‹ ]  [ Contender      ▾ ]  [ › ]
```

- `‹` / `›` are `<button>` elements; they decrement/increment the reputation index, clamping at 0 and 9 (no wrap)
- The center element is a `<select>` listing all 10 `ReputationLevel` values in ascending order (index 0 at top)
- All three controls read/write `reputationFilter`

**Existing `REPUTATION_LEVELS` array** (ordered, derived from `REPUTATION_INDEX`):

```ts
const REPUTATION_LEVELS: ReputationLevel[] = [
  'Unknown', 'Local Star', 'Rising Star', 'Respectable Opponent',
  'Contender', 'Championship Caliber', 'Nationally Ranked',
  'World Class Fighter', 'International Superstar', 'All-Time Great',
];
```

---

## Opponent Filtering

After the existing `opponents` derivation (same weight class, not in gym):

```ts
const filteredOpponents = reputationFilter !== null
  ? opponents.filter(b => b.reputation === reputationFilter)
      .sort((a, b) => a.name.localeCompare(b.name))
  : [];
```

- The `opponentsByFed` grouping is re-derived from `filteredOpponents` instead of `opponents`
- Empty state message changes to "No opponents at this reputation level." when `filteredOpponents` is empty and an event is selected

---

## Scope

- Changes are contained to `Schedule.tsx` and its CSS module `Schedule.module.css`
- No new files, no changes to DB layer or other components
- The `OpponentRow` component is unchanged
