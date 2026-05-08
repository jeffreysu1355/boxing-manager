# Training Camp Stat Boost — Design Spec

**Date:** 2026-05-07  
**Status:** Approved

---

## Overview

Players can put a boxer into a training camp before a scheduled fight to earn a temporary stat boost. The boost scales with how many days the boxer has been in camp, maxing out at 50% of current stat values after a full 60-day camp. The boost applies only to the coach's specialty stats, lasts only for the next scheduled fight, and reverts automatically after that fight resolves (or when the fight day passes without the fight being played).

Opponent (NPC) boxers in player fights also receive a reputation-based fixed boost to their style stats, simulating pre-fight preparation without requiring coach assignment.

---

## Data Model

### `Boxer.tempStatBoost` (new optional field)

```ts
tempStatBoost?: {
  stats: Partial<BoxerStats>;  // delta values (not multipliers)
  expiresOnFightId: number;    // cleared after this fight resolves
}
```

- Optional field on existing `Boxer` interface — no DB version bump required
- Existing records without this field return `undefined` (treated as no boost)
- Written just before the fight is simmed; cleared immediately after

### `CalendarEvent` — no changes

The existing schema already supports training camps:
- `type: 'training-camp'`
- `date` — camp start date (ISO)
- `endDate` — fight date (ISO)
- `fightId` — the fight being prepped for
- `boxerIds` — single-element array with the boxer's ID

`intensityLevel` remains on the type but is unused by this feature.

---

## Boost Calculation

### Player boxers — `computeTrainingCampBoost`

New function in `src/lib/training.ts`.

**Inputs:**
- `boxer: Boxer`
- `coach: Coach`
- `campStartDate: string` (ISO)
- `fightDate: string` (ISO — also the camp end date)
- `currentDate: string` (ISO — today, when the fight is being simmed)

**Steps:**

1. `totalDays` = days from campStart to fightDate, capped at 60
2. `trainedDays` = days from campStart to currentDate, capped at `totalDays`
3. Boost curve (last 14 days of a 60-day camp contribute 20% of the max boost):
   - `earlyDays` = min(trainedDays, totalDays − 14) → maps 0→46 days to 0→80% of max
   - `lateDays` = max(0, trainedDays − (totalDays − 14)) → maps 0→14 days to 0→20% of max
   - `boostFraction` = (earlyDays / 46) × 0.80 + (lateDays / 14) × 0.20
4. For each stat in `STYLE_STATS[coach.style]`:
   - `cap` = 25 if boxer has natural talent for that stat, else 20
   - `boostDelta` = floor(stat × 0.50 × boostFraction)
   - Clamp: `boostDelta` = min(boostDelta, cap − stat)
5. Returns `Partial<BoxerStats>` of deltas

**Example:** jab = 10, 60-day camp → boostFraction = 1.0 → boostDelta = floor(10 × 0.5 × 1.0) = 5 → effective jab = 15

### Opponent (NPC) boxers — reputation-based fixed boost

Applied to all stats in `STYLE_STATS[boxer.style]` using the same cap rules:

| Reputation | Boost % |
|---|---|
| Unknown | 0% |
| Local Star | 5% |
| Rising Star | 10% |
| Respectable Opponent | 15% |
| Contender | 20% |
| Championship Caliber | 25% |
| Nationally Ranked | 30% |
| World Class Fighter | 35% |
| International Superstar | 40% |
| All-Time Great | 45% |

This boost is computed inline at fight time (not stored) and only applies to fights involving a player boxer. NPC-vs-NPC fights are unaffected.

---

## Fight Integration

### Before simulation

For each gym boxer in the upcoming fight:
1. Look up the `training-camp` CalendarEvent where `fightId` matches and `boxerIds` includes the boxer
2. Find the assigned coach for the boxer
3. If a camp event and coach exist, call `computeTrainingCampBoost(boxer, coach, camp.date, camp.endDate, currentDate)`
4. Write `boxer.tempStatBoost = { stats: boostDeltas, expiresOnFightId: fightId }` to DB
5. Pass a **boosted copy** of the boxer to `simulateFight` (base stats + deltas applied inline; the persisted boxer is not modified beyond `tempStatBoost`)

For the opponent (NPC) boxer:
1. Compute reputation-based boost inline
2. Pass a boosted copy to `simulateFight` — not persisted

### After simulation

In `applyFightResult`:
- Clear `tempStatBoost` from both boxers if `expiresOnFightId` matches the resolved fight

### Fight-day expiry without a fight

In `runTraining` (called during time sim in `TopNav.tsx`):
- After advancing the date, scan gym boxers for any `tempStatBoost` whose `expiresOnFightId` references a fight whose date ≤ newDate (i.e. the fight day has passed)
- Clear `tempStatBoost` from those boxers

---

## UI — Roster Page

### "Start Training Camp" button

Shown on a Roster table row when ALL of:
- Boxer has a scheduled future fight (a `fight` CalendarEvent exists with `date > today`)
- No active `training-camp` CalendarEvent exists for that fight
- Boxer has no active injuries

### On click

Opens an inline form on the row:
- **Start date** field — pre-filled with today's date; must be before fight date
- **"Start Camp"** confirm button

On confirm:
- Creates a `training-camp` CalendarEvent: `{ type: 'training-camp', date: startDate, endDate: fightDate, fightId, boxerIds: [boxerId] }`
- Button changes to **"Cancel Camp"** which deletes the CalendarEvent

### Boost display

When a boxer's status is "In Training Camp", show the current projected boost % alongside the status badge (e.g. `In Training Camp · +32%`). Computed from today vs camp start/end — display only, no DB write.

---

## Testing

### Unit tests — `src/lib/training.test.ts`

New `computeTrainingCampBoost` tests:
- 0 days trained → all deltas are 0
- 46 days trained (end of early segment) → boostFraction ≈ 0.80
- 60 days trained → boostFraction = 1.0; stat 10 → delta 5
- Stat at cap (20, no talent) → delta clamped to 0
- Stat with natural talent (24) → delta clamped so result ≤ 25
- Opponent reputation boost: Unknown = 0%, All-Time Great = 45% of style stats

### Manual verification

- Boosted stats used in fight sim for player boxers
- `tempStatBoost` cleared from DB after fight resolves
- `tempStatBoost` cleared when fight day passes without play
- "Start Training Camp" button appears/disappears correctly
- Boost % display on Roster updates as time advances
