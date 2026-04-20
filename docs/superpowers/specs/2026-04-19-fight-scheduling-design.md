# Fight Scheduling — Design Spec (Sub-project 1)

**Date:** 2026-04-19

## Overview

Sub-project 1 adds fight scheduling: a player can pick a gym boxer, choose an opponent from a list grouped by federation, pick a federation event slot, and confirm the fight. The fight is stored and appears on the Calendar. No contract negotiation or PPV in this sub-project.

Entry points:
- New **Schedule** subtab in the League tab (`/league/schedule`)
- **Schedule Fight** button on each Roster row (navigates to `/league/schedule?boxerId=<id>`)

---

## Data Model Changes

### New: `FederationEvent`

```typescript
export interface FederationEvent {
  id?: number;
  federationId: number;
  date: string;      // ISO date, e.g. '2026-03-14'
  name: string;      // e.g. 'NABF March 2026'
  fightIds: number[]; // fight ids on this card (order not meaningful — derived at render)
}
```

DB schema bump: **v4 → v5**. New object store `federationEvents` with indexes on `federationId` and `date`.

### `Fight.contractId` relaxed

`contractId` is currently required (`number`). Sub-project 2 adds real contracts; for Sub-project 1 scheduling creates a minimal `FightContract` stub (status: `'accepted'`, payout: 0, ppv: 0) and its id is stored as `contractId`.

No other existing models change.

---

## Federation Event Generation

### On first launch (world gen)

`generateWorld()` already called on empty DB. Add a `generateFederationEvents(year: number)` function that generates 4 events per federation for the given year:

- Dates spread roughly quarterly: weeks 10, 23, 36, 49 of the year
- Each federation gets a small offset (0–6 days) per quarter to stagger events on the calendar
- Event name format: `'<ABBR> <Month> <Year>'` e.g. `'NABF March 2026'`
- `fightIds: []` initially (fights are added when scheduled)

Called from `generateWorld()` with `new Date().getFullYear()`.

### Auto-generation

When the Schedule page loads, check if any federation has fewer than 2 future events. If so, call `generateFederationEvents(nextYear)` for that federation. This keeps the calendar populated without manual intervention.

Check function signature:
```typescript
async function ensureFutureEvents(federationId: number, today: string): Promise<void>
```
Generates next-year events for `federationId` if fewer than 2 future events exist.

---

## Schedule Page (`/league/schedule`)

### Two-panel layout

**Panel 1 — Pick boxer** (skipped if `?boxerId=<id>` is valid)

- List of gym boxers: name, weight class, record, current status
- Disabled if boxer already has a scheduled fight (status "Scheduled Fight") or active injury
- Clicking a boxer advances to Panel 2

**Panel 2 — Pick event slot + opponent**

Split into two columns:

#### Left column: Event slots

- Header: "Select Event"
- Grouped by federation (federation name as section header)
- Each event row: date (formatted), event name, fights already booked (e.g. "2 fights")
- Only shows events with `date >= today`
- Clicking an event slot selects it (highlighted)

#### Right column: Opponents

Shown only after an event slot is selected.

- Header: "Select Opponent"
- Filters: same weight class as selected boxer, excludes gym boxers, excludes boxers already booked on the selected event slot
- Grouped by federation (boxer's `federationId`)
- Each opponent row shows:
  - Name, reputation, record (`wins-losses` or `wins-losses-draws`)
  - Style matchup indicator: `"Counters you"` / `"Neutral"` / `"You counter"` based on rock-paper-scissors table
  - Three stat averages: Offense avg (jab+cross+leadHook+rearHook+uppercut / 5), Defense avg (headMovement+bodyMovement+guard+positioning / 4), Physical avg (speed+power+endurance+recovery+toughness / 5) — shown as two columns: opponent value vs gym boxer value
  - If already booked on another event: greyed out with label "Booked"

#### Title fight checkbox

Below the opponent list, shown if:
- The selected event's federation matches a title where the champion is the opponent OR the gym boxer holds the title for that weight class

Checkbox label: `"Make this a title fight"`. Unchecked by default.

### Confirm button

Enabled when: boxer selected + event slot selected + opponent selected.

On confirm:
1. Create `FightContract`: `{ boxerId: gymBoxer.id, opponentId: opponent.id, federationId: event.federationId, weightClass: boxer.weightClass, guaranteedPayout: 0, ppvSplitPercentage: 0, ppvNetworkId: null, isTitleFight, status: 'accepted', counterOfferPayout: null, scheduledDate: event.date, fightId: null }`
2. Create `Fight`: `{ date: event.date, federationId: event.federationId, weightClass: boxer.weightClass, boxerIds: [gymBoxer.id, opponent.id], winnerId: null, method: 'Decision', finishingMove: null, round: null, time: null, isTitleFight, contractId: contract.id }`
3. Update `FightContract.fightId = fight.id`
4. Create two `CalendarEvent` records (one per boxer): `{ type: 'fight', date: event.date, boxerIds: [boxerId], fightId: fight.id }`
5. Update `FederationEvent.fightIds` to append `fight.id`
6. Navigate to `/league/calendar` on success

### Card position (derived, not stored)

When rendering a `FederationEvent` card (future use), fights are sorted by the max reputation index of their participants. The reputation order index is:
```
Unknown=0, Local Star=1, Rising Star=2, Respectable Opponent=3,
Contender=4, Championship Caliber=5, Nationally Ranked=6,
World Class Fighter=7, International Superstar=8, All-Time Great=9
```
Highest pair index = main event. Title fights are always elevated to at least co-main.

---

## Roster Page Changes

Each boxer row gets a **"Schedule Fight"** button:
- Only rendered when boxer has no future fight scheduled AND no active injury (`recoveryDays > 0`)
- Uses `useNavigate`: navigates to `/league/schedule?boxerId=<id>`
- Styled as a small secondary button (no new CSS variable needed — use `var(--accent)` border + transparent background)

---

## Navigation Changes

### `Sidebar.tsx`

Add `{ to: '/league/schedule', label: 'Schedule' }` to the League section, after Calendar:
```
Standings | Calendar | Schedule
```

### `routes.tsx`

Add `{ path: 'schedule', element: <Schedule /> }` to the League children.

---

## New Files

- `src/pages/League/Schedule.tsx` — Schedule page component + helpers
- `src/pages/League/Schedule.module.css` — scoped styles
- `src/pages/League/Schedule.test.ts` — unit tests for pure helpers
- `src/db/federationEventStore.ts` — CRUD for `federationEvents`

## Modified Files

- `src/db/db.ts` — add `FederationEvent` interface + schema v5 migration
- `src/db/worldGen.ts` — call `generateFederationEvents` for current year
- `src/routes.tsx` — add `/league/schedule` route
- `src/components/Sidebar/Sidebar.tsx` — add Schedule link
- `src/pages/Gym/Roster.tsx` — add "Schedule Fight" button per row

---

## Style Matchup Table

```typescript
const STYLE_COUNTERS: Record<FightingStyle, FightingStyle> = {
  'out-boxer': 'swarmer',       // out-boxer is countered by swarmer
  'swarmer': 'slugger',
  'slugger': 'counterpuncher',
  'counterpuncher': 'out-boxer',
};

function matchupLabel(gymStyle: FightingStyle, opponentStyle: FightingStyle): 'Counters you' | 'Neutral' | 'You counter' {
  if (STYLE_COUNTERS[opponentStyle] === gymStyle) return 'Counters you';
  if (STYLE_COUNTERS[gymStyle] === opponentStyle) return 'You counter';
  return 'Neutral';
}
```

---

## CSS — `Schedule.module.css`

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panelTitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.eventRow {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}

.eventRow:hover {
  border-color: var(--accent);
}

.eventRowSelected {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.03);
}

.opponentRow {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}

.opponentRow:hover {
  border-color: var(--accent);
}

.opponentRowSelected {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.03);
}

.opponentRowBooked {
  opacity: 0.4;
  cursor: not-allowed;
}

.matchupCounter { color: var(--danger); font-size: 11px; }
.matchupNeutral  { color: var(--text-muted); font-size: 11px; }
.matchupYou      { color: var(--success); font-size: 11px; }

.statCompare {
  font-size: 11px;
  color: var(--text-secondary);
}

.confirmRow {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 8px;
}

.confirmButton {
  padding: 6px 16px;
  background: var(--accent);
  color: #000;
  border: none;
  border-radius: 3px;
  font-weight: 600;
  cursor: pointer;
}

.confirmButton:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.scheduleBtn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  border-radius: 3px;
  cursor: pointer;
}

.federationGroup {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.federationGroupLabel {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding-top: 8px;
}

.loading {
  color: var(--text-secondary);
  font-style: italic;
}

.empty {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}
```
