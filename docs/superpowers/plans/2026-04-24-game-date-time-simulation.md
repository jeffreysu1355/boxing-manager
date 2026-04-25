# Game Date & Time Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted game date starting at 2026-01-01, display it in the TopNav, and let the player simulate forward in time (1 week, 1 month, next event) with fight-day stops.

**Architecture:** `currentDate` is added to the `Gym` type and stored in IndexedDB (schema v7). A pure `simForward()` helper computes the new date and detects fight-day stops. The TopNav reads the gym date and renders a Play dropdown that calls sim actions and saves the new date back. All components that previously derived "today" from `new Date()` are updated to read from the gym record instead.

**Tech Stack:** React 18, TypeScript, Vitest, idb (IndexedDB), fake-indexeddb (tests)

---

## File Map

| File | Change |
|------|--------|
| `src/db/db.ts` | Add `currentDate: string` to `Gym` interface; bump DB to v7 with migration |
| `src/db/gymStore.ts` | No changes needed — `saveGym` already handles arbitrary Gym fields |
| `src/db/gymStore.test.ts` | Add tests for `currentDate` field persistence |
| `src/db/worldGen.ts` | Set `currentDate: '2026-01-01'` when creating the gym |
| `src/lib/simTime.ts` | Create: pure `simForward()` function + `nextEventDate()` helper |
| `src/lib/simTime.test.ts` | Create: full unit tests for sim logic |
| `src/components/TopNav/TopNav.tsx` | Add date display + Play dropdown |
| `src/components/TopNav/TopNav.module.css` | Add styles for date display and dropdown |
| `src/pages/League/Calendar.tsx` | Read `currentDate` from gym instead of `new Date()` |
| `src/pages/League/Schedule.tsx` | Read `currentDate` from gym instead of `new Date()` |

---

### Task 1: Add `currentDate` to `Gym` type and DB schema (v7)

**Files:**
- Modify: `src/db/db.ts`
- Modify: `src/db/db.test.ts`

The `Gym` interface gains `currentDate: string`. The DB version bumps from 6 to 7. The v7 migration is a no-op (existing gyms without `currentDate` will have `undefined` — runtime code treats `undefined` as `'2026-01-01'`).

- [ ] **Step 1: Write the failing test**

In `src/db/db.test.ts`, add at the bottom (inside the `describe` block):

```typescript
  it('opens DB at version 7 with currentDate field support on gym', async () => {
    const db = await getDB();
    expect(db.version).toBe(7);
  });
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/db/db.test.ts
```

Expected: FAIL — `expect(6).toBe(7)`

- [ ] **Step 3: Update `Gym` interface and DB version in `src/db/db.ts`**

Change the `Gym` interface (currently at line 150):

```typescript
export interface Gym {
  id?: number;
  name: string;
  level: number;
  balance: number;
  rosterIds: number[];
  coachIds: number[];
  currentDate: string; // ISO date, e.g. '2026-01-01'
}
```

Change the `openDB` call version from `6` to `7` (currently at line 278):

```typescript
  dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 7, {
```

Add the v7 migration block after the existing `if (oldVersion < 6)` block (currently at line 355):

```typescript
      if (oldVersion < 7) {
        // currentDate added to Gym; existing records without this field
        // will return undefined — runtime code defaults to '2026-01-01'
      }
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/db/db.test.ts
```

Expected: All tests PASS. The version assertion now expects 7.

- [ ] **Step 5: Commit**

```bash
git add src/db/db.ts src/db/db.test.ts
git commit -m "feat: add currentDate to Gym type, bump DB to v7"
```

---

### Task 2: Set `currentDate` in world generation and gym store tests

**Files:**
- Modify: `src/db/worldGen.ts`
- Modify: `src/db/gymStore.test.ts`

World gen sets the initial date. The gymStore tests are updated to include `currentDate` in the base gym fixture so tests match the updated type.

- [ ] **Step 1: Update `worldGen.ts` to include `currentDate`**

In `src/db/worldGen.ts`, find the `saveGym` call (around line 522):

```typescript
  await saveGym({
    name: 'My Gym',
    level: 1,
    balance: 500_000_000,
    rosterIds: [],
    coachIds: [],
  });
```

Replace with:

```typescript
  await saveGym({
    name: 'My Gym',
    level: 1,
    balance: 500_000_000,
    rosterIds: [],
    coachIds: [],
    currentDate: '2026-01-01',
  });
```

- [ ] **Step 2: Update `gymStore.test.ts` base fixture and add currentDate test**

In `src/db/gymStore.test.ts`, update the `baseGym` constant:

```typescript
const baseGym: Omit<Gym, 'id'> = {
  name: 'Champions Gym',
  level: 1,
  balance: 10000,
  rosterIds: [],
  coachIds: [],
  currentDate: '2026-01-01',
};
```

Then add a new test inside the `describe` block:

```typescript
  it('saveGym persists and retrieves currentDate', async () => {
    await saveGym(baseGym);
    const gym = await getGym();
    expect(gym?.currentDate).toBe('2026-01-01');
  });

  it('saveGym updates currentDate', async () => {
    await saveGym(baseGym);
    const created = await getGym();
    await saveGym({ ...created!, currentDate: '2026-03-15' });
    const updated = await getGym();
    expect(updated?.currentDate).toBe('2026-03-15');
  });
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/db/gymStore.test.ts src/db/worldGen.test.ts
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/db/worldGen.ts src/db/gymStore.test.ts
git commit -m "feat: initialize currentDate in world gen; add gymStore date tests"
```

---

### Task 3: Pure sim logic — `simForward()` and `nextEventDate()`

**Files:**
- Create: `src/lib/simTime.ts`
- Create: `src/lib/simTime.test.ts`

This is a pure module with no React or DB dependencies. It takes current state as parameters and returns the new date + any stop event.

- [ ] **Step 1: Write the tests first**

Create `src/lib/simTime.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { addDays, nextEventDate, simForward } from './simTime';
import type { CalendarEvent } from '../db/db';

// --- addDays ---

describe('addDays', () => {
  it('adds 7 days to a date', () => {
    expect(addDays('2026-01-01', 7)).toBe('2026-01-08');
  });

  it('crosses month boundaries', () => {
    expect(addDays('2026-01-28', 7)).toBe('2026-02-04');
  });

  it('crosses year boundaries', () => {
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('adds 21 days (1 month)', () => {
    expect(addDays('2026-01-01', 21)).toBe('2026-01-22');
  });

  it('adds 0 days returns same date', () => {
    expect(addDays('2026-06-15', 0)).toBe('2026-06-15');
  });
});

// --- nextEventDate ---

const makeEvent = (date: string, boxerIds: number[]): CalendarEvent => ({
  id: 1,
  type: 'fight',
  date,
  boxerIds,
  fightId: 1,
});

describe('nextEventDate', () => {
  const gymBoxerIds = new Set([10, 20]);

  it('returns undefined when no events exist', () => {
    expect(nextEventDate('2026-01-01', [], gymBoxerIds)).toBeUndefined();
  });

  it('returns undefined when all events are in the past', () => {
    const events = [makeEvent('2025-12-01', [10])];
    expect(nextEventDate('2026-01-01', events, gymBoxerIds)).toBeUndefined();
  });

  it('returns undefined when no events belong to gym boxers', () => {
    const events = [makeEvent('2026-03-01', [99])];
    expect(nextEventDate('2026-01-01', events, gymBoxerIds)).toBeUndefined();
  });

  it('returns the earliest future event date for a gym boxer', () => {
    const events = [
      makeEvent('2026-06-01', [10]),
      makeEvent('2026-03-01', [20]),
    ];
    expect(nextEventDate('2026-01-01', events, gymBoxerIds)).toBe('2026-03-01');
  });

  it('ignores events on the current date (must be strictly after)', () => {
    const events = [makeEvent('2026-01-01', [10])];
    expect(nextEventDate('2026-01-01', events, gymBoxerIds)).toBeUndefined();
  });

  it('returns an event one day after current date', () => {
    const events = [makeEvent('2026-01-02', [10])];
    expect(nextEventDate('2026-01-01', events, gymBoxerIds)).toBe('2026-01-02');
  });
});

// --- simForward ---

describe('simForward', () => {
  const gymBoxerIds = new Set([10, 20]);

  it('sim 1 week with no events advances exactly 7 days', () => {
    const result = simForward('2026-01-01', 7, [], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-08');
    expect(result.stoppedAt).toBeNull();
  });

  it('sim 1 month (21 days) with no events advances exactly 21 days', () => {
    const result = simForward('2026-01-01', 21, [], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-22');
    expect(result.stoppedAt).toBeNull();
  });

  it('stops at a fight event within the sim window', () => {
    const fightEvent = makeEvent('2026-01-05', [10]);
    const result = simForward('2026-01-01', 7, [fightEvent], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-05');
    expect(result.stoppedAt).toBe(fightEvent);
  });

  it('does not stop at an event beyond the sim window', () => {
    const fightEvent = makeEvent('2026-01-15', [10]);
    const result = simForward('2026-01-01', 7, [fightEvent], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-08');
    expect(result.stoppedAt).toBeNull();
  });

  it('does not stop at event on the current date', () => {
    const fightEvent = makeEvent('2026-01-01', [10]);
    const result = simForward('2026-01-01', 7, [fightEvent], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-08');
    expect(result.stoppedAt).toBeNull();
  });

  it('stops at earliest event when multiple events in window', () => {
    const events = [
      makeEvent('2026-01-07', [10]),
      makeEvent('2026-01-04', [20]),
    ];
    const result = simForward('2026-01-01', 7, events, gymBoxerIds);
    expect(result.newDate).toBe('2026-01-04');
    expect(result.stoppedAt).toBe(events[1]);
  });

  it('ignores events not belonging to gym boxers', () => {
    const fightEvent = makeEvent('2026-01-05', [99]);
    const result = simForward('2026-01-01', 7, [fightEvent], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-08');
    expect(result.stoppedAt).toBeNull();
  });

  it('sim to next event (days=0) uses nextEventDate as target', () => {
    // days=0 means "sim to next event"; handled by caller passing nextEventDate result
    // simForward with days=0 just returns current date with no stop
    const result = simForward('2026-01-01', 0, [], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-01');
    expect(result.stoppedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/simTime.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `src/lib/simTime.ts`**

```bash
mkdir -p /Users/jefsu/Documents/workspace/boxing-manager/src/lib
```

Create `src/lib/simTime.ts`:

```typescript
import type { CalendarEvent } from '../db/db';

export interface SimResult {
  newDate: string;
  stoppedAt: CalendarEvent | null;
}

/**
 * Returns the ISO date string that is `days` days after `isoDate`.
 * Uses local calendar arithmetic to avoid timezone issues.
 */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Finds the earliest CalendarEvent date strictly after `currentDate`
 * that belongs to at least one gym boxer.
 * Returns undefined if no such event exists.
 */
export function nextEventDate(
  currentDate: string,
  events: CalendarEvent[],
  gymBoxerIds: Set<number>
): string | undefined {
  let earliest: string | undefined;
  for (const event of events) {
    if (event.date <= currentDate) continue;
    if (!event.boxerIds.some(id => gymBoxerIds.has(id))) continue;
    if (earliest === undefined || event.date < earliest) {
      earliest = event.date;
    }
  }
  return earliest;
}

/**
 * Simulates time forward by `days` days from `currentDate`.
 *
 * If a fight CalendarEvent for a gym boxer falls within (currentDate, targetDate],
 * stops at that event's date instead of the full target.
 *
 * Returns { newDate, stoppedAt } where stoppedAt is the CalendarEvent that
 * caused the stop, or null if the full sim window was traversed.
 */
export function simForward(
  currentDate: string,
  days: number,
  events: CalendarEvent[],
  gymBoxerIds: Set<number>
): SimResult {
  const targetDate = addDays(currentDate, days);

  let stoppedAt: CalendarEvent | null = null;
  let stoppedDate: string | null = null;

  for (const event of events) {
    if (event.date <= currentDate) continue;
    if (event.date > targetDate) continue;
    if (!event.boxerIds.some(id => gymBoxerIds.has(id))) continue;

    if (stoppedDate === null || event.date < stoppedDate) {
      stoppedDate = event.date;
      stoppedAt = event;
    }
  }

  return {
    newDate: stoppedDate ?? targetDate,
    stoppedAt,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/simTime.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/simTime.ts src/lib/simTime.test.ts
git commit -m "feat: add pure simForward/nextEventDate/addDays time sim helpers"
```

---

### Task 4: TopNav — date display + Play dropdown

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`
- Modify: `src/components/TopNav/TopNav.module.css`

The TopNav reads `currentDate` from the gym, exposes a Play dropdown with three actions (sim 1 week, sim 1 month, sim to next event), and saves the new date back to the gym on each action. When the sim stops on a fight event, a banner appears below the dropdown.

The TopNav must be a client component that loads gym data. It uses `useState` + `useEffect` to load the gym + all calendar events once on mount, then updates on sim actions.

- [ ] **Step 1: Replace `src/components/TopNav/TopNav.tsx`**

```typescript
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import { getGym, saveGym } from '../../db/gymStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllBoxers } from '../../db/boxerStore';
import { simForward, nextEventDate, addDays } from '../../lib/simTime';
import type { CalendarEvent, Gym } from '../../db/db';
import styles from './TopNav.module.css';

const tabs = [
  { to: '/', label: 'Dashboard' },
  { to: '/league', label: 'League' },
  { to: '/gym', label: 'Gym' },
  { to: '/players', label: 'Players' },
  { to: '/tools', label: 'Tools' },
];

function formatGameDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TopNav() {
  const [gym, setGym] = useState<Gym | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [gymBoxerIds, setGymBoxerIds] = useState<Set<number>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [fightStop, setFightStop] = useState<CalendarEvent | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getGym(), getAllCalendarEvents(), getAllBoxers()]).then(
      ([g, evts, boxers]) => {
        setGym(g ?? null);
        setEvents(evts);
        const gymId = g?.id ?? 1;
        const ids = new Set(
          boxers
            .filter(b => b.gymId === gymId && b.id !== undefined)
            .map(b => b.id!)
        );
        setGymBoxerIds(ids);
      }
    );
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSim(days: number | 'next') {
    if (!gym) return;
    setDropdownOpen(false);

    const currentDate = gym.currentDate ?? '2026-01-01';
    let result;

    if (days === 'next') {
      const nextDate = nextEventDate(currentDate, events, gymBoxerIds);
      const target = nextDate ?? addDays(currentDate, 7);
      result = simForward(currentDate, 0, [], gymBoxerIds);
      // For "next event", we sim directly to the target date
      // Check if that target date itself is a fight event
      const fightAtTarget = nextDate
        ? events.find(
            e => e.date === nextDate && e.boxerIds.some(id => gymBoxerIds.has(id))
          ) ?? null
        : null;
      result = { newDate: target, stoppedAt: fightAtTarget };
    } else {
      result = simForward(currentDate, days, events, gymBoxerIds);
    }

    const updated: Gym = { ...gym, currentDate: result.newDate };
    await saveGym(updated);
    setGym(updated);
    setFightStop(result.stoppedAt);
  }

  const currentDate = gym?.currentDate ?? '2026-01-01';

  return (
    <div className={styles.topNavWrapper}>
      <nav className={styles.topNav}>
        <span className={styles.brand}>Boxing Manager</span>

        <div className={styles.playArea} ref={dropdownRef}>
          <span className={styles.dateDisplay}>{formatGameDate(currentDate)}</span>
          <button
            className={styles.playBtn}
            onClick={() => setDropdownOpen(o => !o)}
          >
            Play ▾
          </button>
          {dropdownOpen && (
            <div className={styles.dropdown}>
              <button className={styles.dropdownItem} onClick={() => handleSim(7)}>
                Sim 1 Week
              </button>
              <button className={styles.dropdownItem} onClick={() => handleSim(21)}>
                Sim 1 Month
              </button>
              <button className={styles.dropdownItem} onClick={() => handleSim('next')}>
                Sim to Next Event
              </button>
            </div>
          )}
        </div>

        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              isActive ? styles.activeTab : styles.tab
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {fightStop && (
        <div className={styles.fightBanner}>
          <strong>Fight Day!</strong> A scheduled fight has arrived on{' '}
          {formatGameDate(fightStop.date)}.{' '}
          <button
            className={styles.dismissBtn}
            onClick={() => setFightStop(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/components/TopNav/TopNav.module.css`**

```css
.topNavWrapper {
  grid-area: nav;
  display: flex;
  flex-direction: column;
}

.topNav {
  display: flex;
  align-items: center;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
  gap: 4px;
}

.brand {
  font-weight: 700;
  font-size: 14px;
  color: var(--accent);
  margin-right: 16px;
  white-space: nowrap;
}

.playArea {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 16px;
}

.dateDisplay {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.playBtn {
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 600;
  background-color: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.playBtn:hover {
  opacity: 0.85;
}

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background-color: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  min-width: 180px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dropdownItem {
  display: block;
  width: 100%;
  padding: 10px 16px;
  font-size: 13px;
  text-align: left;
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
}

.dropdownItem:hover {
  background-color: var(--bg-hover);
}

.tab {
  padding: 8px 14px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px 4px 0 0;
  transition: color 0.15s, background-color 0.15s;
}

.tab:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.activeTab {
  composes: tab;
  color: var(--text-primary);
  background-color: var(--bg-surface);
}

.fightBanner {
  background-color: var(--accent);
  color: #fff;
  padding: 8px 16px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dismissBtn {
  margin-left: auto;
  padding: 3px 10px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 3px;
  cursor: pointer;
}

.dismissBtn:hover {
  background: rgba(255, 255, 255, 0.3);
}
```

- [ ] **Step 3: Update `src/App.tsx` — the topNavWrapper now spans the full nav grid area**

The `topNavWrapper` div wraps both the nav and the fight banner, so the grid needs to treat it as the `nav` area. The current `TopNav` renders a `<nav>` with `grid-area: nav`. Now we need the outer wrapper div to have `grid-area: nav` instead. This is already handled in the CSS above (`.topNavWrapper { grid-area: nav; }`).

Verify `src/App.module.css` has the grid layout set up — read it and confirm `grid-area: nav` is assigned. If the grid template doesn't account for the wrapper, adjust.

Open `src/App.module.css` and check. The grid likely has:
```css
grid-template-areas:
  "nav nav"
  "sidebar content";
```

If the current TopNav `<nav>` had `grid-area: nav` directly, and now the `<div className={styles.topNavWrapper}>` has it instead, no App.tsx changes are needed — just confirm the CSS is correct.

- [ ] **Step 4: Run full test suite to ensure no regressions**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run
```

Expected: All tests PASS. (TopNav has no unit tests since it depends on the browser DB and React lifecycle.)

- [ ] **Step 5: Commit**

```bash
git add src/components/TopNav/TopNav.tsx src/components/TopNav/TopNav.module.css
git commit -m "feat: add game date display and Play dropdown to TopNav"
```

---

### Task 5: Update Calendar and Schedule to use game date

**Files:**
- Modify: `src/pages/League/Calendar.tsx`
- Modify: `src/pages/League/Schedule.tsx`
- Modify: `src/pages/League/Calendar.test.ts` (if it tests `today`)

Both pages currently derive `today` from `new Date()`. They should now read `currentDate` from the gym record.

- [ ] **Step 1: Update `src/pages/League/Calendar.tsx`**

Remove the `today` state line:
```typescript
const [today] = useState(() => new Date().toISOString().slice(0, 10));
```

Add `today` as a piece of state populated from the gym:
```typescript
const [today, setToday] = useState<string>('2026-01-01');
```

In the existing `useEffect` `Promise.all`, add `getGym()` to the parallel calls (it's already imported at line 4):

Replace:
```typescript
    Promise.all([
      getGym(),
      getAllBoxers(),
      getAllCalendarEvents(),
      getAllFights(),
      getAllFederations(),
    ]).then(([gym, allBoxers, allEvents, allFights, allFederations]) => {
      if (cancelled) return;

      const gymId = gym?.id;
```

With (no import changes needed — `getGym` is already imported):
```typescript
    Promise.all([
      getGym(),
      getAllBoxers(),
      getAllCalendarEvents(),
      getAllFights(),
      getAllFederations(),
    ]).then(([gym, allBoxers, allEvents, allFights, allFederations]) => {
      if (cancelled) return;

      const gameDate = gym?.currentDate ?? '2026-01-01';
      setToday(gameDate);

      const gymId = gym?.id;
```

Then in the `deriveRows` call, `today` is already used correctly (it's now the game date).

Also remove `today` from the `useEffect` dependency array — the data should reload when the component mounts (the TopNav updates the gym in DB, and navigation to Calendar will re-mount and re-read):

```typescript
  }, []); // was [today]
```

- [ ] **Step 2: Update `src/pages/League/Schedule.tsx`**

Find the `today` state (around line 107):
```typescript
const [today] = useState(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
```

Replace with:
```typescript
const [today, setToday] = useState<string>('2026-01-01');
```

Then in the `load()` function inside `useEffect` (around line 179), `gym` is already loaded from `getGym()` in the `Promise.all`. After the line `setData({ gym, boxers, ... })`, add:

```typescript
setToday(gym?.currentDate ?? '2026-01-01');
```

Also update the `useEffect` dependency array at line 193 to remove `today` (Schedule will re-read the date fresh each time the component mounts via navigation):

```typescript
  }, [searchParams]); // removed: today
```

Note: The auto-generate federation events logic at line 138 uses `today` to compute `nextYear` — it will now use the game date, which is correct behaviour (generate events for the year after the current game year).

- [ ] **Step 3: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/League/Calendar.tsx src/pages/League/Schedule.tsx
git commit -m "feat: Calendar and Schedule read game date from gym instead of system clock"
```

---

### Task 6: Mark requirement complete

**Files:**
- Modify: `BoxingManagerRequirements.txt`

- [ ] **Step 1: The calendar item in requirements doesn't have a direct entry for "time simulation" — add it to the FUTURE section with [x] status**

Find in `BoxingManagerRequirements.txt`:
```
[ ] All money flows to the gym (individual boxers earn nothing directly)
```

This item remains incomplete. The time simulation is a new system not previously tracked. Add a note in the relevant section.

Actually, looking at the requirements, there's no line item for the time/sim system. Leave `BoxingManagerRequirements.txt` as-is — this feature was an ad-hoc request not yet in the requirements doc. No change needed.

- [ ] **Step 2: Run the full test suite one final time**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: all time-sim tasks complete, all tests passing"
```
