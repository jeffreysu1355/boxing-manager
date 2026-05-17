# Age Decline & Retirement — Design Spec

**Date:** 2026-05-16

## Overview

Boxers age 35+ train more slowly and lose stats monthly. Any gym boxer can be retired at any time via a button on their profile page. Retired boxers stay in the DB with a `retired` flag, remain associated with the gym, and appear on a new "Retired" page under Gym. A future "Hall of Fame" page will use the same retained data.

---

## Data Model

### New field on `Boxer`

| Field | Type | Description |
|-------|------|-------------|
| `retired?: boolean` | optional boolean | When `true`, boxer is inactive. Preserved in DB, stays in `gym.rosterIds`. |

No other schema changes needed.

---

## Age-Based Training Slowdown

Applied inside `applyTraining` in `src/lib/training.ts`. A multiplier scales the exp gain rate:

```
ageTrainingMultiplier(age: number): number
  age <= 35 → 1.0
  age > 35  → max(0.1, 1.0 - (age - 35) * 0.05)
```

| Age | Multiplier |
|-----|-----------|
| ≤35 | 1.00 |
| 36  | 0.95 |
| 37  | 0.90 |
| 40  | 0.75 |
| 45  | 0.50 |
| 53+ | 0.10 (floor) |

Applied as: `rate = EXP_PER_DAY[coach.skillLevel] * gymMultiplier * ageTrainingMultiplier(boxer.age)`

Retired boxers skip `applyTraining` entirely.

---

## Stat Regression

Runs in `runAgingPass` in `TopNav.tsx`, triggered once per month boundary, applied **only to boxers who just aged** (i.e. `shouldAgeBoxer` returned true for them). Logic lives in `src/lib/aging.ts`.

### Regression amount

```
regressionPointsPerMonth(age: number): number
  age <= 35 → 0
  age > 35  → floor((age - 35) * 0.15)
```

| Age | pts/month |
|-----|----------|
| ≤35 | 0 |
| 36–41 | 0 |
| 42 | 1 |
| 49 | 2 |
| 56 | 3 |

Note: regression accumulates only when `shouldAgeBoxer` fires (i.e. in the birth month), so a 42-year-old loses 1 stat point per year (in their birth month), not 1 per month literally.

### Which stats regress

Points are deducted from **non-style stats first** (weakest first), then style stats if points remain. A stat cannot drop below 1.

```
applyStatRegression(boxer: Boxer): Boxer
  points = regressionPointsPerMonth(boxer.age)
  if points === 0: return boxer unchanged
  sort non-style stats ascending by value
  deduct 1 point each from weakest non-style stats until points exhausted
  if points remain, deduct from weakest style stats
  floor each stat at 1
```

Retired boxers skip regression entirely.

---

## Retirement

### Triggering retirement

- **Retire button** on `PlayerPage.tsx`, visible only for gym boxers (not NPCs, not already-retired)
- On click: confirm dialog → set `boxer.retired = true` → write to DB → navigate to `/gym/roster`

### Effect on game systems

| System | Behavior for retired boxer |
|--------|---------------------------|
| `applyTraining` | skipped (filter `b.gymId === gymId && !b.retired`) |
| `runAgingPass` | skipped (filter `!boxer.retired`) |
| Roster page | not shown (active boxers only) |
| Fight scheduling | not eligible |
| Profile page | still viewable; no Retire button shown |

### Retired page

New route: `/gym/retired`

- Listed under Gym nav section alongside Roster, Finances, Coaches
- Shows all boxers where `boxer.gymId === gym.id && boxer.retired === true`
- Columns: Name, Age, Weight Class, Style, Record, Reputation
- Each name links to their profile (read-only)

---

## UI Changes

### `PlayerPage.tsx`
- Retire button shown when: boxer is a gym boxer (`boxer.gymId === gymId`), not already retired, and god mode is irrelevant (available always for gym boxers)
- Confirm before retiring: browser `confirm()` dialog — "Retire [Name]? This cannot be undone."
- After confirming: `putBoxer({ ...boxer, retired: true })` → navigate to `/gym/roster`

### `Roster.tsx`
- Filter out `retired === true` boxers (no change to display, just add the filter)

### `GymLayout.tsx` + `Sidebar.tsx`
- Add "Retired" link to Gym nav section: `{ to: '/gym/retired', label: 'Retired' }`

### New file: `src/pages/Gym/Retired.tsx`
- Simple table of retired gym boxers

---

## Scope / Out of Scope

**In scope:**
- `retired?: boolean` on `Boxer`
- `ageTrainingMultiplier` in `training.ts`
- `regressionPointsPerMonth` + `applyStatRegression` in `aging.ts`
- `runAgingPass` applies regression to newly-aged boxers
- Training pass skips retired boxers
- Retire button on `PlayerPage`
- `/gym/retired` page + nav link

**Out of scope:**
- Hall of Fame (future — data preserved via `retired` flag + fight record)
- Automatic forced retirement at any age
- NPC boxer retirement
- Stat regression affecting NPC boxers
