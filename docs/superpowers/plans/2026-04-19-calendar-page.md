# Calendar Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the League > Calendar page showing upcoming fights for gym boxers in a flat chronological table with date, boxer, opponent, federation, and title fight badge.

**Architecture:** Single bulk load on mount (gym, boxers, calendar events, fights, federations); all row derivation computed client-side. Two files: `Calendar.tsx` (logic + rendering) and `Calendar.module.css` (styles). No data model or store changes needed.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vitest, idb (IndexedDB)

---

## File Map

- **Modify:** `src/pages/League/Calendar.tsx` — replace stub with full implementation
- **Create:** `src/pages/League/Calendar.module.css` — scoped styles

---

### Task 1: Create `Calendar.module.css`

**Files:**
- Create: `src/pages/League/Calendar.module.css`

- [ ] **Step 1: Create the CSS file**

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

- [ ] **Step 2: Commit**

```bash
git add src/pages/League/Calendar.module.css
git commit -m "feat: add Calendar.module.css"
```

---

### Task 2: Implement helper functions (with tests)

The row-derivation logic is extracted as pure helpers so it can be unit-tested without IndexedDB.

**Files:**
- Modify: `src/pages/League/Calendar.tsx` — add exported helpers + stub component
- Create: `src/pages/League/Calendar.test.ts` — unit tests

- [ ] **Step 1: Write failing tests**

Create `src/pages/League/Calendar.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { deriveRows, formatDate } from './Calendar';
import type { Boxer, CalendarEvent, Fight, Federation } from '../../db/db';

// --- Fixtures ---

const makeBoxer = (id: number, gymId: number | null): Boxer => ({
  id,
  name: `Boxer ${id}`,
  age: 24,
  weightClass: 'welterweight',
  style: 'out-boxer',
  reputation: 'Unknown',
  gymId,
  federationId: 1,
  stats: {
    jab: 10, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
    headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
    timing: 10, adaptability: 10, discipline: 10,
    speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
  },
  naturalTalents: [],
  injuries: [],
  titles: [],
  record: [],
});

const gymBoxer = makeBoxer(1, 1);
const opponent = makeBoxer(2, null);

const gymBoxerIds = new Set<number>([1]);

const federation: Federation = { id: 1, name: 'North America Boxing Federation', prestige: 7 };
const federationsMap = new Map<number, Federation>([[1, federation]]);

const TODAY = '2026-04-19';

const makeFight = (id: number, overrides: Partial<Fight> = {}): Fight => ({
  id,
  date: '2026-05-01',
  federationId: 1,
  weightClass: 'welterweight',
  boxerIds: [1, 2],
  winnerId: null,
  method: 'Decision',
  finishingMove: null,
  round: null,
  time: null,
  isTitleFight: false,
  contractId: 1,
  ...overrides,
});

const makeEvent = (id: number, fightId: number, date: string, boxerIds: number[] = [1, 2]): CalendarEvent => ({
  id,
  type: 'fight',
  date,
  boxerIds,
  fightId,
});

// --- deriveRows ---

describe('deriveRows', () => {
  it('returns empty array when no events', () => {
    const rows = deriveRows([], new Map(), gymBoxerIds, boxersMap, federationsMap, TODAY);
    expect(rows).toHaveLength(0);
  });

  it('returns a row for a future fight involving a gym boxer', () => {
    const fight = makeFight(10);
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-05-01')];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0].gymBoxerId).toBe(1);
    expect(rows[0].opponentId).toBe(2);
    expect(rows[0].federationAbbr).toBe('NABF');
    expect(rows[0].isTitleFight).toBe(false);
    expect(rows[0].date).toBe('2026-05-01');
  });

  it('includes events on today', () => {
    const fight = makeFight(10, { date: TODAY });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, TODAY)];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(1);
  });

  it('excludes past events', () => {
    const fight = makeFight(10, { date: '2026-04-01' });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-04-01')];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(0);
  });

  it('excludes events not involving any gym boxer', () => {
    const fight = makeFight(10, { boxerIds: [2, 3] });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-05-01', [2, 3])];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(0);
  });

  it('skips orphaned events (fight not in fightsMap)', () => {
    const fightsMap = new Map<number, Fight>(); // empty
    const events = [makeEvent(1, 99, '2026-05-01')];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(0);
  });

  it('excludes non-fight calendar events', () => {
    const fight = makeFight(10);
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events: CalendarEvent[] = [{
      id: 1,
      type: 'training-camp',
      date: '2026-05-01',
      boxerIds: [1],
      fightId: 10,
    }];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(0);
  });

  it('sets isTitleFight correctly', () => {
    const fight = makeFight(10, { isTitleFight: true });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-05-01')];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows[0].isTitleFight).toBe(true);
  });

  it('sorts rows by date ascending', () => {
    const fight1 = makeFight(10, { date: '2026-06-01' });
    const fight2 = makeFight(11, { date: '2026-05-01' });
    const fightsMap = new Map<number, Fight>([[10, fight1], [11, fight2]]);
    const events = [
      makeEvent(1, 10, '2026-06-01'),
      makeEvent(2, 11, '2026-05-01'),
    ];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows[0].date).toBe('2026-05-01');
    expect(rows[1].date).toBe('2026-06-01');
  });

  it('uses unknown federation abbr when federation not in map', () => {
    const fight = makeFight(10, { federationId: 99 });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-05-01')];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows[0].federationAbbr).toBe('?');
  });

  it('sets opponentId to undefined when fight has only one boxer', () => {
    const fight = makeFight(10, { boxerIds: [1] });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-05-01', [1])];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows[0].opponentId).toBeUndefined();
  });
});

// --- formatDate ---

describe('formatDate', () => {
  it('formats an ISO date string correctly', () => {
    const result = formatDate('2026-05-03');
    expect(result).toMatch(/May 3, 2026/);
  });

  it('does not shift date due to UTC offset', () => {
    // '2026-01-01' should render as Jan 1, not Dec 31
    const result = formatDate('2026-01-01');
    expect(result).toMatch(/Jan(uary)? 1, 2026/);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm test -- src/pages/League/Calendar.test.ts
```

Expected: FAIL — `deriveRows` and `formatDate` not exported from `Calendar.tsx`.

- [ ] **Step 3: Replace `src/pages/League/Calendar.tsx` with helpers + stub**

```typescript
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { Boxer, CalendarEvent, Fight, Federation, FederationName } from '../../db/db';

// --- Constants ---

export const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};

// --- Types ---

export interface CalendarRow {
  eventId: number;
  date: string;           // ISO date string, used for sorting
  gymBoxerId: number;
  opponentId: number | undefined;
  federationAbbr: string;
  isTitleFight: boolean;
}

// --- Exported helpers ---

export function deriveRows(
  events: CalendarEvent[],
  fightsMap: Map<number, Fight>,
  gymBoxerIds: Set<number>,
  federationsMap: Map<number, Federation>,
  today: string
): CalendarRow[] {
  const rows: CalendarRow[] = [];

  for (const event of events) {
    if (event.type !== 'fight') continue;
    if (event.date < today) continue;

    const hasGymBoxer = event.boxerIds.some(id => gymBoxerIds.has(id));
    if (!hasGymBoxer) continue;

    const fight = fightsMap.get(event.fightId);
    if (!fight) continue;

    const gymBoxerId = event.boxerIds.find(id => gymBoxerIds.has(id))!;
    const opponentId = fight.boxerIds.find(id => id !== gymBoxerId);

    const federation = federationsMap.get(fight.federationId);
    const federationAbbr = federation
      ? (FEDERATION_ABBR[federation.name] ?? federation.name)
      : '?';

    rows.push({
      eventId: event.id!,
      date: event.date,
      gymBoxerId,
      opponentId,
      federationAbbr,
      isTitleFight: fight.isTitleFight,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Component stub ---

export default function Calendar() {
  return (
    <div>
      <PageHeader title="Calendar" subtitle="Upcoming fights for your gym members" />
      <p>Calendar will display here.</p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm test -- src/pages/League/Calendar.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/League/Calendar.tsx src/pages/League/Calendar.test.ts
git commit -m "feat: add Calendar helper functions with tests"
```

---

### Task 3: Implement full Calendar component UI

**Files:**
- Modify: `src/pages/League/Calendar.tsx` — replace stub with full React component

- [ ] **Step 1: Replace the entire file with the full implementation**

```typescript
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym } from '../../db/gymStore';
import { getAllBoxers } from '../../db/boxerStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllFights } from '../../db/fightStore';
import { getAllFederations } from '../../db/federationStore';
import type { Boxer, CalendarEvent, Fight, Federation, FederationName } from '../../db/db';
import styles from './Calendar.module.css';

// --- Constants ---

export const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};

// --- Types ---

export interface CalendarRow {
  eventId: number;
  date: string;
  gymBoxerId: number;
  opponentId: number | undefined;
  federationAbbr: string;
  isTitleFight: boolean;
}

// --- Exported helpers ---

export function deriveRows(
  events: CalendarEvent[],
  fightsMap: Map<number, Fight>,
  gymBoxerIds: Set<number>,
  federationsMap: Map<number, Federation>,
  today: string
): CalendarRow[] {
  const rows: CalendarRow[] = [];

  for (const event of events) {
    if (event.type !== 'fight') continue;
    if (event.date < today) continue;

    const hasGymBoxer = event.boxerIds.some(id => gymBoxerIds.has(id));
    if (!hasGymBoxer) continue;

    const fight = fightsMap.get(event.fightId);
    if (!fight) continue;

    const gymBoxerId = event.boxerIds.find(id => gymBoxerIds.has(id))!;
    const opponentId = fight.boxerIds.find(id => id !== gymBoxerId);

    const federation = federationsMap.get(fight.federationId);
    const federationAbbr = federation
      ? (FEDERATION_ABBR[federation.name] ?? federation.name)
      : '?';

    rows.push({
      eventId: event.id!,
      date: event.date,
      gymBoxerId,
      opponentId,
      federationAbbr,
      isTitleFight: fight.isTitleFight,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Component ---

export default function Calendar() {
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [boxersMap, setBoxersMap] = useState<Map<number, Boxer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gym, allBoxers, allEvents, allFights, allFederations] = await Promise.all([
        getGym(),
        getAllBoxers(),
        getAllCalendarEvents(),
        getAllFights(),
        getAllFederations(),
      ]);

      if (cancelled) return;

      const gymId = gym?.id ?? 1;
      const gymBoxerIds = new Set<number>(
        allBoxers.filter(b => b.gymId === gymId && b.id !== undefined).map(b => b.id!)
      );

      const bMap = new Map<number, Boxer>();
      for (const b of allBoxers) {
        if (b.id !== undefined) bMap.set(b.id, b);
      }

      const fMap = new Map<number, Fight>();
      for (const f of allFights) {
        if (f.id !== undefined) fMap.set(f.id, f);
      }

      const fedMap = new Map<number, Federation>();
      for (const fed of allFederations) {
        if (fed.id !== undefined) fedMap.set(fed.id, fed);
      }

      const derived = deriveRows(allEvents, fMap, gymBoxerIds, fedMap, today);

      setRows(derived);
      setBoxersMap(bMap);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [today]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Calendar" subtitle="Upcoming fights for your gym members" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Upcoming fights for your gym members" />
      <div className={styles.page}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No upcoming fights scheduled.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Boxer</th>
                <th>Opponent</th>
                <th>Federation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const gymBoxer = boxersMap.get(row.gymBoxerId);
                const opponent = row.opponentId !== undefined ? boxersMap.get(row.opponentId) : undefined;
                return (
                  <tr key={row.eventId}>
                    <td>{formatDate(row.date)}</td>
                    <td>
                      {gymBoxer
                        ? <Link to={`/player/${gymBoxer.id}`}>{gymBoxer.name}</Link>
                        : '—'}
                    </td>
                    <td>
                      {opponent
                        ? <Link to={`/player/${opponent.id}`}>{opponent.name}</Link>
                        : row.opponentId !== undefined
                          ? 'Unknown'
                          : '—'}
                    </td>
                    <td>{row.federationAbbr}</td>
                    <td>
                      {row.isTitleFight && (
                        <span className={styles.titleBadge}>Title Fight</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run all tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm test
```

Expected: all tests pass (Calendar.test.ts tests + all existing tests).

- [ ] **Step 3: Commit**

```bash
git add src/pages/League/Calendar.tsx
git commit -m "feat: implement Calendar page with upcoming fights table"
```
