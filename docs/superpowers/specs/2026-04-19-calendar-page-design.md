# Calendar Page — Design Spec

**Date:** 2026-04-19

## Overview

The Calendar page lives under the League tab. It shows a flat chronological list of upcoming fight events for all gym boxers. Each row shows the date, which gym boxer is fighting, their opponent, the federation, and a "Title Fight" badge when applicable.

## Data Loading

Single bulk load on mount via `Promise.all`:

1. `getGym()` — for `gym.id` to identify gym boxers
2. `getAllBoxers()` — build `Map<number, Boxer>` for name lookups; derive gym boxer id set by filtering to `gymId === gym.id`
3. `getAllCalendarEvents()` — filter to `type === 'fight'`, at least one `boxerIds` entry is in the gym roster set, and `event.date >= today`
4. `getAllFights()` — build `Map<number, Fight>` for `isTitleFight`, `federationId`, and opponent id lookup
5. `getAllFederations()` — build `Map<number, Federation>` for federation name abbreviation

"Today" = `new Date().toISOString().slice(0, 10)`, captured once at mount via `useState` initializer.

All derivation is client-side after load. No per-event queries.

## Row Derivation

For each qualifying calendar event:
- **gymBoxer** — the `boxerIds` entry whose id is in the gym roster set
- **opponent** — the other entry in `fight.boxerIds` (may be absent if only one boxer listed)
- **federation** — looked up via `federationsMap.get(fight.federationId)`, abbreviated via `FEDERATION_ABBR`
- **isTitleFight** — `fight.isTitleFight`

If `fight` is not found in `fightsMap` (orphaned event), skip the row entirely.

Events are sorted by `event.date` ascending before rendering.

## Table Layout

Columns: **Date | Boxer | Opponent | Federation | (title badge)**

- **Date** — `new Date(year, month-1, day)` constructed from ISO parts to avoid UTC offset shift; formatted with `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`
- **Boxer** — gym boxer name, `<Link to="/player/:id">`
- **Opponent** — opponent name, `<Link to="/player/:id">` if found in boxers map; plain text `"Unknown"` if not
- **Federation** — abbreviated federation name (see FEDERATION_ABBR below)
- **Title badge column** — `<span className={styles.titleBadge}>Title Fight</span>` if `isTitleFight`, empty cell otherwise

Empty state: "No upcoming fights scheduled."
Loading state: "Loading…"

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

## CSS — `Calendar.module.css`

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.empty {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}

.loading {
  color: var(--text-secondary);
  font-style: italic;
}

.titleBadge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 2px;
  padding: 1px 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

The `.titleBadge` style matches the `.championBadge` pattern from `Standings.module.css`.

## Files to Create/Modify

- **Modify** `src/pages/League/Calendar.tsx` — replace stub with full implementation
- **Create** `src/pages/League/Calendar.module.css` — styles

No data model changes. No store changes.
