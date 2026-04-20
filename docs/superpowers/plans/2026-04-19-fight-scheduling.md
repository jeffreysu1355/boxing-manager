# Fight Scheduling Implementation Plan (Sub-project 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Schedule page where the player picks a gym boxer, event slot, and opponent to create a fight — which then appears on the Calendar page.

**Architecture:** Add `FederationEvent` to the DB (v5 migration), seed 4 events per federation per year in world gen, build a two-panel Schedule page with pure helper functions tested in isolation, wire up a "Schedule Fight" button on the Roster, and add the new route/sidebar link.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vitest, idb (IndexedDB via `getDB()`)

---

## File Map

- **Create** `src/db/federationEventStore.ts` — CRUD for `federationEvents`
- **Create** `src/pages/League/Schedule.tsx` — page component + exported pure helpers
- **Create** `src/pages/League/Schedule.module.css` — scoped styles
- **Create** `src/pages/League/Schedule.test.ts` — unit tests for pure helpers
- **Modify** `src/db/db.ts` — add `FederationEvent` interface + v5 schema migration
- **Modify** `src/db/worldGen.ts` — add `generateFederationEvents(year, federationIds)` + call it
- **Modify** `src/routes.tsx` — add `/league/schedule` route
- **Modify** `src/components/Sidebar/Sidebar.tsx` — add Schedule link
- **Modify** `src/pages/Gym/Roster.tsx` — add "Schedule Fight" button per row

---

### Task 1: Add `FederationEvent` to DB schema (v5 migration)

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Write the failing test**

Create `src/db/db.test.ts` already exists — add a test block. Actually, db.test.ts tests schema version. Check its content first, then add:

Open `src/db/db.test.ts` and append this test:

```typescript
it('opens DB at version 5 with federationEvents store', async () => {
  const db = await getDB();
  expect(db.version).toBe(5);
  const storeNames = Array.from(db.objectStoreNames);
  expect(storeNames).toContain('federationEvents');
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/db/db.test.ts 2>&1
```

Expected: FAIL — version is 4, no `federationEvents` store.

- [ ] **Step 3: Add `FederationEvent` interface and v5 migration to `src/db/db.ts`**

After the existing `PpvNetwork` interface, add:

```typescript
export interface FederationEvent {
  id?: number;
  federationId: number;
  date: string;        // ISO date, e.g. '2026-03-14'
  name: string;        // e.g. 'NABF March 2026'
  fightIds: number[];  // fight ids on this card
}
```

In `BoxingManagerDBSchema`, add after `calendarEvents`:

```typescript
  federationEvents: {
    key: number;
    value: FederationEvent;
    indexes: { federationId: number; date: string };
  };
```

In `getDB()`, change the version from `4` to `5` and add a new migration block after `if (oldVersion < 4)`:

```typescript
      if (oldVersion < 5) {
        const fedEventStore = db.createObjectStore('federationEvents', {
          keyPath: 'id',
          autoIncrement: true,
        });
        fedEventStore.createIndex('federationId', 'federationId');
        fedEventStore.createIndex('date', 'date');
      }
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/db/db.test.ts 2>&1
```

Expected: PASS (all db tests green).

- [ ] **Step 5: Commit**

```bash
git add src/db/db.ts src/db/db.test.ts
git commit -m "feat: add FederationEvent to DB schema (v5)"
```

---

### Task 2: Create `federationEventStore.ts`

**Files:**
- Create: `src/db/federationEventStore.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/db/federationEventStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { closeAndResetDB } from './db';
import {
  getAllFederationEvents,
  getFederationEventsByFederation,
  putFederationEvent,
  updateFederationEventFights,
} from './federationEventStore';

beforeEach(async () => {
  await closeAndResetDB();
});

describe('putFederationEvent / getAllFederationEvents', () => {
  it('stores and retrieves a federation event', async () => {
    const id = await putFederationEvent({
      federationId: 1,
      date: '2026-03-14',
      name: 'NABF March 2026',
      fightIds: [],
    });
    expect(id).toBeGreaterThan(0);

    const all = await getAllFederationEvents();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('NABF March 2026');
    expect(all[0].fightIds).toEqual([]);
  });
});

describe('getFederationEventsByFederation', () => {
  it('returns only events for the given federation', async () => {
    await putFederationEvent({ federationId: 1, date: '2026-03-14', name: 'A', fightIds: [] });
    await putFederationEvent({ federationId: 2, date: '2026-04-01', name: 'B', fightIds: [] });

    const result = await getFederationEventsByFederation(1);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });
});

describe('updateFederationEventFights', () => {
  it('appends a fight id to an existing event', async () => {
    const id = await putFederationEvent({
      federationId: 1,
      date: '2026-03-14',
      name: 'NABF March 2026',
      fightIds: [10],
    });

    await updateFederationEventFights(id, 20);

    const all = await getAllFederationEvents();
    expect(all[0].fightIds).toEqual([10, 20]);
  });

  it('throws if event not found', async () => {
    await expect(updateFederationEventFights(999, 1)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/db/federationEventStore.test.ts 2>&1
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/db/federationEventStore.ts`**

```typescript
import { getDB, type FederationEvent } from './db';

export async function getFederationEvent(id: number): Promise<FederationEvent | undefined> {
  const db = await getDB();
  return db.get('federationEvents', id);
}

export async function getAllFederationEvents(): Promise<FederationEvent[]> {
  const db = await getDB();
  return db.getAll('federationEvents');
}

export async function getFederationEventsByFederation(federationId: number): Promise<FederationEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('federationEvents', 'federationId', federationId);
}

export async function getFederationEventsByDate(date: string): Promise<FederationEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('federationEvents', 'date', date);
}

export async function putFederationEvent(event: Omit<FederationEvent, 'id'> | FederationEvent): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = event as FederationEvent;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('federationEvents', record as FederationEvent);
}

export async function updateFederationEventFights(eventId: number, fightId: number): Promise<void> {
  const db = await getDB();
  const event = await db.get('federationEvents', eventId);
  if (!event) throw new Error(`FederationEvent ${eventId} not found`);
  await db.put('federationEvents', { ...event, fightIds: [...event.fightIds, fightId] });
}

export async function deleteFederationEvent(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('federationEvents', id);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/db/federationEventStore.test.ts 2>&1
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/db/federationEventStore.ts src/db/federationEventStore.test.ts
git commit -m "feat: add federationEventStore CRUD"
```

---

### Task 3: `generateFederationEvents` in worldGen

**Files:**
- Modify: `src/db/worldGen.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/db/worldGen.test.ts` (create if it doesn't exist):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { closeAndResetDB } from './db';
import { generateFederationEvents } from './worldGen';
import { getAllFederationEvents } from './federationEventStore';

beforeEach(async () => {
  await closeAndResetDB();
});

describe('generateFederationEvents', () => {
  it('generates 4 events per federation for the given year', async () => {
    // Pass a map of 2 federation ids
    const federationIds: Record<string, number> = { fed1: 1, fed2: 2 };
    await generateFederationEvents(2026, [1, 2]);

    const all = await getAllFederationEvents();
    expect(all).toHaveLength(8); // 4 per federation × 2 federations
  });

  it('each federation gets events spread across 4 quarters', async () => {
    await generateFederationEvents(2026, [1]);
    const events = await getAllFederationEvents();
    expect(events).toHaveLength(4);

    // All events should be in 2026
    for (const e of events) {
      expect(e.date.startsWith('2026')).toBe(true);
    }

    // Dates should all be different
    const dates = events.map(e => e.date);
    expect(new Set(dates).size).toBe(4);
  });

  it('events start with empty fightIds', async () => {
    await generateFederationEvents(2026, [1]);
    const events = await getAllFederationEvents();
    for (const e of events) {
      expect(e.fightIds).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/db/worldGen.test.ts 2>&1
```

Expected: FAIL — `generateFederationEvents` not exported.

- [ ] **Step 3: Add `generateFederationEvents` to `src/db/worldGen.ts`**

Add these constants near the top of the file (after the existing imports):

```typescript
import { putFederationEvent } from './federationEventStore';
```

Add this constant (map of federation id → abbreviation for naming):

```typescript
const FEDERATION_ABBR_MAP: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};
```

Add this function before `generateWorld`:

```typescript
// Quarter week offsets: week 10, 23, 36, 49 of the year (roughly Mar, Jun, Sep, Dec)
const QUARTER_WEEKS = [10, 23, 36, 49];

export async function generateFederationEvents(year: number, federationIds: { id: number; name: FederationName }[]): Promise<void> {
  for (const fed of federationIds) {
    const abbr = FEDERATION_ABBR_MAP[fed.name];
    // Each federation gets a small stagger offset (0–6 days) so events don't all land on the same day
    const stagger = Math.floor(Math.abs(fed.id * 13) % 7); // deterministic per federation

    for (const week of QUARTER_WEEKS) {
      const dayOfYear = week * 7 + stagger;
      const date = new Date(year, 0, dayOfYear); // Jan 1 + dayOfYear
      const isoDate = date.toISOString().slice(0, 10);
      const monthName = date.toLocaleString('en-US', { month: 'long' });
      const name = `${abbr} ${monthName} ${year}`;

      await putFederationEvent({
        federationId: fed.id,
        date: isoDate,
        name,
        fightIds: [],
      });
    }
  }
}
```

- [ ] **Step 4: Update `generateWorld` to call `generateFederationEvents`**

In `generateWorld`, after the federation seeding loop that builds `federationIds`, add step 8 at the bottom:

```typescript
  // 8. Generate federation event slots for current year
  const currentYear = new Date().getFullYear();
  const fedList = (Object.entries(federationIds) as [FederationName, number][]).map(
    ([name, id]) => ({ id, name })
  );
  await generateFederationEvents(currentYear, fedList);
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/db/worldGen.test.ts 2>&1
```

Expected: all tests pass.

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/db/worldGen.ts src/db/worldGen.test.ts
git commit -m "feat: generate 4 federation event slots per year in world gen"
```

---

### Task 4: Create `Schedule.module.css`

**Files:**
- Create: `src/pages/League/Schedule.module.css`

- [ ] **Step 1: Create the file**

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

- [ ] **Step 2: Commit**

```bash
git add src/pages/League/Schedule.module.css
git commit -m "feat: add Schedule.module.css"
```

---

### Task 5: Schedule page pure helpers + tests

These are pure functions exported from `Schedule.tsx` and unit-tested in isolation. The component will call them.

**Files:**
- Create: `src/pages/League/Schedule.tsx` (helpers + stub component only)
- Create: `src/pages/League/Schedule.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/pages/League/Schedule.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  matchupLabel,
  statAvg,
  reputationIndex,
  calcRecord,
  formatEventDate,
} from './Schedule';
import type { Boxer, BoxerStats, FightingStyle, ReputationLevel } from '../../db/db';

// --- Fixtures ---

function makeStats(overrides: Partial<BoxerStats> = {}): BoxerStats {
  return {
    jab: 10, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
    headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
    timing: 10, adaptability: 10, discipline: 10,
    speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
    ...overrides,
  };
}

// --- matchupLabel ---

describe('matchupLabel', () => {
  it('returns "Counters you" when opponent counters gym boxer', () => {
    // out-boxer is countered by swarmer
    expect(matchupLabel('out-boxer', 'swarmer')).toBe('Counters you');
  });

  it('returns "You counter" when gym boxer counters opponent', () => {
    // swarmer counters out-boxer
    expect(matchupLabel('swarmer', 'out-boxer')).toBe('You counter');
  });

  it('returns "Neutral" for non-counter matchup', () => {
    expect(matchupLabel('out-boxer', 'slugger')).toBe('Neutral');
  });

  it('covers all four style relationships', () => {
    expect(matchupLabel('swarmer', 'slugger')).toBe('Counters you');
    expect(matchupLabel('slugger', 'counterpuncher')).toBe('Counters you');
    expect(matchupLabel('counterpuncher', 'out-boxer')).toBe('Counters you');
    expect(matchupLabel('slugger', 'swarmer')).toBe('You counter');
  });
});

// --- statAvg ---

describe('statAvg', () => {
  it('returns offense average (5 stats)', () => {
    const stats = makeStats({ jab: 20, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10 });
    expect(statAvg(stats, 'offense')).toBeCloseTo(12, 1);
  });

  it('returns defense average (4 stats)', () => {
    const stats = makeStats({ headMovement: 20, bodyMovement: 10, guard: 10, positioning: 10 });
    expect(statAvg(stats, 'defense')).toBeCloseTo(12.5, 1);
  });

  it('returns physical average (5 stats)', () => {
    const stats = makeStats({ speed: 20, power: 10, endurance: 10, recovery: 10, toughness: 10 });
    expect(statAvg(stats, 'physical')).toBeCloseTo(12, 1);
  });
});

// --- reputationIndex ---

describe('reputationIndex', () => {
  it('returns 0 for Unknown', () => {
    expect(reputationIndex('Unknown')).toBe(0);
  });

  it('returns 9 for All-Time Great', () => {
    expect(reputationIndex('All-Time Great')).toBe(9);
  });

  it('returns correct index for Contender', () => {
    expect(reputationIndex('Contender')).toBe(4);
  });
});

// --- calcRecord ---

describe('calcRecord', () => {
  it('returns wins-losses with no draws', () => {
    const record = [
      { result: 'win' as const, opponentName: 'A', method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
      { result: 'loss' as const, opponentName: 'B', method: 'Decision', finishingMove: null, round: 12, time: '3:00', federation: 'NABF', date: '2026-02-01' },
    ];
    expect(calcRecord(record)).toBe('1-1');
  });

  it('appends draws when present', () => {
    const record = [
      { result: 'win' as const, opponentName: 'A', method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
      { result: 'draw' as const, opponentName: 'C', method: 'Draw', finishingMove: null, round: 12, time: '3:00', federation: 'NABF', date: '2026-03-01' },
    ];
    expect(calcRecord(record)).toBe('1-0-1');
  });
});

// --- formatEventDate ---

describe('formatEventDate', () => {
  it('formats ISO date correctly', () => {
    expect(formatEventDate('2026-05-03')).toMatch(/May 3, 2026/);
  });

  it('does not shift date due to UTC offset', () => {
    expect(formatEventDate('2026-01-01')).toMatch(/Jan(uary)? 1, 2026/);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/pages/League/Schedule.test.ts 2>&1
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/pages/League/Schedule.tsx` with helpers + stub**

```typescript
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { BoxerStats, FightingStyle, FightRecord, ReputationLevel } from '../../db/db';

// --- Constants ---

export const STYLE_COUNTERS: Record<FightingStyle, FightingStyle> = {
  'out-boxer': 'swarmer',
  'swarmer': 'slugger',
  'slugger': 'counterpuncher',
  'counterpuncher': 'out-boxer',
};

const REPUTATION_INDEX: Record<ReputationLevel, number> = {
  'Unknown': 0,
  'Local Star': 1,
  'Rising Star': 2,
  'Respectable Opponent': 3,
  'Contender': 4,
  'Championship Caliber': 5,
  'Nationally Ranked': 6,
  'World Class Fighter': 7,
  'International Superstar': 8,
  'All-Time Great': 9,
};

// --- Pure helpers ---

export function matchupLabel(
  gymStyle: FightingStyle,
  opponentStyle: FightingStyle
): 'Counters you' | 'Neutral' | 'You counter' {
  if (STYLE_COUNTERS[opponentStyle] === gymStyle) return 'Counters you';
  if (STYLE_COUNTERS[gymStyle] === opponentStyle) return 'You counter';
  return 'Neutral';
}

export function statAvg(stats: BoxerStats, category: 'offense' | 'defense' | 'physical'): number {
  if (category === 'offense') {
    return (stats.jab + stats.cross + stats.leadHook + stats.rearHook + stats.uppercut) / 5;
  }
  if (category === 'defense') {
    return (stats.headMovement + stats.bodyMovement + stats.guard + stats.positioning) / 4;
  }
  return (stats.speed + stats.power + stats.endurance + stats.recovery + stats.toughness) / 5;
}

export function reputationIndex(rep: ReputationLevel): number {
  return REPUTATION_INDEX[rep];
}

export function calcRecord(record: FightRecord[]): string {
  const wins = record.filter(r => r.result === 'win').length;
  const losses = record.filter(r => r.result === 'loss').length;
  const draws = record.filter(r => r.result === 'draw').length;
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

export function formatEventDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Component stub ---

export default function Schedule() {
  return (
    <div>
      <PageHeader title="Schedule" subtitle="Schedule upcoming fights for your boxers" />
      <p>Schedule will display here.</p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/pages/League/Schedule.test.ts 2>&1
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/League/Schedule.tsx src/pages/League/Schedule.test.ts
git commit -m "feat: add Schedule helper functions with tests"
```

---

### Task 6: Wire up route and sidebar

**Files:**
- Modify: `src/routes.tsx`
- Modify: `src/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Add route to `src/routes.tsx`**

Add the import at the top:

```typescript
import Schedule from './pages/League/Schedule';
```

In the league children array, add after the calendar route:

```typescript
{ path: 'schedule', element: <Schedule /> },
```

The league children section should look like:

```typescript
children: [
  { index: true, element: <Navigate to="standings" replace /> },
  { path: 'standings', element: <Standings /> },
  { path: 'calendar', element: <Calendar /> },
  { path: 'schedule', element: <Schedule /> },
],
```

- [ ] **Step 2: Add link to `src/components/Sidebar/Sidebar.tsx`**

In `sidebarConfig['/league']`, add `{ to: '/league/schedule', label: 'Schedule' }` after the calendar link:

```typescript
'/league': [
  {
    label: 'League',
    links: [
      { to: '/league/standings', label: 'Standings' },
      { to: '/league/calendar', label: 'Calendar' },
      { to: '/league/schedule', label: 'Schedule' },
    ],
  },
],
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes.tsx src/components/Sidebar/Sidebar.tsx
git commit -m "feat: add /league/schedule route and sidebar link"
```

---

### Task 7: Full Schedule component UI

**Files:**
- Modify: `src/pages/League/Schedule.tsx` — replace stub with full implementation

- [ ] **Step 1: Replace the stub component with the full implementation**

Replace the entire `src/pages/League/Schedule.tsx` file with:

```typescript
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym } from '../../db/gymStore';
import { getAllBoxers } from '../../db/boxerStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllFederationEvents, putFederationEvent, updateFederationEventFights } from '../../db/federationEventStore';
import { getAllFederations } from '../../db/federationStore';
import { getAllFights, putFight } from '../../db/fightStore';
import { putFightContract } from '../../db/fightContractStore';
import { putCalendarEvent } from '../../db/calendarEventStore';
import { getAllTitles } from '../../db/titleStore';
import type {
  Boxer,
  CalendarEvent,
  Federation,
  FederationEvent,
  FederationName,
  FightingStyle,
  FightRecord,
  ReputationLevel,
  BoxerStats,
  Title,
} from '../../db/db';
import styles from './Schedule.module.css';

// --- Constants ---

export const STYLE_COUNTERS: Record<FightingStyle, FightingStyle> = {
  'out-boxer': 'swarmer',
  'swarmer': 'slugger',
  'slugger': 'counterpuncher',
  'counterpuncher': 'out-boxer',
};

const REPUTATION_INDEX: Record<ReputationLevel, number> = {
  'Unknown': 0,
  'Local Star': 1,
  'Rising Star': 2,
  'Respectable Opponent': 3,
  'Contender': 4,
  'Championship Caliber': 5,
  'Nationally Ranked': 6,
  'World Class Fighter': 7,
  'International Superstar': 8,
  'All-Time Great': 9,
};

export const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};

// --- Pure helpers ---

export function matchupLabel(
  gymStyle: FightingStyle,
  opponentStyle: FightingStyle
): 'Counters you' | 'Neutral' | 'You counter' {
  if (STYLE_COUNTERS[opponentStyle] === gymStyle) return 'Counters you';
  if (STYLE_COUNTERS[gymStyle] === opponentStyle) return 'You counter';
  return 'Neutral';
}

export function statAvg(stats: BoxerStats, category: 'offense' | 'defense' | 'physical'): number {
  if (category === 'offense') {
    return (stats.jab + stats.cross + stats.leadHook + stats.rearHook + stats.uppercut) / 5;
  }
  if (category === 'defense') {
    return (stats.headMovement + stats.bodyMovement + stats.guard + stats.positioning) / 4;
  }
  return (stats.speed + stats.power + stats.endurance + stats.recovery + stats.toughness) / 5;
}

export function reputationIndex(rep: ReputationLevel): number {
  return REPUTATION_INDEX[rep];
}

export function calcRecord(record: FightRecord[]): string {
  const wins = record.filter(r => r.result === 'win').length;
  const losses = record.filter(r => r.result === 'loss').length;
  const draws = record.filter(r => r.result === 'draw').length;
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

export function formatEventDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Component ---

interface LoadedData {
  gymBoxers: Boxer[];
  allBoxers: Map<number, Boxer>;
  gymBoxerIds: Set<number>;
  events: CalendarEvent[];
  federationEvents: FederationEvent[];
  federationsMap: Map<number, Federation>;
  titlesMap: Map<number, Title>; // federationId+weightClass → Title (keyed by federation event id lookup)
  titles: Title[];
  today: string;
}

export default function Schedule() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [selectedBoxerId, setSelectedBoxerId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<number | null>(null);
  const [isTitleFight, setIsTitleFight] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gym, allBoxersList, allEvents, allFedEvents, allFederations, allFights, allTitles] = await Promise.all([
        getGym(),
        getAllBoxers(),
        getAllCalendarEvents(),
        getAllFederationEvents(),
        getAllFederations(),
        getAllFights(),
        getAllTitles(),
      ]);

      if (cancelled) return;

      const gymId = gym?.id;
      const gymBoxerIds = new Set<number>(
        allBoxersList.filter(b => b.gymId === gymId && b.id !== undefined).map(b => b.id!)
      );

      const allBoxersMap = new Map<number, Boxer>();
      for (const b of allBoxersList) {
        if (b.id !== undefined) allBoxersMap.set(b.id, b);
      }

      const federationsMap = new Map<number, Federation>();
      for (const fed of allFederations) {
        if (fed.id !== undefined) federationsMap.set(fed.id, fed);
      }

      const titlesMap = new Map<number, Title>();
      for (const t of allTitles) {
        if (t.id !== undefined) titlesMap.set(t.id, t);
      }

      // Ensure future events: if any federation has fewer than 2 future events, generate next year
      const nextYear = new Date().getFullYear() + 1;
      const futureByFed = new Map<number, number>();
      for (const fe of allFedEvents) {
        if (fe.date >= today) {
          futureByFed.set(fe.federationId, (futureByFed.get(fe.federationId) ?? 0) + 1);
        }
      }

      let needsRefresh = false;
      for (const fed of allFederations) {
        if (fed.id === undefined) continue;
        const count = futureByFed.get(fed.id) ?? 0;
        if (count < 2) {
          // Generate 4 quarterly events for nextYear for this federation
          const abbr = FEDERATION_ABBR[fed.name] ?? fed.name;
          const stagger = Math.floor(Math.abs(fed.id * 13) % 7);
          for (const week of [10, 23, 36, 49]) {
            const dayOfYear = week * 7 + stagger;
            const date = new Date(nextYear, 0, dayOfYear);
            const isoDate = date.toISOString().slice(0, 10);
            const monthName = date.toLocaleString('en-US', { month: 'long' });
            await putFederationEvent({
              federationId: fed.id,
              date: isoDate,
              name: `${abbr} ${monthName} ${nextYear}`,
              fightIds: [],
            });
          }
          needsRefresh = true;
        }
      }

      const finalFedEvents = needsRefresh ? await getAllFederationEvents() : allFedEvents;

      setData({
        gymBoxers: allBoxersList.filter(b => gymBoxerIds.has(b.id!)),
        allBoxers: allBoxersMap,
        gymBoxerIds,
        events: allEvents,
        federationEvents: finalFedEvents,
        federationsMap,
        titlesMap,
        titles: allTitles,
        today,
      });

      // Pre-select boxer from query param
      const paramBoxerId = searchParams.get('boxerId');
      if (paramBoxerId) {
        const id = parseInt(paramBoxerId, 10);
        if (gymBoxerIds.has(id)) setSelectedBoxerId(id);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [today, searchParams]);

  async function handleConfirm() {
    if (!data || selectedBoxerId === null || selectedEventId === null || selectedOpponentId === null) return;

    const fedEvent = data.federationEvents.find(e => e.id === selectedEventId);
    if (!fedEvent || fedEvent.id === undefined) return;

    const gymBoxer = data.allBoxers.get(selectedBoxerId);
    const opponent = data.allBoxers.get(selectedOpponentId);
    if (!gymBoxer || !opponent || gymBoxer.id === undefined || opponent.id === undefined) return;

    setSubmitting(true);

    // 1. Create FightContract stub
    const contractId = await putFightContract({
      boxerId: gymBoxer.id,
      opponentId: opponent.id,
      federationId: fedEvent.federationId,
      weightClass: gymBoxer.weightClass,
      guaranteedPayout: 0,
      ppvSplitPercentage: 0,
      ppvNetworkId: null,
      isTitleFight,
      status: 'accepted',
      counterOfferPayout: null,
      scheduledDate: fedEvent.date,
      fightId: null,
    });

    // 2. Create Fight
    const fightId = await putFight({
      date: fedEvent.date,
      federationId: fedEvent.federationId,
      weightClass: gymBoxer.weightClass,
      boxerIds: [gymBoxer.id, opponent.id],
      winnerId: null,
      method: 'Decision',
      finishingMove: null,
      round: null,
      time: null,
      isTitleFight,
      contractId,
    });

    // 3. Update contract with fightId — re-put with id
    await putFightContract({
      id: contractId,
      boxerId: gymBoxer.id,
      opponentId: opponent.id,
      federationId: fedEvent.federationId,
      weightClass: gymBoxer.weightClass,
      guaranteedPayout: 0,
      ppvSplitPercentage: 0,
      ppvNetworkId: null,
      isTitleFight,
      status: 'accepted',
      counterOfferPayout: null,
      scheduledDate: fedEvent.date,
      fightId,
    });

    // 4. Create CalendarEvents (one per boxer)
    await putCalendarEvent({ type: 'fight', date: fedEvent.date, boxerIds: [gymBoxer.id], fightId });
    await putCalendarEvent({ type: 'fight', date: fedEvent.date, boxerIds: [opponent.id], fightId });

    // 5. Update FederationEvent.fightIds
    await updateFederationEventFights(fedEvent.id, fightId);

    navigate('/league/calendar');
  }

  if (data === null) {
    return (
      <div className={styles.page}>
        <PageHeader title="Schedule" subtitle="Schedule upcoming fights for your boxers" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  const selectedBoxer = selectedBoxerId !== null ? data.allBoxers.get(selectedBoxerId) : undefined;
  const selectedEvent = selectedEventId !== null ? data.federationEvents.find(e => e.id === selectedEventId) : undefined;
  const selectedOpponent = selectedOpponentId !== null ? data.allBoxers.get(selectedOpponentId) : undefined;

  // Build set of boxer ids already booked on the selected event
  const bookedOnEvent = new Set<number>();
  if (selectedEvent) {
    for (const fightId of selectedEvent.fightIds) {
      const fightEvents = data.events.filter(e => e.fightId === fightId);
      for (const fe of fightEvents) {
        for (const bid of fe.boxerIds) bookedOnEvent.add(bid);
      }
    }
  }

  // Determine if title fight checkbox should show
  let canBeTitleFight = false;
  if (selectedBoxer && selectedOpponent && selectedEvent) {
    for (const title of data.titles) {
      if (title.federationId === selectedEvent.federationId && title.weightClass === selectedBoxer.weightClass) {
        if (
          title.currentChampionId === selectedBoxer.id ||
          title.currentChampionId === selectedOpponent.id
        ) {
          canBeTitleFight = true;
          break;
        }
      }
    }
  }

  // Group future federation events by federation
  const futureEvents = data.federationEvents
    .filter(e => e.date >= data.today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const eventsByFed = new Map<number, FederationEvent[]>();
  for (const fe of futureEvents) {
    const list = eventsByFed.get(fe.federationId) ?? [];
    list.push(fe);
    eventsByFed.set(fe.federationId, list);
  }

  // Opponents: same weight class, not in gym, not already booked on this event
  let opponents: Boxer[] = [];
  if (selectedBoxer) {
    opponents = Array.from(data.allBoxers.values()).filter(b =>
      b.id !== undefined &&
      !data.gymBoxerIds.has(b.id) &&
      b.weightClass === selectedBoxer.weightClass
    );
  }

  // Group opponents by federation
  const opponentsByFed = new Map<number, Boxer[]>();
  for (const opp of opponents) {
    if (opp.federationId === null) continue;
    const list = opponentsByFed.get(opp.federationId) ?? [];
    list.push(opp);
    opponentsByFed.set(opp.federationId, list);
  }

  const canConfirm = selectedBoxerId !== null && selectedEventId !== null && selectedOpponentId !== null && !submitting;

  return (
    <div className={styles.page}>
      <PageHeader title="Schedule" subtitle="Schedule upcoming fights for your boxers" />

      {/* Panel 1: Pick boxer (shown if no boxer selected) */}
      {selectedBoxerId === null && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>Select Boxer</div>
          {data.gymBoxers.length === 0 ? (
            <p className={styles.empty}>No boxers on your roster.</p>
          ) : (
            data.gymBoxers.map(boxer => {
              if (boxer.id === undefined) return null;
              const hasScheduledFight = data.events.some(
                e => e.type === 'fight' && e.boxerIds.includes(boxer.id!) && e.date >= data.today
              );
              const hasInjury = boxer.injuries.some(i => i.recoveryDays > 0);
              const disabled = hasScheduledFight || hasInjury;
              return (
                <div
                  key={boxer.id}
                  className={styles.eventRow}
                  style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                  onClick={() => { if (!disabled) setSelectedBoxerId(boxer.id!); }}
                >
                  <strong>{boxer.name}</strong>
                  {' '}
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {boxer.weightClass.charAt(0).toUpperCase() + boxer.weightClass.slice(1)}
                    {' · '}
                    {calcRecord(boxer.record)}
                    {hasScheduledFight && ' · Fight scheduled'}
                    {hasInjury && ' · Injured'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Panel 2: Event + opponent (shown when boxer is selected) */}
      {selectedBoxerId !== null && selectedBoxer && (
        <>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Scheduling for: <strong>{selectedBoxer.name}</strong>
            {' '}
            <button
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }}
              onClick={() => { setSelectedBoxerId(null); setSelectedEventId(null); setSelectedOpponentId(null); }}
            >
              Change
            </button>
          </div>

          <div className={styles.panels}>
            {/* Left: event slots */}
            <div className={styles.panel}>
              <div className={styles.panelTitle}>Select Event</div>
              {futureEvents.length === 0 ? (
                <p className={styles.empty}>No upcoming events.</p>
              ) : (
                Array.from(eventsByFed.entries()).map(([fedId, fedEvents]) => {
                  const fed = data.federationsMap.get(fedId);
                  return (
                    <div key={fedId} className={styles.federationGroup}>
                      <div className={styles.federationGroupLabel}>
                        {fed ? (FEDERATION_ABBR[fed.name] ?? fed.name) : `Federation ${fedId}`}
                      </div>
                      {fedEvents.map(fe => {
                        const isSelected = fe.id === selectedEventId;
                        return (
                          <div
                            key={fe.id}
                            className={`${styles.eventRow} ${isSelected ? styles.eventRowSelected : ''}`}
                            onClick={() => { setSelectedEventId(fe.id!); setSelectedOpponentId(null); }}
                          >
                            <div><strong>{fe.name}</strong></div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {formatEventDate(fe.date)}
                              {' · '}
                              {fe.fightIds.length === 0 ? 'No fights yet' : `${fe.fightIds.length} fight${fe.fightIds.length === 1 ? '' : 's'}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Right: opponents */}
            <div className={styles.panel}>
              <div className={styles.panelTitle}>Select Opponent</div>
              {selectedEventId === null ? (
                <p className={styles.empty}>Select an event first.</p>
              ) : opponents.length === 0 ? (
                <p className={styles.empty}>No available opponents.</p>
              ) : (
                Array.from(opponentsByFed.entries()).map(([fedId, fedOpponents]) => {
                  const fed = data.federationsMap.get(fedId);
                  return (
                    <div key={fedId} className={styles.federationGroup}>
                      <div className={styles.federationGroupLabel}>
                        {fed ? (FEDERATION_ABBR[fed.name] ?? fed.name) : `Federation ${fedId}`}
                      </div>
                      {fedOpponents.map(opp => {
                        if (opp.id === undefined) return null;
                        const isBooked = bookedOnEvent.has(opp.id);
                        const isSelected = opp.id === selectedOpponentId;
                        const label = matchupLabel(selectedBoxer.style, opp.style);
                        const labelClass = label === 'Counters you'
                          ? styles.matchupCounter
                          : label === 'You counter'
                          ? styles.matchupYou
                          : styles.matchupNeutral;

                        return (
                          <div
                            key={opp.id}
                            className={`${styles.opponentRow} ${isSelected ? styles.opponentRowSelected : ''} ${isBooked ? styles.opponentRowBooked : ''}`}
                            onClick={() => { if (!isBooked) setSelectedOpponentId(opp.id!); }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <strong>{opp.name}</strong>
                              <span className={labelClass}>{label}</span>
                            </div>
                            <div className={styles.statCompare}>
                              {opp.reputation} · {calcRecord(opp.record)}
                              {isBooked && ' · Booked'}
                            </div>
                            <div className={styles.statCompare}>
                              Off {statAvg(opp.stats, 'offense').toFixed(1)} / Def {statAvg(opp.stats, 'defense').toFixed(1)} / Phy {statAvg(opp.stats, 'physical').toFixed(1)}
                              {' vs '}
                              {statAvg(selectedBoxer.stats, 'offense').toFixed(1)} / {statAvg(selectedBoxer.stats, 'defense').toFixed(1)} / {statAvg(selectedBoxer.stats, 'physical').toFixed(1)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}

              {/* Title fight checkbox */}
              {canBeTitleFight && (
                <label style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center', paddingTop: '8px' }}>
                  <input
                    type="checkbox"
                    checked={isTitleFight}
                    onChange={e => setIsTitleFight(e.target.checked)}
                  />
                  Make this a title fight
                </label>
              )}
            </div>
          </div>

          <div className={styles.confirmRow}>
            <button
              className={styles.confirmButton}
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {submitting ? 'Scheduling…' : 'Confirm Fight'}
            </button>
            {selectedOpponent && selectedEvent && (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {selectedBoxer.name} vs. {selectedOpponent.name} — {formatEventDate(selectedEvent.date)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run all tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/pages/League/Schedule.tsx
git commit -m "feat: implement Schedule page with two-panel fight scheduling UI"
```

---

### Task 8: Add "Schedule Fight" button to Roster

**Files:**
- Modify: `src/pages/Gym/Roster.tsx`

- [ ] **Step 1: Add `useNavigate` import and a new column**

Add `useNavigate` to the react-router import at the top of `src/pages/Gym/Roster.tsx`:

```typescript
import { useNavigate } from 'react-router';
```

Inside the `Roster` component, add the navigate hook after the state declarations:

```typescript
const navigate = useNavigate();
```

- [ ] **Step 2: Add "Schedule" column header**

In the `<thead>` row, add a final `<th>` after "Next Fight":

```typescript
<th></th>
```

- [ ] **Step 3: Add "Schedule Fight" button cell**

In the `<tbody>` row map, after the Next Fight `<td>`, add:

```typescript
<td>
  {status.label !== 'Scheduled Fight' && !boxer.injuries.some(i => i.recoveryDays > 0) && (
    <button
      className={styles.scheduleBtn}
      onClick={() => navigate(`/league/schedule?boxerId=${boxer.id}`)}
    >
      Schedule Fight
    </button>
  )}
</td>
```

- [ ] **Step 4: Add `.scheduleBtn` to `src/pages/Gym/Roster.module.css`**

Append at the end of the file:

```css
.scheduleBtn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  border-radius: 3px;
  cursor: pointer;
}
```

- [ ] **Step 5: Run all tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Gym/Roster.tsx src/pages/Gym/Roster.module.css
git commit -m "feat: add Schedule Fight button to Roster rows"
```

---

## Self-Review

**Spec coverage:**
- ✅ FederationEvent data model (Task 1)
- ✅ federationEventStore CRUD (Task 2)
- ✅ generateFederationEvents in world gen (Task 3)
- ✅ Auto-generation on Schedule page load — in Task 7 component useEffect
- ✅ Schedule.module.css (Task 4)
- ✅ matchupLabel, statAvg, reputationIndex, calcRecord, formatEventDate helpers (Task 5)
- ✅ Route + sidebar (Task 6)
- ✅ Full Schedule UI with two panels, confirm flow, title fight checkbox (Task 7)
- ✅ Roster "Schedule Fight" button (Task 8)
- ✅ Confirm creates Fight, FightContract, CalendarEvents, updates FederationEvent (Task 7)
- ✅ Navigate to /league/calendar on success (Task 7)

**Type consistency check:**
- `FederationEvent.fightIds` — used consistently as `number[]` across all tasks
- `generateFederationEvents(year, federationIds: { id: number; name: FederationName }[])` — consistent across Task 3 and Task 7 (where inline logic mirrors the same algorithm)
- `putFightContract` — takes `Omit<FightContract, 'id'> | FightContract` matching existing store pattern
- `getAllTitles` — imported from `titleStore`; need to verify this export exists

**Note for implementer:** Verify `getAllTitles` is exported from `src/db/titleStore.ts` before Task 7. If not, add it following the same pattern as `getAllFederations`.
