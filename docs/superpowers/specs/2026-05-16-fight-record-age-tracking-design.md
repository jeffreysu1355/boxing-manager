# Fight Record Age Tracking

**Date:** 2026-05-16
**Status:** Approved

## Overview

Track each boxer's age and their opponent's age at the time of every fight. Both ages are stored on the `FightRecord` and displayed as two columns ("Age" and "Opp. Age") in the boxer's fight record table on the Player page.

## Data Layer

### FightRecord schema change (`src/db/db.ts`)

Add two optional fields to the `FightRecord` interface:

```ts
export interface FightRecord {
  result: 'win' | 'loss' | 'draw';
  opponentName: string;
  opponentId: number | null;
  method: string;
  finishingMove: string | null;
  round: number;
  time: string;
  federation: string;
  date: string;
  isTitleFight?: boolean;
  ageAtFight?: string;         // boxer's own age at fight date, e.g. "27y 3m"
  opponentAgeAtFight?: string; // opponent's age at fight date, e.g. "29y 1m"
}
```

Both fields are optional — existing records without them display as `"—"`. No DB migration is required.

### Age calculation helper

A pure utility function, co-located with existing date utilities or in a small `src/lib/ageCalc.ts` module:

```ts
function calcAgeAtDate(birthDate: string | undefined, fightDate: string): string
```

- Parses both dates as ISO `YYYY-MM-DD`
- Computes whole years and remaining whole months
- Returns `"Xy Ym"` format (e.g. `"27y 3m"`)
- Returns `"—"` if `birthDate` is `undefined`

## Fight Record Construction

### Player fights (`src/pages/Fight/FightPage.tsx`)

Both `winner` and `loser` boxer objects are in scope when `winnerRecord` and `loserRecord` are built. Extend each:

```ts
const winnerRecord = {
  // ...existing fields...
  ageAtFight: calcAgeAtDate(winner.birthDate, f.date),
  opponentAgeAtFight: calcAgeAtDate(loser.birthDate, f.date),
};

const loserRecord = {
  // ...existing fields...
  ageAtFight: calcAgeAtDate(loser.birthDate, f.date),
  opponentAgeAtFight: calcAgeAtDate(winner.birthDate, f.date),
};
```

This pattern applies to both record-construction sites in `FightPage.tsx` (lines ~190 and ~287).

### NPC fights (`src/components/TopNav/fightResultApplier.ts` / callers)

NPC fight records (`winnerRecord`, `loserRecord`) are also constructed at call sites before being passed to `applyFightResult`. The same `calcAgeAtDate` calls are added at those construction sites. The `applyFightResult` function itself does not need changes — it passes records through unchanged.

## Display (`src/pages/Player/PlayerPage.tsx`)

Add two columns to the fight record table after "Date":

| ... | Date | Age | Opp. Age | (title badge) |
|-----|------|-----|----------|---------------|

Render `fight.ageAtFight ?? '—'` and `fight.opponentAgeAtFight ?? '—'` in those cells.

## Out of Scope

- Opponent age is not shown on any other page (Roster, Recent Results, etc.)
- No backfill of age for historical records — existing rows display `"—"`
- No editing of age through God Mode
