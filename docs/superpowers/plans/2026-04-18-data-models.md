# Data Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Title, Injury (no-op), CalendarEvent, and NaturalTalent models — two new IDB object stores plus two interface updates.

**Architecture:** All interface changes and new store schemas land in `src/db/db.ts` with a version bump to 3. Two new store files (`titleStore.ts`, `calendarEventStore.ts`) follow the existing CRUD pattern. `NaturalTalent` becomes a single-stat interface; `TitleRecord` is simplified and `FederationTitle` is removed.

**Tech Stack:** TypeScript, IndexedDB via `idb`, Vitest + `fake-indexeddb` for tests.

---

### Task 1: Update `db.ts` — interface changes + v3 schema

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Update `NaturalTalent` interface**

In `src/db/db.ts`, replace:
```typescript
export interface NaturalTalent {
  name: string;
  affectedStats: (keyof BoxerStats)[];
}
```
With:
```typescript
export interface NaturalTalent {
  stat: keyof BoxerStats; // display name = `Super ${capitalize(stat)}`; raises cap from 20 → 25
}
```

- [ ] **Step 2: Remove `FederationTitle` interface and update `TitleRecord`**

Remove the entire `FederationTitle` interface:
```typescript
export interface FederationTitle {
  weightClass: WeightClass;
  currentChampionId: number | null;
  dateWon: string | null;
}
```

Replace `TitleRecord` (remove `federationId` and `weightClass` since those now live on the standalone `Title`):
```typescript
export interface TitleRecord {
  titleId: number;
  dateWon: string;
  dateLost: string | null;
}
```

- [ ] **Step 3: Add `TitleReign` and `Title` interfaces**

After the `FightRecord` interface, add:
```typescript
export interface TitleReign {
  boxerId: number;
  dateWon: string;
  dateLost: string | null;
  defenseCount: number;
}

export interface Title {
  id?: number;
  federationId: number;
  weightClass: WeightClass;
  currentChampionId: number | null;
  reigns: TitleReign[];
}
```

- [ ] **Step 4: Add `CalendarEventType` and `CalendarEvent` interfaces**

After the `Title` interface, add:
```typescript
export type CalendarEventType = 'fight' | 'training-camp';

export interface CalendarEvent {
  id?: number;
  type: CalendarEventType;
  date: string;        // fight date OR training camp start date (ISO)
  boxerIds: number[];  // multi-entry indexed; single element for training-camp
  fightId: number;     // 'fight': the fight itself; 'training-camp': the fight being prepped for
  endDate?: string;    // training-camp only (ISO)
  intensityLevel?: 'light' | 'moderate' | 'intense'; // training-camp only
}
```

- [ ] **Step 5: Remove `titles` field from `Federation`**

Replace:
```typescript
export interface Federation {
  id?: number;
  name: FederationName;
  prestige: number; // 1-10, International BF = 10
  titles: FederationTitle[];
}
```
With:
```typescript
export interface Federation {
  id?: number;
  name: FederationName;
  prestige: number; // 1-10, International BF = 10
}
```

- [ ] **Step 6: Add `titles` and `calendarEvents` to `BoxingManagerDBSchema`**

In the `BoxingManagerDBSchema` interface, after the `ppvNetworks` entry, add:
```typescript
  titles: {
    key: number;
    value: Title;
    indexes: { federationId: number; weightClass: WeightClass };
  };
  calendarEvents: {
    key: number;
    value: CalendarEvent;
    indexes: { type: CalendarEventType; date: string; boxerIds: number; fightId: number };
  };
```

- [ ] **Step 7: Bump DB version and add v3 upgrade block**

Change the `openDB` call version from `2` to `3`:
```typescript
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 3, {
```

Add a new upgrade block after the `if (oldVersion < 2)` block:
```typescript
      if (oldVersion < 3) {
        const titleStore = db.createObjectStore('titles', {
          keyPath: 'id',
          autoIncrement: true,
        });
        titleStore.createIndex('federationId', 'federationId');
        titleStore.createIndex('weightClass', 'weightClass');

        const calendarEventStore = db.createObjectStore('calendarEvents', {
          keyPath: 'id',
          autoIncrement: true,
        });
        calendarEventStore.createIndex('type', 'type');
        calendarEventStore.createIndex('date', 'date');
        calendarEventStore.createIndex('boxerIds', 'boxerIds', { multiEntry: true });
        calendarEventStore.createIndex('fightId', 'fightId');
      }
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors. If you see errors about `FederationTitle` or `NaturalTalent.affectedStats`, they are in files that reference the removed fields — fix them before continuing.

- [ ] **Step 9: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: update db.ts — NaturalTalent, TitleRecord, add Title/CalendarEvent interfaces and v3 schema"
```

---

### Task 2: Update `db.test.ts` for new stores

**Files:**
- Modify: `src/db/db.test.ts`

- [ ] **Step 1: Add store existence tests**

Append to `src/db/db.test.ts` inside the `describe('getDB', ...)` block:
```typescript
  it('creates the federations object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('federations')).toBe(true);
  });

  it('creates the fights object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('fights')).toBe(true);
  });

  it('creates the fightContracts object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('fightContracts')).toBe(true);
  });

  it('creates the ppvNetworks object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('ppvNetworks')).toBe(true);
  });

  it('creates the titles object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('titles')).toBe(true);
  });

  it('creates the calendarEvents object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('calendarEvents')).toBe(true);
  });

  it('creates federationId and weightClass indexes on titles store', async () => {
    const db = await getDB();
    const tx = db.transaction('titles', 'readonly');
    expect(tx.store.indexNames.contains('federationId')).toBe(true);
    expect(tx.store.indexNames.contains('weightClass')).toBe(true);
  });

  it('creates type, date, boxerIds, fightId indexes on calendarEvents store', async () => {
    const db = await getDB();
    const tx = db.transaction('calendarEvents', 'readonly');
    expect(tx.store.indexNames.contains('type')).toBe(true);
    expect(tx.store.indexNames.contains('date')).toBe(true);
    expect(tx.store.indexNames.contains('boxerIds')).toBe(true);
    expect(tx.store.indexNames.contains('fightId')).toBe(true);
  });
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/db/db.test.ts
```
Expected: all tests pass including the new ones.

- [ ] **Step 3: Commit**

```bash
git add src/db/db.test.ts
git commit -m "test: add db.test.ts assertions for titles and calendarEvents stores"
```

---

### Task 3: Write failing tests for `titleStore`

**Files:**
- Create: `src/db/titleStore.test.ts`

- [ ] **Step 1: Create `titleStore.test.ts`**

Create `src/db/titleStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB, type Title } from './db';
import {
  getTitle,
  getAllTitles,
  getTitlesByFederation,
  getTitlesByWeightClass,
  putTitle,
  deleteTitle,
} from './titleStore';

const baseTitle: Omit<Title, 'id'> = {
  federationId: 1,
  weightClass: 'lightweight',
  currentChampionId: null,
  reigns: [],
};

describe('titleStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('putTitle inserts a new title and returns its id', async () => {
    const id = await putTitle(baseTitle);
    expect(id).toBe(1);
  });

  it('putTitle assigns incrementing ids', async () => {
    const id1 = await putTitle(baseTitle);
    const id2 = await putTitle({ ...baseTitle, weightClass: 'heavyweight' });
    expect(id1).toBe(1);
    expect(id2).toBe(2);
  });

  it('getTitle retrieves a title by id', async () => {
    const id = await putTitle(baseTitle);
    const title = await getTitle(id);
    expect(title?.weightClass).toBe('lightweight');
    expect(title?.id).toBe(id);
  });

  it('getTitle returns undefined for a missing id', async () => {
    const title = await getTitle(999);
    expect(title).toBeUndefined();
  });

  it('getAllTitles returns all stored titles', async () => {
    await putTitle(baseTitle);
    await putTitle({ ...baseTitle, weightClass: 'heavyweight' });
    const titles = await getAllTitles();
    expect(titles).toHaveLength(2);
  });

  it('getAllTitles returns an empty array when no titles exist', async () => {
    const titles = await getAllTitles();
    expect(titles).toHaveLength(0);
  });

  it('getTitlesByFederation returns only titles for that federation', async () => {
    await putTitle(baseTitle); // federationId: 1
    await putTitle({ ...baseTitle, federationId: 2, weightClass: 'heavyweight' });
    const fed1Titles = await getTitlesByFederation(1);
    expect(fed1Titles).toHaveLength(1);
    expect(fed1Titles[0].federationId).toBe(1);
  });

  it('getTitlesByFederation returns empty array when no matches', async () => {
    await putTitle(baseTitle);
    const result = await getTitlesByFederation(99);
    expect(result).toHaveLength(0);
  });

  it('getTitlesByWeightClass returns only titles of that weight class', async () => {
    await putTitle(baseTitle); // lightweight
    await putTitle({ ...baseTitle, weightClass: 'heavyweight' });
    const lightweights = await getTitlesByWeightClass('lightweight');
    expect(lightweights).toHaveLength(1);
    expect(lightweights[0].weightClass).toBe('lightweight');
  });

  it('getTitlesByWeightClass returns empty array when no matches', async () => {
    await putTitle(baseTitle);
    const result = await getTitlesByWeightClass('flyweight');
    expect(result).toHaveLength(0);
  });

  it('putTitle updates an existing title when id is present', async () => {
    const id = await putTitle(baseTitle);
    await putTitle({ ...baseTitle, id, currentChampionId: 42 });
    const title = await getTitle(id);
    expect(title?.currentChampionId).toBe(42);
  });

  it('putTitle stores reigns and currentChampionId', async () => {
    const reign = { boxerId: 7, dateWon: '2026-01-01', dateLost: null, defenseCount: 2 };
    const id = await putTitle({ ...baseTitle, currentChampionId: 7, reigns: [reign] });
    const title = await getTitle(id);
    expect(title?.reigns).toHaveLength(1);
    expect(title?.reigns[0].boxerId).toBe(7);
    expect(title?.reigns[0].defenseCount).toBe(2);
  });

  it('putTitle with id: undefined inserts as a new title', async () => {
    const id = await putTitle({ ...baseTitle, id: undefined });
    expect(id).toBe(1);
  });

  it('deleteTitle removes a title by id', async () => {
    const id = await putTitle(baseTitle);
    await deleteTitle(id);
    const title = await getTitle(id);
    expect(title).toBeUndefined();
  });

  it('deleteTitle does not affect other titles', async () => {
    const id1 = await putTitle(baseTitle);
    const id2 = await putTitle({ ...baseTitle, weightClass: 'heavyweight' });
    await deleteTitle(id1);
    const remaining = await getAllTitles();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/db/titleStore.test.ts
```
Expected: FAIL — `Cannot find module './titleStore'`

---

### Task 4: Implement `titleStore.ts` and pass tests

**Files:**
- Create: `src/db/titleStore.ts`

- [ ] **Step 1: Create `titleStore.ts`**

Create `src/db/titleStore.ts`:
```typescript
import { getDB, type Title, type WeightClass } from './db';

export async function getTitle(id: number): Promise<Title | undefined> {
  const db = await getDB();
  return db.get('titles', id);
}

export async function getAllTitles(): Promise<Title[]> {
  const db = await getDB();
  return db.getAll('titles');
}

export async function getTitlesByFederation(federationId: number): Promise<Title[]> {
  const db = await getDB();
  return db.getAllFromIndex('titles', 'federationId', federationId);
}

export async function getTitlesByWeightClass(weightClass: WeightClass): Promise<Title[]> {
  const db = await getDB();
  return db.getAllFromIndex('titles', 'weightClass', weightClass);
}

export async function putTitle(title: Omit<Title, 'id'> | Title): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = title as Title;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('titles', record as Title);
}

export async function deleteTitle(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('titles', id);
}
```

- [ ] **Step 2: Run tests — expect all pass**

```bash
npx vitest run src/db/titleStore.test.ts
```
Expected: all tests PASS.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/db/titleStore.ts src/db/titleStore.test.ts
git commit -m "feat: add titleStore with CRUD and index queries"
```

---

### Task 5: Write failing tests for `calendarEventStore`

**Files:**
- Create: `src/db/calendarEventStore.test.ts`

- [ ] **Step 1: Create `calendarEventStore.test.ts`**

Create `src/db/calendarEventStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB, type CalendarEvent } from './db';
import {
  getCalendarEvent,
  getAllCalendarEvents,
  getEventsByBoxer,
  getEventsByFight,
  getEventsByType,
  putCalendarEvent,
  deleteCalendarEvent,
} from './calendarEventStore';

const baseFightEvent: Omit<CalendarEvent, 'id'> = {
  type: 'fight',
  date: '2026-06-01',
  boxerIds: [1, 2],
  fightId: 10,
};

const baseTrainingCamp: Omit<CalendarEvent, 'id'> = {
  type: 'training-camp',
  date: '2026-05-01',
  boxerIds: [1],
  fightId: 10,
  endDate: '2026-05-28',
  intensityLevel: 'moderate',
};

describe('calendarEventStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('putCalendarEvent inserts a new event and returns its id', async () => {
    const id = await putCalendarEvent(baseFightEvent);
    expect(id).toBe(1);
  });

  it('putCalendarEvent assigns incrementing ids', async () => {
    const id1 = await putCalendarEvent(baseFightEvent);
    const id2 = await putCalendarEvent(baseTrainingCamp);
    expect(id1).toBe(1);
    expect(id2).toBe(2);
  });

  it('getCalendarEvent retrieves an event by id', async () => {
    const id = await putCalendarEvent(baseFightEvent);
    const event = await getCalendarEvent(id);
    expect(event?.type).toBe('fight');
    expect(event?.id).toBe(id);
  });

  it('getCalendarEvent returns undefined for a missing id', async () => {
    const event = await getCalendarEvent(999);
    expect(event).toBeUndefined();
  });

  it('getAllCalendarEvents returns all stored events', async () => {
    await putCalendarEvent(baseFightEvent);
    await putCalendarEvent(baseTrainingCamp);
    const events = await getAllCalendarEvents();
    expect(events).toHaveLength(2);
  });

  it('getAllCalendarEvents returns empty array when none exist', async () => {
    const events = await getAllCalendarEvents();
    expect(events).toHaveLength(0);
  });

  it('getEventsByBoxer returns events involving that boxer', async () => {
    await putCalendarEvent(baseFightEvent); // boxerIds: [1, 2]
    await putCalendarEvent({ ...baseFightEvent, boxerIds: [3, 4], fightId: 11 });
    const boxer1Events = await getEventsByBoxer(1);
    expect(boxer1Events).toHaveLength(1);
    expect(boxer1Events[0].boxerIds).toContain(1);
  });

  it('getEventsByBoxer returns empty array when boxer has no events', async () => {
    await putCalendarEvent(baseFightEvent);
    const result = await getEventsByBoxer(99);
    expect(result).toHaveLength(0);
  });

  it('getEventsByFight returns all events for a fightId', async () => {
    await putCalendarEvent(baseFightEvent);    // fightId: 10
    await putCalendarEvent(baseTrainingCamp); // fightId: 10
    await putCalendarEvent({ ...baseFightEvent, fightId: 11, boxerIds: [3, 4] });
    const fight10Events = await getEventsByFight(10);
    expect(fight10Events).toHaveLength(2);
  });

  it('getEventsByFight returns empty array when fightId has no events', async () => {
    await putCalendarEvent(baseFightEvent);
    const result = await getEventsByFight(99);
    expect(result).toHaveLength(0);
  });

  it('getEventsByType returns only fight events', async () => {
    await putCalendarEvent(baseFightEvent);
    await putCalendarEvent(baseTrainingCamp);
    const fights = await getEventsByType('fight');
    expect(fights).toHaveLength(1);
    expect(fights[0].type).toBe('fight');
  });

  it('getEventsByType returns only training-camp events', async () => {
    await putCalendarEvent(baseFightEvent);
    await putCalendarEvent(baseTrainingCamp);
    const camps = await getEventsByType('training-camp');
    expect(camps).toHaveLength(1);
    expect(camps[0].type).toBe('training-camp');
  });

  it('putCalendarEvent updates an existing event when id is present', async () => {
    const id = await putCalendarEvent(baseFightEvent);
    await putCalendarEvent({ ...baseFightEvent, id, date: '2026-07-01' });
    const event = await getCalendarEvent(id);
    expect(event?.date).toBe('2026-07-01');
  });

  it('putCalendarEvent stores optional training-camp fields', async () => {
    const id = await putCalendarEvent(baseTrainingCamp);
    const event = await getCalendarEvent(id);
    expect(event?.endDate).toBe('2026-05-28');
    expect(event?.intensityLevel).toBe('moderate');
  });

  it('putCalendarEvent with id: undefined inserts as a new event', async () => {
    const id = await putCalendarEvent({ ...baseFightEvent, id: undefined });
    expect(id).toBe(1);
  });

  it('deleteCalendarEvent removes an event by id', async () => {
    const id = await putCalendarEvent(baseFightEvent);
    await deleteCalendarEvent(id);
    const event = await getCalendarEvent(id);
    expect(event).toBeUndefined();
  });

  it('deleteCalendarEvent does not affect other events', async () => {
    const id1 = await putCalendarEvent(baseFightEvent);
    const id2 = await putCalendarEvent(baseTrainingCamp);
    await deleteCalendarEvent(id1);
    const remaining = await getAllCalendarEvents();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/db/calendarEventStore.test.ts
```
Expected: FAIL — `Cannot find module './calendarEventStore'`

---

### Task 6: Implement `calendarEventStore.ts` and pass tests

**Files:**
- Create: `src/db/calendarEventStore.ts`

- [ ] **Step 1: Create `calendarEventStore.ts`**

Create `src/db/calendarEventStore.ts`:
```typescript
import { getDB, type CalendarEvent, type CalendarEventType } from './db';

export async function getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
  const db = await getDB();
  return db.get('calendarEvents', id);
}

export async function getAllCalendarEvents(): Promise<CalendarEvent[]> {
  const db = await getDB();
  return db.getAll('calendarEvents');
}

export async function getEventsByBoxer(boxerId: number): Promise<CalendarEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('calendarEvents', 'boxerIds', boxerId);
}

export async function getEventsByFight(fightId: number): Promise<CalendarEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('calendarEvents', 'fightId', fightId);
}

export async function getEventsByType(type: CalendarEventType): Promise<CalendarEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('calendarEvents', 'type', type);
}

export async function putCalendarEvent(event: Omit<CalendarEvent, 'id'> | CalendarEvent): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = event as CalendarEvent;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('calendarEvents', record as CalendarEvent);
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('calendarEvents', id);
}
```

- [ ] **Step 2: Run tests — expect all pass**

```bash
npx vitest run src/db/calendarEventStore.test.ts
```
Expected: all tests PASS.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/db/calendarEventStore.ts src/db/calendarEventStore.test.ts
git commit -m "feat: add calendarEventStore with CRUD and index queries"
```
