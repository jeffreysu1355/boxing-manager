# Roster Page — Design Spec

**Date:** 2026-04-19

## Overview

The Roster page lives under the Gym tab. It displays all boxers signed to the player's gym in a table with name, age, weight class, style, record, current status, and next scheduled fight. Clicking a boxer name navigates to the existing PlayerPage (`/player/:id`).

## Data Loading

Single bulk load on mount via `Promise.all`:

1. `getGym()` — for `gym.id` to filter boxers
2. `getAllBoxers()` — filter to `gymId === gym.id`; build `Map<number, Boxer>` for opponent name lookups
3. `getAllCalendarEvents()` — for next fight and training camp status
4. `getAllFights()` — build `Map<number, Fight>` for opponent lookup from fight records
5. `getAllFederations()` — build `Map<number, Federation>` for federation abbreviation

No per-boxer queries. All derivation happens client-side after load.

## Table Layout

Columns: **Name | Age | Weight Class | Style | Record | Status | Next Fight**

- **Name** — links to `/player/:id`
- **Age** — `boxer.age`
- **Weight Class** — capitalized (e.g. `welterweight` → `Welterweight`)
- **Style** — split on `-`, capitalize each word (e.g. `out-boxer` → `Out-Boxer`)
- **Record** — `wins-losses` (e.g. `5-2`), draws appended if any (e.g. `5-2-1`)
- **Status** — derived (see Status Logic below), rendered as a colored badge
- **Next Fight** — derived (see Next Fight Logic below)

Empty state: "No boxers on your roster yet."

## Status Logic

Injury takes priority over activity status:

1. If `boxer.injuries` has any entry with `recoveryDays > 0`:
   - Use the most severe injury (severity order: `severe > moderate > minor`)
   - Display: `"Injured (Severe, 8 days)"` / `"Injured (Moderate, 3 days)"` / `"Injured (Minor, 1 day)"`
   - Badge color: `var(--danger)` (#f44336)
2. Else if boxer has a future `training-camp` calendar event (where `event.date > today`):
   - Display: `"In Training Camp"`
   - Badge color: `var(--warning)` (#ff9800)
3. Else if boxer has a future `fight` calendar event (where `event.date > today`):
   - Display: `"Scheduled Fight"`
   - Badge color: `#2196f3` (blue — inline style or new CSS variable)
4. Else:
   - Display: `"Active"`
   - Badge color: `var(--success)` (#4caf50)

"Today" is compared using ISO date string comparison. Use `new Date().toISOString().slice(0, 10)` for the current date at load time.

## Next Fight Logic

1. Filter `calendarEvents` to `type === 'fight'` and `boxerIds` includes `boxer.id` and `event.date > today`
2. Sort by `event.date` ascending; take the first (soonest)
3. Look up the `Fight` record via `fightsMap.get(event.fightId)`
4. Find opponent: the other boxer id in `fight.boxerIds` (the one that isn't `boxer.id`); look up name via `boxersMap`
5. Abbreviate federation via `FEDERATION_ABBR` map (see below)
6. Format: `"May 3, 2026 vs. Marcus Webb (NABF)"`
7. If no future fight event: display `"—"`

Date formatting: use `new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`.

## Federation Abbreviations

```typescript
const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};
```

## CSS — `Roster.module.css`

Follows the same pattern as `Coaches.module.css`. New classes:

```css
.statusBadge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  color: #fff;
  /* background-color set inline based on status type */
}

.nextFight {
  color: var(--text-secondary);
  font-size: 12px;
}

.noFight {
  color: var(--text-muted);
}
```

Reuse from Coaches: `.page`, `.sectionTitle`, `.styleTag`, `.empty`, `.loading`.

## Files to Create/Modify

- **Modify** `src/pages/Gym/Roster.tsx` — full implementation (currently a stub)
- **Create** `src/pages/Gym/Roster.module.css` — styles

No data model changes. No store changes. No world gen changes.
