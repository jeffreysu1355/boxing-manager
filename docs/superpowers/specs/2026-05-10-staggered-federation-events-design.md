# Staggered Federation Events & Schedule Fight Display

## Overview

Spread federation events across the year so a boxer can fight roughly every 2 weeks by cycling through different federations. IBF retains its prestigious quarterly cadence. The Schedule Fight page section headers switch from abbreviations to full federation names.

## Event Schedule

Each federation holds 4 events per year. Events are assigned fixed week offsets so the calendar has an event approximately every 2 weeks.

| Federation | Week Offsets | Approx. Months |
|---|---|---|
| International Boxing Federation | 10, 23, 36, 49 | Mar, Jun, Sep, Dec |
| North America Boxing Federation | 4, 17, 30, 43 | Jan, Apr, Jul, Oct |
| European Boxing Federation | 6, 19, 32, 45 | Feb, May, Aug, Nov |
| South America Boxing Federation | 8, 21, 34 | Feb, May, Aug |
| African Boxing Federation | 12, 25, 38 | Mar, Jun, Sep |
| Asia Boxing Federation | 15, 28, 41, 2 | Apr, Jul, Oct, Jan |
| Oceania Boxing Federation | 18, 31, 44, 5 | May, Aug, Nov, Feb |

Total: 26 events/year. SABF and ABF hold 3 events instead of 4 (lower prestige federations). AsBF week 2 and OBF week 5 fall early in the year — they are included in the table for documentation but skipped at runtime if the week number falls outside the current year's bounds (no wrapping).

IBF events land between regional clusters, reinforcing its prestige via spacing.

## Implementation

### 1. Replace QUARTER_WEEKS with per-federation week table

In `src/db/worldGen.ts`, replace the shared `QUARTER_WEEKS = [10, 23, 36, 49]` constant with a per-federation lookup keyed by `FederationName`:

```typescript
const FEDERATION_WEEKS: Record<FederationName, number[]> = {
  'International Boxing Federation':  [10, 23, 36, 49],
  'North America Boxing Federation':  [4, 17, 30, 43],
  'European Boxing Federation':       [6, 19, 32, 45],
  'South America Boxing Federation':  [8, 21, 34],
  'African Boxing Federation':        [12, 25, 38],
  'Asia Boxing Federation':           [15, 28, 41, 2],
  'Oceania Boxing Federation':        [18, 31, 44, 5],
};
```

The event generation loop uses `FEDERATION_WEEKS[federation.name]` instead of `QUARTER_WEEKS`. Week numbers greater than 52 are skipped — no wrapping into the next year.

### 2. Update dynamic event generation in Schedule.tsx

`Schedule.tsx` has a second copy of the event generation logic (the "auto-generate when fewer than 2 future events" useEffect). Update it to use the same `FEDERATION_WEEKS` table. Extract `FEDERATION_WEEKS` to a shared constants file (e.g. `src/constants/federations.ts`) so worldGen.ts and Schedule.tsx both import from one place rather than duplicating.

### 3. Centralize FEDERATION_ABBR

`FEDERATION_ABBR` is currently defined in three places (worldGen.ts, Schedule.tsx, Calendar.tsx). Move it to `src/constants/federations.ts` alongside `FEDERATION_WEEKS` and import it everywhere.

### 4. Schedule Fight page section headers

In `Schedule.tsx`, the federation event group section header currently renders the abbreviation (`FEDERATION_ABBR[federation.name]`). Change it to render `federation.name` (the full name). Individual event row labels (e.g. "NABF March 2026") stay as abbreviations — no change needed there since event names are stored with abbreviations.

## Scope

- No changes to `FederationEvent` schema — date field already handles any week offset.
- No changes to Calendar.tsx display — abbreviations stay in table rows.
- No changes to fight simulation, contracts, or title logic.
- Existing saved games will not have retroactively staggered events; only newly generated events (on new game or when Schedule.tsx auto-generates future events) will use the new schedule.

## Files Changed

- `src/db/worldGen.ts` — replace QUARTER_WEEKS with FEDERATION_WEEKS lookup
- `src/pages/League/Schedule.tsx` — update auto-gen logic, update section header to full name, import from constants
- `src/pages/League/Calendar.tsx` — import FEDERATION_ABBR from constants
- `src/constants/federations.ts` — new file: exports FEDERATION_WEEKS and FEDERATION_ABBR
