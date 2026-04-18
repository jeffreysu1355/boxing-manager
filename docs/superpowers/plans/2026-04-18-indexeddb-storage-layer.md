# IndexedDB Storage Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a typed IndexedDB storage layer using the `idb` library with CRUD operations for Boxer, Coach, and Gym entities.

**Architecture:** One `db.ts` module opens the database, defines the typed schema, and exports `getDB` and `closeAndResetDB`. Three store modules (`boxerStore.ts`, `coachStore.ts`, `gymStore.ts`) import the db instance and export entity-specific CRUD functions. All entity interfaces live in `db.ts` for now and will move to `src/models/` in a future task.

**Tech Stack:** `idb` (IndexedDB wrapper), Vitest (test runner), `fake-indexeddb` (in-memory IndexedDB for tests)

---

## File Structure

```
src/db/
├── db.ts              # Entity interfaces, DBSchema, getDB, closeAndResetDB
├── db.test.ts         # Tests: DB opens correctly, stores and indexes exist
├── boxerStore.ts      # CRUD: getBoxer, getAllBoxers, getBoxersByWeightClass, putBoxer, deleteBoxer
├── boxerStore.test.ts # Tests: all boxer CRUD operations
├── coachStore.ts      # CRUD: getCoach, getAllCoaches, getCoachesByStyle, putCoach, deleteCoach
├── coachStore.test.ts # Tests: all coach CRUD operations
├── gymStore.ts        # getGym, saveGym (single-record gym)
└── gymStore.test.ts   # Tests: getGym and saveGym
```

**Also modified:**
- `package.json` — add `test` and `test:ui` scripts, add `idb`, `vitest`, `@vitest/ui`, `fake-indexeddb` dependencies
- `vite.config.ts` — add Vitest configuration block

---

### Task 1: Install Dependencies and Configure Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install runtime and test dependencies**

Run:
```bash
npm install idb
npm install --save-dev vitest @vitest/ui fake-indexeddb
```

Expected: `idb` added to `dependencies`; `vitest`, `@vitest/ui`, `fake-indexeddb` added to `devDependencies` in `package.json`.

- [ ] **Step 2: Add test scripts to package.json**

Open `package.json` and update the `"scripts"` block to add `test` and `test:ui`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui"
},
```

- [ ] **Step 3: Configure Vitest in vite.config.ts**

Replace the contents of `vite.config.ts` with:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
```

The `/// <reference types="vitest/config" />` directive gives TypeScript the `test` property on `defineConfig`. Environment `node` is correct here because `fake-indexeddb` patches the global `indexedDB` manually — we don't need a DOM environment.

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

Run:
```bash
npm test
```

Expected output: Something like `No test files found` or `0 tests passed`. No errors about missing config.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "chore: add vitest and idb dependencies, configure test runner"
```

---

### Task 2: DB Schema Setup

**Files:**
- Create: `src/db/db.ts`
- Create: `src/db/db.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/db/db.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { getDB, closeAndResetDB } from './db';

describe('getDB', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('opens a database named boxing-manager', async () => {
    const db = await getDB();
    expect(db.name).toBe('boxing-manager');
  });

  it('creates the boxers object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('boxers')).toBe(true);
  });

  it('creates the coaches object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('coaches')).toBe(true);
  });

  it('creates the gym object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('gym')).toBe(true);
  });

  it('creates a weightClass index on the boxers store', async () => {
    const db = await getDB();
    const tx = db.transaction('boxers', 'readonly');
    expect(tx.store.indexNames.contains('weightClass')).toBe(true);
  });

  it('creates a style index on the coaches store', async () => {
    const db = await getDB();
    const tx = db.transaction('coaches', 'readonly');
    expect(tx.store.indexNames.contains('style')).toBe(true);
  });

  it('returns the same instance on repeated calls', async () => {
    const db1 = await getDB();
    const db2 = await getDB();
    expect(db1).toBe(db2);
  });

  it('returns a new instance after closeAndResetDB', async () => {
    const db1 = await getDB();
    await closeAndResetDB();
    global.indexedDB = new IDBFactory();
    const db2 = await getDB();
    expect(db1).not.toBe(db2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test
```

Expected: Tests fail with `Cannot find module './db'` or similar import error.

- [ ] **Step 3: Create db.ts with all entity interfaces and schema**

Create `src/db/db.ts`:

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// --- Supporting types ---

export type WeightClass =
  | 'flyweight'
  | 'lightweight'
  | 'welterweight'
  | 'middleweight'
  | 'heavyweight';

export type FightingStyle = 'out-boxer' | 'swarmer' | 'slugger' | 'counterpuncher';

export type ReputationLevel =
  | 'Unknown'
  | 'Local Star'
  | 'Rising Star'
  | 'Respectable Opponent'
  | 'Contender'
  | 'Championship Caliber'
  | 'Nationally Ranked'
  | 'World Class Fighter'
  | 'International Superstar'
  | 'All-Time Great';

export type CoachSkillLevel =
  | 'local'
  | 'contender'
  | 'championship-caliber'
  | 'all-time-great';

export interface BoxerStats {
  // Offense
  jab: number;
  cross: number;
  leadHook: number;
  rearHook: number;
  uppercut: number;
  // Defense
  headMovement: number;
  bodyMovement: number;
  guard: number;
  positioning: number;
  // Mental
  timing: number;
  adaptability: number;
  discipline: number;
  // Physical
  speed: number;
  power: number;
  endurance: number;
  recovery: number;
  toughness: number;
}

export interface NaturalTalent {
  name: string;
  affectedStats: (keyof BoxerStats)[];
}

export interface Injury {
  name: string;
  severity: 'minor' | 'moderate' | 'severe';
  recoveryDays: number;
  dateOccurred: string;
}

export interface TitleRecord {
  titleId: number;
  federationId: number;
  weightClass: WeightClass;
  dateWon: string;
  dateLost: string | null;
}

export interface FightRecord {
  result: 'win' | 'loss' | 'draw';
  opponentName: string;
  method: string;
  finishingMove: string | null;
  round: number;
  time: string;
  federation: string;
  date: string;
}

// --- Entity interfaces ---

export interface Boxer {
  id?: number;
  name: string;
  age: number;
  weightClass: WeightClass;
  style: FightingStyle;
  reputation: ReputationLevel;
  gymId: number | null;
  stats: BoxerStats;
  naturalTalents: NaturalTalent[];
  injuries: Injury[];
  titles: TitleRecord[];
  record: FightRecord[];
}

export interface Coach {
  id?: number;
  name: string;
  skillLevel: CoachSkillLevel;
  style: FightingStyle;
  assignedBoxerId: number | null;
}

export interface Gym {
  id?: number;
  name: string;
  level: number;
  balance: number;
  rosterIds: number[];
  coachIds: number[];
}

// --- DB schema ---

interface BoxingManagerDBSchema extends DBSchema {
  boxers: {
    key: number;
    value: Boxer;
    indexes: { weightClass: WeightClass };
  };
  coaches: {
    key: number;
    value: Coach;
    indexes: { style: FightingStyle };
  };
  gym: {
    key: number;
    value: Gym;
  };
}

export type DB = IDBPDatabase<BoxingManagerDBSchema>;

// --- DB singleton ---

let dbInstance: DB | null = null;

export async function getDB(): Promise<DB> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 1, {
    upgrade(db) {
      const boxerStore = db.createObjectStore('boxers', {
        keyPath: 'id',
        autoIncrement: true,
      });
      boxerStore.createIndex('weightClass', 'weightClass');

      const coachStore = db.createObjectStore('coaches', {
        keyPath: 'id',
        autoIncrement: true,
      });
      coachStore.createIndex('style', 'style');

      db.createObjectStore('gym', { keyPath: 'id', autoIncrement: true });
    },
  });
  return dbInstance;
}

export async function closeAndResetDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test
```

Expected: `8 tests passed`.

- [ ] **Step 5: Commit**

```bash
git add src/db/db.ts src/db/db.test.ts
git commit -m "feat: add IndexedDB schema setup with entity interfaces"
```

---

### Task 3: Boxer Store

**Files:**
- Create: `src/db/boxerStore.ts`
- Create: `src/db/boxerStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/db/boxerStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB, type Boxer } from './db';
import {
  getBoxer,
  getAllBoxers,
  getBoxersByWeightClass,
  putBoxer,
  deleteBoxer,
} from './boxerStore';

const baseBoxer: Omit<Boxer, 'id'> = {
  name: 'Test Boxer',
  age: 22,
  weightClass: 'lightweight',
  style: 'out-boxer',
  reputation: 'Unknown',
  gymId: 1,
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

describe('boxerStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('putBoxer inserts a new boxer and returns its id', async () => {
    const id = await putBoxer(baseBoxer);
    expect(id).toBe(1);
  });

  it('putBoxer assigns incrementing ids', async () => {
    const id1 = await putBoxer(baseBoxer);
    const id2 = await putBoxer({ ...baseBoxer, name: 'Second Boxer' });
    expect(id1).toBe(1);
    expect(id2).toBe(2);
  });

  it('getBoxer retrieves a boxer by id', async () => {
    const id = await putBoxer(baseBoxer);
    const boxer = await getBoxer(id);
    expect(boxer?.name).toBe('Test Boxer');
    expect(boxer?.id).toBe(id);
  });

  it('getBoxer returns undefined for a missing id', async () => {
    const boxer = await getBoxer(999);
    expect(boxer).toBeUndefined();
  });

  it('getAllBoxers returns all stored boxers', async () => {
    await putBoxer(baseBoxer);
    await putBoxer({ ...baseBoxer, name: 'Second Boxer' });
    const boxers = await getAllBoxers();
    expect(boxers).toHaveLength(2);
  });

  it('getAllBoxers returns an empty array when no boxers exist', async () => {
    const boxers = await getAllBoxers();
    expect(boxers).toHaveLength(0);
  });

  it('getBoxersByWeightClass returns only boxers of that weight class', async () => {
    await putBoxer(baseBoxer); // lightweight
    await putBoxer({ ...baseBoxer, name: 'Heavy Guy', weightClass: 'heavyweight' });
    const lightweights = await getBoxersByWeightClass('lightweight');
    expect(lightweights).toHaveLength(1);
    expect(lightweights[0].weightClass).toBe('lightweight');
  });

  it('getBoxersByWeightClass returns empty array when no matches', async () => {
    await putBoxer(baseBoxer); // lightweight
    const flyweights = await getBoxersByWeightClass('flyweight');
    expect(flyweights).toHaveLength(0);
  });

  it('putBoxer updates an existing boxer when id is present', async () => {
    const id = await putBoxer(baseBoxer);
    await putBoxer({ ...baseBoxer, id, name: 'Updated Boxer' });
    const boxer = await getBoxer(id);
    expect(boxer?.name).toBe('Updated Boxer');
  });

  it('deleteBoxer removes a boxer by id', async () => {
    const id = await putBoxer(baseBoxer);
    await deleteBoxer(id);
    const boxer = await getBoxer(id);
    expect(boxer).toBeUndefined();
  });

  it('deleteBoxer does not affect other boxers', async () => {
    const id1 = await putBoxer(baseBoxer);
    const id2 = await putBoxer({ ...baseBoxer, name: 'Second Boxer' });
    await deleteBoxer(id1);
    const remaining = await getAllBoxers();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test
```

Expected: Tests fail with `Cannot find module './boxerStore'`.

- [ ] **Step 3: Implement boxerStore.ts**

Create `src/db/boxerStore.ts`:

```ts
import { getDB, type Boxer, type WeightClass } from './db';

export async function getBoxer(id: number): Promise<Boxer | undefined> {
  const db = await getDB();
  return db.get('boxers', id);
}

export async function getAllBoxers(): Promise<Boxer[]> {
  const db = await getDB();
  return db.getAll('boxers');
}

export async function getBoxersByWeightClass(weightClass: WeightClass): Promise<Boxer[]> {
  const db = await getDB();
  return db.getAllFromIndex('boxers', 'weightClass', weightClass);
}

export async function putBoxer(boxer: Omit<Boxer, 'id'> | Boxer): Promise<number> {
  const db = await getDB();
  return db.put('boxers', boxer as Boxer);
}

export async function deleteBoxer(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('boxers', id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test
```

Expected: All boxer store tests pass. Total test count increases by 11.

- [ ] **Step 5: Commit**

```bash
git add src/db/boxerStore.ts src/db/boxerStore.test.ts
git commit -m "feat: add boxer store with CRUD operations"
```

---

### Task 4: Coach Store

**Files:**
- Create: `src/db/coachStore.ts`
- Create: `src/db/coachStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/db/coachStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB, type Coach } from './db';
import {
  getCoach,
  getAllCoaches,
  getCoachesByStyle,
  putCoach,
  deleteCoach,
} from './coachStore';

const baseCoach: Omit<Coach, 'id'> = {
  name: 'Test Coach',
  skillLevel: 'local',
  style: 'out-boxer',
  assignedBoxerId: null,
};

describe('coachStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('putCoach inserts a new coach and returns its id', async () => {
    const id = await putCoach(baseCoach);
    expect(id).toBe(1);
  });

  it('putCoach assigns incrementing ids', async () => {
    const id1 = await putCoach(baseCoach);
    const id2 = await putCoach({ ...baseCoach, name: 'Second Coach' });
    expect(id1).toBe(1);
    expect(id2).toBe(2);
  });

  it('getCoach retrieves a coach by id', async () => {
    const id = await putCoach(baseCoach);
    const coach = await getCoach(id);
    expect(coach?.name).toBe('Test Coach');
    expect(coach?.id).toBe(id);
  });

  it('getCoach returns undefined for a missing id', async () => {
    const coach = await getCoach(999);
    expect(coach).toBeUndefined();
  });

  it('getAllCoaches returns all stored coaches', async () => {
    await putCoach(baseCoach);
    await putCoach({ ...baseCoach, name: 'Second Coach' });
    const coaches = await getAllCoaches();
    expect(coaches).toHaveLength(2);
  });

  it('getAllCoaches returns an empty array when no coaches exist', async () => {
    const coaches = await getAllCoaches();
    expect(coaches).toHaveLength(0);
  });

  it('getCoachesByStyle returns only coaches of that style', async () => {
    await putCoach(baseCoach); // out-boxer
    await putCoach({ ...baseCoach, name: 'Slugger Coach', style: 'slugger' });
    const outBoxerCoaches = await getCoachesByStyle('out-boxer');
    expect(outBoxerCoaches).toHaveLength(1);
    expect(outBoxerCoaches[0].style).toBe('out-boxer');
  });

  it('getCoachesByStyle returns empty array when no matches', async () => {
    await putCoach(baseCoach); // out-boxer
    const swarmers = await getCoachesByStyle('swarmer');
    expect(swarmers).toHaveLength(0);
  });

  it('putCoach updates an existing coach when id is present', async () => {
    const id = await putCoach(baseCoach);
    await putCoach({ ...baseCoach, id, name: 'Updated Coach' });
    const coach = await getCoach(id);
    expect(coach?.name).toBe('Updated Coach');
  });

  it('putCoach can update assignedBoxerId', async () => {
    const id = await putCoach(baseCoach);
    await putCoach({ ...baseCoach, id, assignedBoxerId: 42 });
    const coach = await getCoach(id);
    expect(coach?.assignedBoxerId).toBe(42);
  });

  it('deleteCoach removes a coach by id', async () => {
    const id = await putCoach(baseCoach);
    await deleteCoach(id);
    const coach = await getCoach(id);
    expect(coach).toBeUndefined();
  });

  it('deleteCoach does not affect other coaches', async () => {
    const id1 = await putCoach(baseCoach);
    const id2 = await putCoach({ ...baseCoach, name: 'Second Coach' });
    await deleteCoach(id1);
    const remaining = await getAllCoaches();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test
```

Expected: New coach tests fail with `Cannot find module './coachStore'`. Boxer and DB tests still pass.

- [ ] **Step 3: Implement coachStore.ts**

Create `src/db/coachStore.ts`:

```ts
import { getDB, type Coach, type FightingStyle } from './db';

export async function getCoach(id: number): Promise<Coach | undefined> {
  const db = await getDB();
  return db.get('coaches', id);
}

export async function getAllCoaches(): Promise<Coach[]> {
  const db = await getDB();
  return db.getAll('coaches');
}

export async function getCoachesByStyle(style: FightingStyle): Promise<Coach[]> {
  const db = await getDB();
  return db.getAllFromIndex('coaches', 'style', style);
}

export async function putCoach(coach: Omit<Coach, 'id'> | Coach): Promise<number> {
  const db = await getDB();
  return db.put('coaches', coach as Coach);
}

export async function deleteCoach(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('coaches', id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test
```

Expected: All coach store tests pass. Total test count increases by 12.

- [ ] **Step 5: Commit**

```bash
git add src/db/coachStore.ts src/db/coachStore.test.ts
git commit -m "feat: add coach store with CRUD operations"
```

---

### Task 5: Gym Store

**Files:**
- Create: `src/db/gymStore.ts`
- Create: `src/db/gymStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/db/gymStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB, type Gym } from './db';
import { getGym, saveGym } from './gymStore';

const baseGym: Omit<Gym, 'id'> = {
  name: 'Champions Gym',
  level: 1,
  balance: 10000,
  rosterIds: [],
  coachIds: [],
};

describe('gymStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('getGym returns undefined when no gym exists', async () => {
    const gym = await getGym();
    expect(gym).toBeUndefined();
  });

  it('saveGym creates a new gym on first call', async () => {
    await saveGym(baseGym);
    const gym = await getGym();
    expect(gym).toBeDefined();
    expect(gym?.name).toBe('Champions Gym');
  });

  it('saveGym assigns id 1 to the first gym', async () => {
    await saveGym(baseGym);
    const gym = await getGym();
    expect(gym?.id).toBe(1);
  });

  it('getGym always returns the same single gym record', async () => {
    await saveGym(baseGym);
    const gym1 = await getGym();
    const gym2 = await getGym();
    expect(gym1?.id).toBe(gym2?.id);
  });

  it('saveGym updates the existing gym record', async () => {
    await saveGym(baseGym);
    const created = await getGym();
    await saveGym({ ...created!, level: 2, balance: 50000 });
    const updated = await getGym();
    expect(updated?.level).toBe(2);
    expect(updated?.balance).toBe(50000);
  });

  it('saveGym preserves all fields after update', async () => {
    await saveGym(baseGym);
    const created = await getGym();
    await saveGym({ ...created!, rosterIds: [1, 2, 3] });
    const updated = await getGym();
    expect(updated?.name).toBe('Champions Gym');
    expect(updated?.rosterIds).toEqual([1, 2, 3]);
  });

  it('saveGym can add coachIds', async () => {
    await saveGym(baseGym);
    const created = await getGym();
    await saveGym({ ...created!, coachIds: [10] });
    const updated = await getGym();
    expect(updated?.coachIds).toEqual([10]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test
```

Expected: Gym tests fail with `Cannot find module './gymStore'`. All other tests still pass.

- [ ] **Step 3: Implement gymStore.ts**

Create `src/db/gymStore.ts`:

```ts
import { getDB, type Gym } from './db';

const GYM_ID = 1;

export async function getGym(): Promise<Gym | undefined> {
  const db = await getDB();
  return db.get('gym', GYM_ID);
}

export async function saveGym(gym: Omit<Gym, 'id'> | Gym): Promise<void> {
  const db = await getDB();
  await db.put('gym', { ...gym, id: GYM_ID } as Gym);
}
```

The `GYM_ID = 1` constant enforces the single-record contract: `saveGym` always writes to key 1, and `getGym` always reads from key 1. Auto-increment is not used here — we hardcode the key.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test
```

Expected: All gym store tests pass. Full test suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/db/gymStore.ts src/db/gymStore.test.ts
git commit -m "feat: add gym store with getGym and saveGym"
```

---

### Task 6: Build Verification

- [ ] **Step 1: Run the full test suite**

Run:
```bash
npm test
```

Expected: All tests pass (8 DB tests + 11 boxer tests + 12 coach tests + 7 gym tests = 38 tests).

- [ ] **Step 2: Run TypeScript type check**

Run:
```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run production build**

Run:
```bash
npm run build
```

Expected: Build completes successfully. Output in `dist/`.

- [ ] **Step 4: Commit**

No new files — this task is verification only. If any fixes were needed, commit them with a descriptive message.
