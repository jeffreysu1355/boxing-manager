# Boxer Aging — Design Spec

**Date:** 2026-05-16

## Overview

Add monthly-granularity aging to boxers. Each boxer has a `birthDate` stored for future filtering/queries. Age increments by 1 when the game date crosses the boxer's birth month in a new year. No per-day DB scanning.

---

## Data Model

### New fields on `Boxer`

| Field | Type | Description |
|-------|------|-------------|
| `birthDate` | `string` (ISO `YYYY-MM-DD`) | Full date displayed on boxer profile. Day is approximate (randomly assigned at generation) since aging increments at month boundaries, not the exact day. |
| `lastAgedYear` | `number` | The game year this boxer last had `age` incremented. Prevents double-aging. |

`Boxer.age` is retained as the authoritative display and gameplay value. `birthDate` drives when to increment it.

---

## Aging Logic

Triggered at the end of any sim step that crosses a **month boundary** (same cadence as `recruitRefreshDate` refresh). The check:

```
if newYear > boxer.lastAgedYear AND newMonth >= boxer.birthMonth:
  boxer.age += 1
  boxer.lastAgedYear = newYear
```

- `newMonth` = numeric month of `result.newDate` (1–12)
- `boxer.birthMonth` = numeric month extracted from `boxer.birthDate`
- `newYear` = year of `result.newDate`

Only runs when a month boundary was crossed in the sim step. Iterates all boxers once per month boundary — same pattern as existing recruit refresh.

---

## World Gen

When generating a boxer:
1. Pick random birth month (1–12) and day (1–28)
2. Birth year = `2026 - boxer.age`
3. `birthDate = "${birthYear}-${pad(birthMonth)}-${pad(birthDay)}"`
4. `lastAgedYear = 2026` — prevents re-aging in the game's first year

---

## DB Migration

No schema version bump needed (new optional fields on existing object store).

- Existing boxers missing `birthDate`: generate one lazily on first read — random month/day, birth year = `currentYear - age`
- Existing boxers missing `lastAgedYear`: default to `currentYear` on first use — prevents immediate re-aging

Runtime defaults live in `boxerStore.ts` (a `normalizeBoxer` helper or inline in `getBoxer`/`getAllBoxers`).

---

## UI

**`PlayerPage.tsx`** — add a "Born" field to the boxer detail view, formatted as `"March 15, 2002"` (full date shown). The day is approximate since aging increments at the month boundary, not the exact stored day.

No other UI changes needed.

---

## Scope / Out of Scope

**In scope:**
- `birthDate` + `lastAgedYear` fields on `Boxer`
- World gen populates both fields
- Monthly aging check hooked into `TopNav.handleSim`
- `PlayerPage` displays full birth date (day approximate)
- Lazy migration for existing records

**Out of scope:**
- Stat decline with age
- Retirement triggers
- Age-based filtering UI (future feature enabled by `birthDate`)
