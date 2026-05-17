# Boxer Aging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `birthDate` and `lastAgedYear` fields to `Boxer`, increment `age` monthly when the game date crosses a boxer's birth month, and display the full birth date on the boxer profile page.

**Architecture:** `birthDate` (ISO string) and `lastAgedYear` (number) are added as optional fields to the `Boxer` type. A `normalizeBoxer` helper in `boxerStore.ts` lazily fills in missing values for existing records. The monthly aging pass runs inside `TopNav.handleSim` alongside the existing `recruitRefreshDate` check, iterating all boxers once per month-boundary crossing. Age is still the authoritative display value; `birthDate` drives when to increment it.

**Tech Stack:** TypeScript, React 18, IndexedDB via `idb`, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/db/db.ts` | Add `birthDate?: string` and `lastAgedYear?: number` to `Boxer` interface |
| `src/db/boxerStore.ts` | Add `normalizeBoxer` helper; wrap `getBoxer` and `getAllBoxers` to normalize on read |
| `src/db/worldGen.ts` | Populate `birthDate` and `lastAgedYear` when generating boxers |
| `src/components/TopNav/TopNav.tsx` | Add monthly aging pass in `handleSim` (parallel to `recruitRefreshDate` check) |
| `src/pages/Player/PlayerPage.tsx` | Display "Born" field using `birthDate` |
| `src/db/boxerStore.test.ts` | Tests for `normalizeBoxer` behavior |
| `src/components/TopNav/TopNav.test.ts` | Tests for monthly aging trigger in `handleSim` |

---

### Task 1: Add fields to `Boxer` type

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add the two new optional fields to the `Boxer` interface**

In `src/db/db.ts`, find the `Boxer` interface and add two fields after `nextFightDate`:

```typescript
export interface Boxer {
  id?: number;
  name: string;
  age: number;
  weightClass: WeightClass;
  style: FightingStyle;
  reputation: ReputationLevel;
  gymId: number | null;
  federationId: number | null;
  stats: BoxerStats;
  naturalTalents: NaturalTalent[];
  injuries: Injury[];
  titles: TitleRecord[];
  record: FightRecord[];
  trainingExp?: Partial<Record<keyof BoxerStats, number>>;
  tempStatBoost?: {
    stats: Partial<BoxerStats>;
    expiresOnFightId: number;
  };
  rankPoints: number;
  demotionBuffer: number;
  nextFightDate?: string;
  birthDate?: string;      // ISO YYYY-MM-DD; day is approximate
  lastAgedYear?: number;   // year age was last incremented
  lastRankDelta?: {
    points: number;
    bufferPoints: number;
    promoted: boolean;
    demoted: boolean;
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors (new fields are optional, no breaking changes).

- [ ] **Step 3: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: add birthDate and lastAgedYear fields to Boxer type"
```

---

### Task 2: Add `normalizeBoxer` to boxerStore

**Files:**
- Modify: `src/db/boxerStore.ts`
- Test: `src/db/boxerStore.test.ts`

- [ ] **Step 1: Write failing tests for `normalizeBoxer`**

Add to `src/db/boxerStore.test.ts`:

```typescript
import { normalizeBoxer } from './boxerStore';

describe('normalizeBoxer', () => {
  it('leaves birthDate and lastAgedYear unchanged when already present', () => {
    const boxer = {
      ...baseBoxer,
      id: 1,
      birthDate: '2002-06-15',
      lastAgedYear: 2026,
      rankPoints: 0,
      demotionBuffer: 0,
    };
    const result = normalizeBoxer(boxer, 2026);
    expect(result.birthDate).toBe('2002-06-15');
    expect(result.lastAgedYear).toBe(2026);
  });

  it('generates birthDate from age when missing', () => {
    const boxer = { ...baseBoxer, id: 1, age: 22, rankPoints: 0, demotionBuffer: 0 };
    const result = normalizeBoxer(boxer, 2026);
    expect(result.birthDate).toMatch(/^2004-\d{2}-\d{2}$/); // 2026 - 22 = 2004
  });

  it('sets lastAgedYear to currentYear when missing', () => {
    const boxer = { ...baseBoxer, id: 1, rankPoints: 0, demotionBuffer: 0 };
    const result = normalizeBoxer(boxer, 2026);
    expect(result.lastAgedYear).toBe(2026);
  });

  it('generates a birthDate day between 01 and 28', () => {
    const boxer = { ...baseBoxer, id: 1, age: 25, rankPoints: 0, demotionBuffer: 0 };
    const result = normalizeBoxer(boxer, 2026);
    const day = Number(result.birthDate!.split('-')[2]);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(28);
  });

  it('generates a birthDate month between 01 and 12', () => {
    const boxer = { ...baseBoxer, id: 1, age: 25, rankPoints: 0, demotionBuffer: 0 };
    const result = normalizeBoxer(boxer, 2026);
    const month = Number(result.birthDate!.split('-')[1]);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/db/boxerStore.test.ts
```

Expected: FAIL — `normalizeBoxer` not exported.

- [ ] **Step 3: Implement `normalizeBoxer` and update `getBoxer`/`getAllBoxers` to normalize**

Replace contents of `src/db/boxerStore.ts`:

```typescript
import { getDB, type Boxer, type WeightClass } from './db';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function normalizeBoxer(boxer: Boxer, currentYear: number): Boxer {
  if (boxer.birthDate !== undefined && boxer.lastAgedYear !== undefined) return boxer;
  const birthYear = currentYear - boxer.age;
  const birthMonth = boxer.birthDate
    ? Number(boxer.birthDate.split('-')[1])
    : Math.floor(Math.random() * 12) + 1;
  const birthDay = boxer.birthDate
    ? Number(boxer.birthDate.split('-')[2])
    : Math.floor(Math.random() * 28) + 1;
  return {
    ...boxer,
    birthDate: boxer.birthDate ?? `${birthYear}-${pad(birthMonth)}-${pad(birthDay)}`,
    lastAgedYear: boxer.lastAgedYear ?? currentYear,
  };
}

export async function getBoxer(id: number): Promise<Boxer | undefined> {
  const db = await getDB();
  const boxer = await db.get('boxers', id);
  if (!boxer) return undefined;
  const currentYear = new Date().getFullYear();
  return normalizeBoxer(boxer, currentYear);
}

export async function getAllBoxers(): Promise<Boxer[]> {
  const db = await getDB();
  const boxers = await db.getAll('boxers');
  const currentYear = new Date().getFullYear();
  return boxers.map(b => normalizeBoxer(b, currentYear));
}

export async function getBoxersByWeightClass(weightClass: WeightClass): Promise<Boxer[]> {
  const db = await getDB();
  const boxers = await db.getAllFromIndex('boxers', 'weightClass', weightClass);
  const currentYear = new Date().getFullYear();
  return boxers.map(b => normalizeBoxer(b, currentYear));
}

export async function getBoxersByFederation(federationId: number): Promise<Boxer[]> {
  const db = await getDB();
  const boxers = await db.getAllFromIndex('boxers', 'federationId', federationId);
  const currentYear = new Date().getFullYear();
  return boxers.map(b => normalizeBoxer(b, currentYear));
}

export async function putBoxer(boxer: Omit<Boxer, 'id'> | Boxer): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = boxer as Boxer;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('boxers', record as Boxer);
}

export async function deleteBoxer(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('boxers', id);
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/db/boxerStore.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/boxerStore.ts src/db/boxerStore.test.ts
git commit -m "feat: add normalizeBoxer — lazily populates birthDate and lastAgedYear on read"
```

---

### Task 3: Populate `birthDate` and `lastAgedYear` in world gen

**Files:**
- Modify: `src/db/worldGen.ts`

- [ ] **Step 1: Add a `generateBirthDate` helper and use it in boxer generation**

In `src/db/worldGen.ts`, add a helper after the existing RNG helpers (after the `weightedPick` function, around line 44):

```typescript
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function generateBirthDate(age: number): string {
  const birthYear = 2026 - age;
  const birthMonth = rand(1, 12);
  const birthDay = rand(1, 28);
  return `${birthYear}-${pad(birthMonth)}-${pad(birthDay)}`;
}
```

- [ ] **Step 2: Update the boxer object literal in `generateBoxer` (or wherever boxers are constructed in `worldGen.ts`) to include the new fields**

Find every place in `worldGen.ts` where a `Boxer` object literal is created and spread into `putBoxer`. Add `birthDate` and `lastAgedYear`. Search for the pattern `rankPoints:` and add the two new fields alongside it:

```typescript
rankPoints: initialRankPoints,
demotionBuffer: config.bufferMax,
birthDate: generateBirthDate(age),
lastAgedYear: 2026,
```

- [ ] **Step 3: Verify TypeScript compiles with no errors**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/worldGen.ts
git commit -m "feat: populate birthDate and lastAgedYear in world gen"
```

---

### Task 4: Add `runAgingPass` function and wire into `handleSim`

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`
- Test: `src/components/TopNav/TopNav.test.ts`

- [ ] **Step 1: Read existing TopNav test to understand test setup**

```bash
cat /Users/jefsu/Documents/workspace/boxing-manager/src/components/TopNav/TopNav.test.ts
```

- [ ] **Step 2: Write failing tests for aging logic**

The aging logic is easiest to test as a pure function. Add a standalone `runAgingPass` export to `TopNav.tsx` (or a new `src/lib/aging.ts`) — we'll put it in `TopNav.tsx` for now as it's co-located with the other sim helpers. Add tests to `TopNav.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { shouldAgeBoxer } from '../../lib/aging';

describe('shouldAgeBoxer', () => {
  it('returns true when newYear > lastAgedYear and newMonth >= birthMonth', () => {
    expect(shouldAgeBoxer('2002-03-15', 2025, 2026, 4)).toBe(true);
  });

  it('returns true when newYear > lastAgedYear and newMonth === birthMonth', () => {
    expect(shouldAgeBoxer('2002-03-15', 2025, 2026, 3)).toBe(true);
  });

  it('returns false when newYear > lastAgedYear but newMonth < birthMonth', () => {
    expect(shouldAgeBoxer('2002-06-15', 2025, 2026, 3)).toBe(false);
  });

  it('returns false when newYear === lastAgedYear (already aged this year)', () => {
    expect(shouldAgeBoxer('2002-03-15', 2026, 2026, 4)).toBe(false);
  });

  it('returns false when newYear < lastAgedYear', () => {
    expect(shouldAgeBoxer('2002-03-15', 2027, 2026, 4)).toBe(false);
  });
});
```

- [ ] **Step 3: Run to confirm failure**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/components/TopNav/TopNav.test.ts
```

Expected: FAIL — `shouldAgeBoxer` not found.

- [ ] **Step 4: Create `src/lib/aging.ts`**

```typescript
export function shouldAgeBoxer(
  birthDate: string,
  lastAgedYear: number,
  newYear: number,
  newMonth: number,
): boolean {
  if (newYear <= lastAgedYear) return false;
  const birthMonth = Number(birthDate.split('-')[1]);
  return newMonth >= birthMonth;
}
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/components/TopNav/TopNav.test.ts
```

Expected: all `shouldAgeBoxer` tests PASS.

- [ ] **Step 6: Wire aging pass into `handleSim` in `TopNav.tsx`**

In `TopNav.tsx`, import `shouldAgeBoxer`:

```typescript
import { shouldAgeBoxer } from '../../lib/aging';
```

Then in `handleSim`, after the `needsRecruitRefresh` block and before `await runTraining(...)`, add:

```typescript
const oldMonth = currentDate.slice(0, 7); // 'YYYY-MM'
const newMonth = result.newDate.slice(0, 7);
const crossedMonthBoundary = oldMonth !== newMonth;

if (crossedMonthBoundary) {
  const newYear = Number(result.newDate.slice(0, 4));
  const newMonthNum = Number(result.newDate.slice(5, 7));
  const allBoxersForAging = await getAllBoxers();
  await Promise.all(
    allBoxersForAging.map(boxer => {
      if (!boxer.birthDate || !boxer.lastAgedYear) return Promise.resolve();
      if (!shouldAgeBoxer(boxer.birthDate, boxer.lastAgedYear, newYear, newMonthNum)) return Promise.resolve();
      return putBoxer({ ...boxer, age: boxer.age + 1, lastAgedYear: newYear });
    })
  );
}
```

- [ ] **Step 7: Verify TypeScript compiles with no errors**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/aging.ts src/components/TopNav/TopNav.tsx src/components/TopNav/TopNav.test.ts
git commit -m "feat: age boxers monthly when sim crosses birth month in a new year"
```

---

### Task 5: Display birth date on boxer profile

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`

- [ ] **Step 1: Add a `formatBirthDate` helper to `PlayerPage.tsx`**

In `src/pages/Player/PlayerPage.tsx`, add after the existing `formatFightDate` helper (around line 73):

```typescript
function formatBirthDate(birthDate: string | undefined): string {
  if (!birthDate) return '—';
  const [year, month, day] = birthDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
```

- [ ] **Step 2: Add the "Born" row to the header card in `PlayerPage.tsx`**

Find the header card's `<div className={styles.meta}>` block (around line 234) and add a "Born" line below the existing meta span elements:

```tsx
<div className={styles.header}>
  <div className={styles.meta}>
    <span>{boxer.age} yrs</span>
    <span>{capitalize(boxer.weightClass)}</span>
    <span>{styleLabel(boxer.style)}</span>
  </div>
  <div className={styles.meta}>
    <span>Born: {formatBirthDate(boxer.birthDate)}</span>
  </div>
  <div className={styles.record}>{calcRecord(boxer.record)} ({boxer.record.length} fights)</div>
  ...
```

- [ ] **Step 3: Verify TypeScript compiles with no errors**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Player/PlayerPage.tsx
git commit -m "feat: display birth date on boxer profile page"
```

---

### Task 6: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm run dev
```

- [ ] **Step 2: Verify birth dates appear on boxer profiles**

Open http://localhost:5173, navigate to Gym → Roster, click a boxer. Confirm a "Born: Month DD, YYYY" line appears in the header.

- [ ] **Step 3: Verify aging triggers on month boundary**

In God Mode, set the game date to late December (e.g. Dec 28). Find a boxer born in January. Sim forward past January 1. Confirm the boxer's age incremented by 1 on the profile page.

- [ ] **Step 4: Verify new game generates birth dates**

Clear IndexedDB (DevTools → Application → IndexedDB → delete `boxing-manager`), reload, and confirm boxers in Roster all have "Born" dates shown.
