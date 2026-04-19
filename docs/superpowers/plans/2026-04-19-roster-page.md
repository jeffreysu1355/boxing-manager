# Roster Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Gym > Roster page showing all gym boxers with name, age, weight class, style, record, status badge, and next scheduled fight.

**Architecture:** Single bulk load on mount fetches gym, all boxers, all calendar events, all fights, and all federations; all derived data (status, next fight) is computed client-side. The page is two files — `Roster.tsx` (logic + rendering) and `Roster.module.css` (styles). No data model or store changes needed.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vitest, idb (IndexedDB)

---

## File Map

- **Modify:** `src/pages/Gym/Roster.tsx` — replace stub with full implementation
- **Create:** `src/pages/Gym/Roster.module.css` — scoped styles

---

### Task 1: Create `Roster.module.css`

**Files:**
- Create: `src/pages/Gym/Roster.module.css`

- [ ] **Step 1: Create the CSS file**

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.sectionTitle {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin: 0 0 10px 0;
}

.styleTag {
  color: var(--text-secondary);
  font-size: 12px;
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

.statusBadge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  color: #fff;
}

.nextFight {
  color: var(--text-secondary);
  font-size: 12px;
}

.noFight {
  color: var(--text-muted);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Gym/Roster.module.css
git commit -m "feat: add Roster.module.css"
```

---

### Task 2: Implement helper functions (with tests)

The derived data logic — status and next fight — is pure enough to test directly via helper functions extracted into the component file. We'll test via a lightweight unit test file that imports and exercises them.

**Files:**
- Modify: `src/pages/Gym/Roster.tsx` — add and export helpers for testing
- Create: `src/pages/Gym/Roster.test.ts` — unit tests for helper functions

- [ ] **Step 1: Write failing tests**

Create `src/pages/Gym/Roster.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getBoxerStatus,
  getNextFight,
  calcRecord,
  styleLabel,
  capitalize,
} from './Roster';
import type { Boxer, CalendarEvent, Fight, Federation } from '../../db/db';

// --- Fixtures ---

const baseBoxer: Boxer = {
  id: 1,
  name: 'Test Boxer',
  age: 24,
  weightClass: 'welterweight',
  style: 'out-boxer',
  reputation: 'Unknown',
  gymId: 1,
  federationId: null,
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
};

const opponent: Boxer = { ...baseBoxer, id: 2, name: 'Marcus Webb' };

const boxersMap = new Map<number, Boxer>([
  [1, baseBoxer],
  [2, opponent],
]);

const TODAY = '2026-04-19';

// --- getBoxerStatus ---

describe('getBoxerStatus', () => {
  it('returns Active when no injuries or events', () => {
    const status = getBoxerStatus(baseBoxer, [], TODAY);
    expect(status.label).toBe('Active');
    expect(status.color).toBe('var(--success)');
  });

  it('returns Injured when boxer has injury with recoveryDays > 0', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [{ name: 'Sprain', severity: 'minor', recoveryDays: 5, dateOccurred: '2026-04-15' }],
    };
    const status = getBoxerStatus(boxer, [], TODAY);
    expect(status.label).toBe('Injured (Minor, 5 days)');
    expect(status.color).toBe('var(--danger)');
  });

  it('uses most severe injury when multiple injuries exist', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [
        { name: 'Bruise', severity: 'minor', recoveryDays: 2, dateOccurred: '2026-04-15' },
        { name: 'Fracture', severity: 'severe', recoveryDays: 30, dateOccurred: '2026-04-15' },
      ],
    };
    const status = getBoxerStatus(boxer, [], TODAY);
    expect(status.label).toBe('Injured (Severe, 30 days)');
  });

  it('ignores injuries with recoveryDays === 0', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [{ name: 'Bruise', severity: 'minor', recoveryDays: 0, dateOccurred: '2026-04-10' }],
    };
    const status = getBoxerStatus(boxer, [], TODAY);
    expect(status.label).toBe('Active');
  });

  it('returns In Training Camp when future training-camp event exists', () => {
    const events: CalendarEvent[] = [
      { id: 1, type: 'training-camp', date: '2026-05-01', boxerIds: [1], fightId: 10 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY);
    expect(status.label).toBe('In Training Camp');
    expect(status.color).toBe('var(--warning)');
  });

  it('returns Scheduled Fight when future fight event exists and no training camp', () => {
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-05-10', boxerIds: [1, 2], fightId: 20 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY);
    expect(status.label).toBe('Scheduled Fight');
    expect(status.color).toBe('#2196f3');
  });

  it('ignores past events when computing status', () => {
    const events: CalendarEvent[] = [
      { id: 3, type: 'fight', date: '2026-04-01', boxerIds: [1, 2], fightId: 20 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY);
    expect(status.label).toBe('Active');
  });

  it('injury takes priority over training camp event', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [{ name: 'Sprain', severity: 'moderate', recoveryDays: 10, dateOccurred: '2026-04-15' }],
    };
    const events: CalendarEvent[] = [
      { id: 1, type: 'training-camp', date: '2026-05-01', boxerIds: [1], fightId: 10 },
    ];
    const status = getBoxerStatus(boxer, events, TODAY);
    expect(status.label).toBe('Injured (Moderate, 10 days)');
  });
});

// --- getNextFight ---

describe('getNextFight', () => {
  const federation: Federation = { id: 1, name: 'North America Boxing Federation', prestige: 7 };
  const federationsMap = new Map<number, Federation>([[1, federation]]);

  it('returns null when no future fight events', () => {
    const result = getNextFight(baseBoxer, [], new Map(), federationsMap, TODAY);
    expect(result).toBeNull();
  });

  it('returns formatted string for soonest future fight', () => {
    const fight: Fight = {
      id: 10,
      date: '2026-05-03',
      federationId: 1,
      weightClass: 'welterweight',
      boxerIds: [1, 2],
      winnerId: null,
      method: 'Decision',
      finishingMove: null,
      round: null,
      time: null,
      isTitleFight: false,
      contractId: 5,
    };
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-05-03', boxerIds: [1, 2], fightId: 10 },
    ];
    const result = getNextFight(baseBoxer, events, fightsMap, federationsMap, TODAY);
    expect(result).toMatch(/May 3, 2026/);
    expect(result).toContain('Marcus Webb');
    expect(result).toContain('NABF');
  });

  it('picks the soonest of multiple future fight events', () => {
    const fight1: Fight = {
      id: 10, date: '2026-06-01', federationId: 1, weightClass: 'welterweight',
      boxerIds: [1, 2], winnerId: null, method: 'Decision', finishingMove: null,
      round: null, time: null, isTitleFight: false, contractId: 5,
    };
    const fight2: Fight = {
      id: 11, date: '2026-05-03', federationId: 1, weightClass: 'welterweight',
      boxerIds: [1, 2], winnerId: null, method: 'Decision', finishingMove: null,
      round: null, time: null, isTitleFight: false, contractId: 6,
    };
    const fightsMap = new Map<number, Fight>([[10, fight1], [11, fight2]]);
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-06-01', boxerIds: [1, 2], fightId: 10 },
      { id: 3, type: 'fight', date: '2026-05-03', boxerIds: [1, 2], fightId: 11 },
    ];
    const result = getNextFight(baseBoxer, events, fightsMap, federationsMap, TODAY);
    expect(result).toMatch(/May 3, 2026/);
  });

  it('ignores past fight events', () => {
    const fight: Fight = {
      id: 10, date: '2026-04-01', federationId: 1, weightClass: 'welterweight',
      boxerIds: [1, 2], winnerId: null, method: 'Decision', finishingMove: null,
      round: null, time: null, isTitleFight: false, contractId: 5,
    };
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-04-01', boxerIds: [1, 2], fightId: 10 },
    ];
    const result = getNextFight(baseBoxer, events, fightsMap, federationsMap, TODAY);
    expect(result).toBeNull();
  });
});

// --- calcRecord ---

describe('calcRecord', () => {
  it('returns 0-0 for no fights', () => {
    expect(calcRecord([])).toBe('0-0');
  });

  it('returns wins-losses', () => {
    const record = [
      { result: 'win' as const, opponentName: 'A', method: 'KO', finishingMove: null, round: 1, time: '1:30', federation: 'NABF', date: '2026-01-01' },
      { result: 'loss' as const, opponentName: 'B', method: 'Decision', finishingMove: null, round: 12, time: '3:00', federation: 'NABF', date: '2026-02-01' },
    ];
    expect(calcRecord(record)).toBe('1-1');
  });

  it('appends draws when present', () => {
    const record = [
      { result: 'win' as const, opponentName: 'A', method: 'KO', finishingMove: null, round: 1, time: '1:30', federation: 'NABF', date: '2026-01-01' },
      { result: 'draw' as const, opponentName: 'C', method: 'Draw', finishingMove: null, round: 12, time: '3:00', federation: 'NABF', date: '2026-03-01' },
    ];
    expect(calcRecord(record)).toBe('1-0-1');
  });
});

// --- styleLabel ---

describe('styleLabel', () => {
  it('formats out-boxer correctly', () => {
    expect(styleLabel('out-boxer')).toBe('Out-Boxer');
  });
  it('formats counterpuncher correctly', () => {
    expect(styleLabel('counterpuncher')).toBe('Counterpuncher');
  });
});

// --- capitalize ---

describe('capitalize', () => {
  it('capitalizes weight class', () => {
    expect(capitalize('welterweight')).toBe('Welterweight');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm test -- src/pages/Gym/Roster.test.ts
```

Expected: FAIL — `getBoxerStatus`, `getNextFight`, `calcRecord`, `styleLabel`, `capitalize` not exported from `Roster.tsx`.

- [ ] **Step 3: Add helper functions to `Roster.tsx` (exported, no UI yet)**

Replace the contents of `src/pages/Gym/Roster.tsx` with:

```typescript
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { Boxer, CalendarEvent, Fight, Federation, FightRecord, FederationName } from '../../db/db';

// --- Constants ---

const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};

const SEVERITY_ORDER: Record<'minor' | 'moderate' | 'severe', number> = {
  minor: 0,
  moderate: 1,
  severe: 2,
};

// --- Helpers (exported for testing) ---

export interface BoxerStatus {
  label: string;
  color: string;
}

export function getBoxerStatus(
  boxer: Boxer,
  events: CalendarEvent[],
  today: string
): BoxerStatus {
  const activeInjuries = boxer.injuries.filter(i => i.recoveryDays > 0);
  if (activeInjuries.length > 0) {
    const worst = activeInjuries.reduce((a, b) =>
      SEVERITY_ORDER[b.severity] > SEVERITY_ORDER[a.severity] ? b : a
    );
    const sev = worst.severity.charAt(0).toUpperCase() + worst.severity.slice(1);
    const days = worst.recoveryDays;
    return { label: `Injured (${sev}, ${days} day${days === 1 ? '' : 's'})`, color: 'var(--danger)' };
  }

  const boxerEvents = events.filter(e => e.boxerIds.includes(boxer.id!) && e.date > today);
  if (boxerEvents.some(e => e.type === 'training-camp')) {
    return { label: 'In Training Camp', color: 'var(--warning)' };
  }
  if (boxerEvents.some(e => e.type === 'fight')) {
    return { label: 'Scheduled Fight', color: '#2196f3' };
  }
  return { label: 'Active', color: 'var(--success)' };
}

export function getNextFight(
  boxer: Boxer,
  events: CalendarEvent[],
  fightsMap: Map<number, Fight>,
  federationsMap: Map<number, Federation>,
  today: string
): string | null {
  const futureEvents = events
    .filter(e => e.type === 'fight' && e.boxerIds.includes(boxer.id!) && e.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (futureEvents.length === 0) return null;

  const soonest = futureEvents[0];
  const fight = fightsMap.get(soonest.fightId);
  if (!fight) return null;

  const opponentId = fight.boxerIds.find(id => id !== boxer.id);
  const opponentName = opponentId !== undefined
    ? (fightsMap.get(soonest.fightId) && opponentId !== undefined
        ? undefined  // placeholder, resolved below
        : undefined)
    : undefined;
  // Resolve opponent name from a separate boxers lookup — passed via closure in component.
  // For testing we reconstruct via the fight's boxerIds.
  // NOTE: opponent name resolution happens in the component; this function receives a boxersMap.
  // We need to update the signature to accept boxersMap.
  void opponentName; // unused branch above — see corrected signature below

  const federation = federationsMap.get(fight.federationId);
  const abbr = federation ? FEDERATION_ABBR[federation.name] ?? federation.name : '?';
  const dateStr = new Date(soonest.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return `${dateStr} — fight data loaded but opponent resolution requires boxersMap`;
}

export function calcRecord(record: FightRecord[]): string {
  const wins = record.filter(r => r.result === 'win').length;
  const losses = record.filter(r => r.result === 'loss').length;
  const draws = record.filter(r => r.result === 'draw').length;
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

export function styleLabel(style: string): string {
  return style.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Component (stub, full UI in Task 3) ---

export default function Roster() {
  return (
    <div>
      <PageHeader title="Roster" subtitle="Current gym members" />
      <p>Roster will display here.</p>
    </div>
  );
}
```

Wait — `getNextFight` needs `boxersMap` to resolve the opponent name. Update both the test file and the helper to accept a `boxersMap` parameter.

Update `getNextFight` signature in `Roster.tsx`:

```typescript
export function getNextFight(
  boxer: Boxer,
  events: CalendarEvent[],
  fightsMap: Map<number, Fight>,
  federationsMap: Map<number, Federation>,
  today: string,
  boxersMap: Map<number, Boxer>
): string | null {
  const futureEvents = events
    .filter(e => e.type === 'fight' && e.boxerIds.includes(boxer.id!) && e.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (futureEvents.length === 0) return null;

  const soonest = futureEvents[0];
  const fight = fightsMap.get(soonest.fightId);
  if (!fight) return null;

  const opponentId = fight.boxerIds.find(id => id !== boxer.id);
  const opponentName = opponentId !== undefined
    ? (boxersMap.get(opponentId)?.name ?? 'Unknown')
    : 'Unknown';

  const federation = federationsMap.get(fight.federationId);
  const abbr = federation ? FEDERATION_ABBR[federation.name] ?? federation.name : '?';
  const dateStr = new Date(soonest.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return `${dateStr} vs. ${opponentName} (${abbr})`;
}
```

Update the test file's `getNextFight` calls to pass `boxersMap` as the 6th argument. The fixture `boxersMap` is already defined in the test file above. Update all `getNextFight(...)` calls in the test to append `, boxersMap`.

The corrected `src/pages/Gym/Roster.tsx` helper-only file (Task 2 final state):

```typescript
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { Boxer, CalendarEvent, Fight, Federation, FightRecord, FederationName } from '../../db/db';

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

const SEVERITY_ORDER: Record<'minor' | 'moderate' | 'severe', number> = {
  minor: 0,
  moderate: 1,
  severe: 2,
};

// --- Exported helpers ---

export interface BoxerStatus {
  label: string;
  color: string;
}

export function getBoxerStatus(
  boxer: Boxer,
  events: CalendarEvent[],
  today: string
): BoxerStatus {
  const activeInjuries = boxer.injuries.filter(i => i.recoveryDays > 0);
  if (activeInjuries.length > 0) {
    const worst = activeInjuries.reduce((a, b) =>
      SEVERITY_ORDER[b.severity] > SEVERITY_ORDER[a.severity] ? b : a
    );
    const sev = worst.severity.charAt(0).toUpperCase() + worst.severity.slice(1);
    const days = worst.recoveryDays;
    return { label: `Injured (${sev}, ${days} day${days === 1 ? '' : 's'})`, color: 'var(--danger)' };
  }

  const boxerEvents = events.filter(e => e.boxerIds.includes(boxer.id!) && e.date > today);
  if (boxerEvents.some(e => e.type === 'training-camp')) {
    return { label: 'In Training Camp', color: 'var(--warning)' };
  }
  if (boxerEvents.some(e => e.type === 'fight')) {
    return { label: 'Scheduled Fight', color: '#2196f3' };
  }
  return { label: 'Active', color: 'var(--success)' };
}

export function getNextFight(
  boxer: Boxer,
  events: CalendarEvent[],
  fightsMap: Map<number, Fight>,
  federationsMap: Map<number, Federation>,
  today: string,
  boxersMap: Map<number, Boxer>
): string | null {
  const futureEvents = events
    .filter(e => e.type === 'fight' && e.boxerIds.includes(boxer.id!) && e.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (futureEvents.length === 0) return null;

  const soonest = futureEvents[0];
  const fight = fightsMap.get(soonest.fightId);
  if (!fight) return null;

  const opponentId = fight.boxerIds.find(id => id !== boxer.id);
  const opponentName = opponentId !== undefined
    ? (boxersMap.get(opponentId)?.name ?? 'Unknown')
    : 'Unknown';

  const federation = federationsMap.get(fight.federationId);
  const abbr = federation ? (FEDERATION_ABBR[federation.name] ?? federation.name) : '?';
  const dateStr = new Date(soonest.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return `${dateStr} vs. ${opponentName} (${abbr})`;
}

export function calcRecord(record: FightRecord[]): string {
  const wins = record.filter(r => r.result === 'win').length;
  const losses = record.filter(r => r.result === 'loss').length;
  const draws = record.filter(r => r.result === 'draw').length;
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

export function styleLabel(style: string): string {
  return style.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Component stub ---

export default function Roster() {
  return (
    <div>
      <PageHeader title="Roster" subtitle="Current gym members" />
      <p>Roster will display here.</p>
    </div>
  );
}
```

And the corrected `src/pages/Gym/Roster.test.ts` (all `getNextFight` calls pass `boxersMap` as 6th arg):

```typescript
import { describe, it, expect } from 'vitest';
import {
  getBoxerStatus,
  getNextFight,
  calcRecord,
  styleLabel,
  capitalize,
} from './Roster';
import type { Boxer, CalendarEvent, Fight, Federation } from '../../db/db';

// --- Fixtures ---

const baseBoxer: Boxer = {
  id: 1,
  name: 'Test Boxer',
  age: 24,
  weightClass: 'welterweight',
  style: 'out-boxer',
  reputation: 'Unknown',
  gymId: 1,
  federationId: null,
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
};

const opponent: Boxer = { ...baseBoxer, id: 2, name: 'Marcus Webb' };

const boxersMap = new Map<number, Boxer>([
  [1, baseBoxer],
  [2, opponent],
]);

const TODAY = '2026-04-19';

// --- getBoxerStatus ---

describe('getBoxerStatus', () => {
  it('returns Active when no injuries or events', () => {
    const status = getBoxerStatus(baseBoxer, [], TODAY);
    expect(status.label).toBe('Active');
    expect(status.color).toBe('var(--success)');
  });

  it('returns Injured when boxer has injury with recoveryDays > 0', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [{ name: 'Sprain', severity: 'minor', recoveryDays: 5, dateOccurred: '2026-04-15' }],
    };
    const status = getBoxerStatus(boxer, [], TODAY);
    expect(status.label).toBe('Injured (Minor, 5 days)');
    expect(status.color).toBe('var(--danger)');
  });

  it('uses most severe injury when multiple injuries exist', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [
        { name: 'Bruise', severity: 'minor', recoveryDays: 2, dateOccurred: '2026-04-15' },
        { name: 'Fracture', severity: 'severe', recoveryDays: 30, dateOccurred: '2026-04-15' },
      ],
    };
    const status = getBoxerStatus(boxer, [], TODAY);
    expect(status.label).toBe('Injured (Severe, 30 days)');
  });

  it('ignores injuries with recoveryDays === 0', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [{ name: 'Bruise', severity: 'minor', recoveryDays: 0, dateOccurred: '2026-04-10' }],
    };
    const status = getBoxerStatus(boxer, [], TODAY);
    expect(status.label).toBe('Active');
  });

  it('returns In Training Camp when future training-camp event exists', () => {
    const events: CalendarEvent[] = [
      { id: 1, type: 'training-camp', date: '2026-05-01', boxerIds: [1], fightId: 10 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY);
    expect(status.label).toBe('In Training Camp');
    expect(status.color).toBe('var(--warning)');
  });

  it('returns Scheduled Fight when future fight event exists and no training camp', () => {
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-05-10', boxerIds: [1, 2], fightId: 20 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY);
    expect(status.label).toBe('Scheduled Fight');
    expect(status.color).toBe('#2196f3');
  });

  it('ignores past events when computing status', () => {
    const events: CalendarEvent[] = [
      { id: 3, type: 'fight', date: '2026-04-01', boxerIds: [1, 2], fightId: 20 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY);
    expect(status.label).toBe('Active');
  });

  it('injury takes priority over training camp event', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [{ name: 'Sprain', severity: 'moderate', recoveryDays: 10, dateOccurred: '2026-04-15' }],
    };
    const events: CalendarEvent[] = [
      { id: 1, type: 'training-camp', date: '2026-05-01', boxerIds: [1], fightId: 10 },
    ];
    const status = getBoxerStatus(boxer, events, TODAY);
    expect(status.label).toBe('Injured (Moderate, 10 days)');
  });
});

// --- getNextFight ---

describe('getNextFight', () => {
  const federation: Federation = { id: 1, name: 'North America Boxing Federation', prestige: 7 };
  const federationsMap = new Map<number, Federation>([[1, federation]]);

  it('returns null when no future fight events', () => {
    const result = getNextFight(baseBoxer, [], new Map(), federationsMap, TODAY, boxersMap);
    expect(result).toBeNull();
  });

  it('returns formatted string for soonest future fight', () => {
    const fight: Fight = {
      id: 10,
      date: '2026-05-03',
      federationId: 1,
      weightClass: 'welterweight',
      boxerIds: [1, 2],
      winnerId: null,
      method: 'Decision',
      finishingMove: null,
      round: null,
      time: null,
      isTitleFight: false,
      contractId: 5,
    };
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-05-03', boxerIds: [1, 2], fightId: 10 },
    ];
    const result = getNextFight(baseBoxer, events, fightsMap, federationsMap, TODAY, boxersMap);
    expect(result).toMatch(/May 3, 2026/);
    expect(result).toContain('Marcus Webb');
    expect(result).toContain('NABF');
  });

  it('picks the soonest of multiple future fight events', () => {
    const fight1: Fight = {
      id: 10, date: '2026-06-01', federationId: 1, weightClass: 'welterweight',
      boxerIds: [1, 2], winnerId: null, method: 'Decision', finishingMove: null,
      round: null, time: null, isTitleFight: false, contractId: 5,
    };
    const fight2: Fight = {
      id: 11, date: '2026-05-03', federationId: 1, weightClass: 'welterweight',
      boxerIds: [1, 2], winnerId: null, method: 'Decision', finishingMove: null,
      round: null, time: null, isTitleFight: false, contractId: 6,
    };
    const fightsMap = new Map<number, Fight>([[10, fight1], [11, fight2]]);
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-06-01', boxerIds: [1, 2], fightId: 10 },
      { id: 3, type: 'fight', date: '2026-05-03', boxerIds: [1, 2], fightId: 11 },
    ];
    const result = getNextFight(baseBoxer, events, fightsMap, federationsMap, TODAY, boxersMap);
    expect(result).toMatch(/May 3, 2026/);
  });

  it('ignores past fight events', () => {
    const fight: Fight = {
      id: 10, date: '2026-04-01', federationId: 1, weightClass: 'welterweight',
      boxerIds: [1, 2], winnerId: null, method: 'Decision', finishingMove: null,
      round: null, time: null, isTitleFight: false, contractId: 5,
    };
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-04-01', boxerIds: [1, 2], fightId: 10 },
    ];
    const result = getNextFight(baseBoxer, events, fightsMap, federationsMap, TODAY, boxersMap);
    expect(result).toBeNull();
  });
});

// --- calcRecord ---

describe('calcRecord', () => {
  it('returns 0-0 for no fights', () => {
    expect(calcRecord([])).toBe('0-0');
  });

  it('returns wins-losses', () => {
    const record = [
      { result: 'win' as const, opponentName: 'A', method: 'KO', finishingMove: null, round: 1, time: '1:30', federation: 'NABF', date: '2026-01-01' },
      { result: 'loss' as const, opponentName: 'B', method: 'Decision', finishingMove: null, round: 12, time: '3:00', federation: 'NABF', date: '2026-02-01' },
    ];
    expect(calcRecord(record)).toBe('1-1');
  });

  it('appends draws when present', () => {
    const record = [
      { result: 'win' as const, opponentName: 'A', method: 'KO', finishingMove: null, round: 1, time: '1:30', federation: 'NABF', date: '2026-01-01' },
      { result: 'draw' as const, opponentName: 'C', method: 'Draw', finishingMove: null, round: 12, time: '3:00', federation: 'NABF', date: '2026-03-01' },
    ];
    expect(calcRecord(record)).toBe('1-0-1');
  });
});

// --- styleLabel ---

describe('styleLabel', () => {
  it('formats out-boxer correctly', () => {
    expect(styleLabel('out-boxer')).toBe('Out-Boxer');
  });
  it('formats counterpuncher correctly', () => {
    expect(styleLabel('counterpuncher')).toBe('Counterpuncher');
  });
});

// --- capitalize ---

describe('capitalize', () => {
  it('capitalizes weight class', () => {
    expect(capitalize('welterweight')).toBe('Welterweight');
  });
});
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm test -- src/pages/Gym/Roster.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Gym/Roster.tsx src/pages/Gym/Roster.test.ts
git commit -m "feat: add Roster helper functions with tests"
```

---

### Task 3: Implement full Roster component UI

**Files:**
- Modify: `src/pages/Gym/Roster.tsx` — replace stub with full React component

- [ ] **Step 1: Replace component in `Roster.tsx`**

Replace the entire file contents with:

```typescript
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym } from '../../db/gymStore';
import { getAllBoxers } from '../../db/boxerStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllFights } from '../../db/fightStore';
import { getAllFederations } from '../../db/federationStore';
import type { Boxer, CalendarEvent, Fight, Federation, FightRecord, FederationName } from '../../db/db';
import styles from './Roster.module.css';

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

const SEVERITY_ORDER: Record<'minor' | 'moderate' | 'severe', number> = {
  minor: 0,
  moderate: 1,
  severe: 2,
};

// --- Exported helpers ---

export interface BoxerStatus {
  label: string;
  color: string;
}

export function getBoxerStatus(
  boxer: Boxer,
  events: CalendarEvent[],
  today: string
): BoxerStatus {
  const activeInjuries = boxer.injuries.filter(i => i.recoveryDays > 0);
  if (activeInjuries.length > 0) {
    const worst = activeInjuries.reduce((a, b) =>
      SEVERITY_ORDER[b.severity] > SEVERITY_ORDER[a.severity] ? b : a
    );
    const sev = worst.severity.charAt(0).toUpperCase() + worst.severity.slice(1);
    const days = worst.recoveryDays;
    return { label: `Injured (${sev}, ${days} day${days === 1 ? '' : 's'})`, color: 'var(--danger)' };
  }

  const boxerEvents = events.filter(e => e.boxerIds.includes(boxer.id!) && e.date > today);
  if (boxerEvents.some(e => e.type === 'training-camp')) {
    return { label: 'In Training Camp', color: 'var(--warning)' };
  }
  if (boxerEvents.some(e => e.type === 'fight')) {
    return { label: 'Scheduled Fight', color: '#2196f3' };
  }
  return { label: 'Active', color: 'var(--success)' };
}

export function getNextFight(
  boxer: Boxer,
  events: CalendarEvent[],
  fightsMap: Map<number, Fight>,
  federationsMap: Map<number, Federation>,
  today: string,
  boxersMap: Map<number, Boxer>
): string | null {
  const futureEvents = events
    .filter(e => e.type === 'fight' && e.boxerIds.includes(boxer.id!) && e.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (futureEvents.length === 0) return null;

  const soonest = futureEvents[0];
  const fight = fightsMap.get(soonest.fightId);
  if (!fight) return null;

  const opponentId = fight.boxerIds.find(id => id !== boxer.id);
  const opponentName = opponentId !== undefined
    ? (boxersMap.get(opponentId)?.name ?? 'Unknown')
    : 'Unknown';

  const federation = federationsMap.get(fight.federationId);
  const abbr = federation ? (FEDERATION_ABBR[federation.name] ?? federation.name) : '?';
  const dateStr = new Date(soonest.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return `${dateStr} vs. ${opponentName} (${abbr})`;
}

export function calcRecord(record: FightRecord[]): string {
  const wins = record.filter(r => r.result === 'win').length;
  const losses = record.filter(r => r.result === 'loss').length;
  const draws = record.filter(r => r.result === 'draw').length;
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

export function styleLabel(style: string): string {
  return style.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Component ---

export default function Roster() {
  const [roster, setRoster] = useState<Boxer[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [fightsMap, setFightsMap] = useState<Map<number, Fight>>(new Map());
  const [federationsMap, setFederationsMap] = useState<Map<number, Federation>>(new Map());
  const [boxersMap, setBoxersMap] = useState<Map<number, Boxer>>(new Map());
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

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
      const gymRoster = allBoxers.filter(b => b.gymId === gymId);

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

      setRoster(gymRoster);
      setEvents(allEvents);
      setFightsMap(fMap);
      setFederationsMap(fedMap);
      setBoxersMap(bMap);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Roster" subtitle="Current gym members" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Roster" subtitle="Current gym members" />
      <div className={styles.page}>
        {roster.length === 0 ? (
          <p className={styles.empty}>No boxers on your roster yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Weight Class</th>
                <th>Style</th>
                <th>Record</th>
                <th>Status</th>
                <th>Next Fight</th>
              </tr>
            </thead>
            <tbody>
              {roster.map(boxer => {
                const status = getBoxerStatus(boxer, events, today);
                const nextFight = getNextFight(boxer, events, fightsMap, federationsMap, today, boxersMap);
                return (
                  <tr key={boxer.id}>
                    <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                    <td>{boxer.age}</td>
                    <td>{capitalize(boxer.weightClass)}</td>
                    <td className={styles.styleTag}>{styleLabel(boxer.style)}</td>
                    <td>{calcRecord(boxer.record)}</td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={{ backgroundColor: status.color }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td>
                      {nextFight
                        ? <span className={styles.nextFight}>{nextFight}</span>
                        : <span className={styles.noFight}>—</span>
                      }
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

- [ ] **Step 2: Run all tests to confirm nothing broken**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm test
```

Expected: all tests pass including `Roster.test.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Gym/Roster.tsx
git commit -m "feat: implement Roster page with status badges and next fight column"
```
