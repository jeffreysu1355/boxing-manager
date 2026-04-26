# Season Training Exp Design

**Date:** 2026-04-25

## Overview

Coaches train boxers during the season by accumulating exp on specific stats each day the game advances. When enough exp accumulates, the stat increases by 1. The boxer's PlayerPage shows a progress bar for each stat being actively trained.

---

## Data Model

### `Boxer.trainingExp`

Add to the `Boxer` interface in `src/db/db.ts`:

```ts
trainingExp?: Partial<Record<keyof BoxerStats, number>>;
```

Sparse map — only stats with accumulated exp have entries. Missing field defaults to `{}`. No DB schema migration needed (idb returns `undefined` for missing fields; runtime treats it as `{}`).

---

## Style → Stat Mappings

Defined as a constant in `src/lib/training.ts`:

| Style | Stats trained |
|-------|--------------|
| `out-boxer` | `jab`, `cross`, `headMovement`, `guard`, `positioning`, `speed` |
| `swarmer` | `leadHook`, `rearHook`, `bodyMovement`, `positioning`, `endurance`, `toughness` |
| `slugger` | `rearHook`, `uppercut`, `power`, `endurance`, `recovery`, `toughness` |
| `counterpuncher` | `timing`, `adaptability`, `discipline`, `headMovement`, `bodyMovement`, `speed` |

---

## Exp Rates by Coach Tier

| Tier | Exp/day |
|------|---------|
| `local` | 1 |
| `contender` | 2 |
| `championship-caliber` | 4 |
| `all-time-great` | 8 |

---

## Stat Level-Up Threshold

To gain +1 on a stat currently at value `V`, the boxer needs `V × 10` accumulated exp for that stat.

When exp reaches or exceeds the threshold:
1. Increment the stat by 1 (capped at 20, or 25 if boxer has a `NaturalTalent` for that stat)
2. Subtract the threshold from the accumulated exp (carry over remainder)
3. Repeat if new threshold is also exceeded (handles multi-level-up in one sim step)

---

## Training Logic

### `src/lib/training.ts` (new file)

Pure function:

```ts
applyTraining(boxer: Boxer, coach: Coach, days: number): Boxer
```

- Looks up `STYLE_STATS[coach.style]` to get the list of trained stats
- Looks up `EXP_PER_DAY[coach.skillLevel]` for the daily rate
- For each trained stat, adds `days × rate` to `boxer.trainingExp[stat]`
- Applies level-ups: while `exp >= stat × 10`, increment stat, subtract threshold, carry remainder
- Returns a new `Boxer` object (immutable — does not mutate the input)

Stats cannot exceed 20 normally, or 25 if the boxer has a `NaturalTalent` entry for that stat.

### Integration point: `TopNav.tsx`

After each sim step (both `handleSim` result and `handleSimFight`), for every gym boxer that has an assigned coach:

1. Compute `days` elapsed (difference between new date and old date)
2. Call `applyTraining(boxer, coach, days)`
3. Persist the returned boxer via `putBoxer`

The `TopNav` already re-fetches boxers after each sim; this write happens before that re-fetch.

---

## Progress Bar UI

### Location: `PlayerPage.tsx`

The page loads the boxer's assigned coach (fetch all coaches, find `c.assignedBoxerId === boxer.id`).

For each stat row in the stats grid:
- If the stat is in the assigned coach's style stats AND `boxer.trainingExp[stat] > 0` (or coach is assigned, even at 0): show a progress bar
- Otherwise: show plain number (existing behavior)

### Progress bar rendering

```
[ stat name ]  [ ████████░░░░ 14 ]
               green  red   number
```

- Bar width fills the value area
- Green portion = `currentExp / (currentStatValue × 10)` as a percentage
- Red background for unfilled
- Stat number displayed on top of or to the right of the bar
- Bar height: ~10px, vertically centered in the stat row

### CSS

New classes in `PlayerPage.module.css`:
- `.statBar` — container, `position: relative`, `background: var(--danger)`, `border-radius: 2px`
- `.statBarFill` — `position: absolute; left: 0; top: 0; height: 100%; background: var(--success)`
- `.statBarValue` — number overlaid on the bar

---

## Files Changed

| File | Action |
|------|--------|
| `src/db/db.ts` | Add `trainingExp?` field to `Boxer` interface |
| `src/lib/training.ts` | New file: `STYLE_STATS`, `EXP_PER_DAY`, `applyTraining` |
| `src/lib/training.test.ts` | New file: unit tests for `applyTraining` |
| `src/components/TopNav/TopNav.tsx` | Call `applyTraining` + `putBoxer` after each sim step |
| `src/pages/Player/PlayerPage.tsx` | Load assigned coach; render progress bars for trained stats |
| `src/pages/Player/PlayerPage.module.css` | Add `.statBar`, `.statBarFill`, `.statBarValue` styles |

---

## Out of Scope

- Pre-fight training camp (300% temporary stat boost) — separate feature
- Training injuries
- Natural Talent earned through training (separate feature)
- Exp display on any page other than PlayerPage
