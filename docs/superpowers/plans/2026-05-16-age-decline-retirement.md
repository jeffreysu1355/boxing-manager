# Age Decline & Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Boxers age 35+ train more slowly and lose stats annually (in their birth month); any gym boxer can be retired via their profile page; retired boxers appear on a new `/gym/retired` page.

**Architecture:** Age-based training slowdown is a multiplier applied inside `applyTraining`. Stat regression is a pure function in `aging.ts` called by `runAgingPass` only for boxers that just aged. Retirement sets `boxer.retired = true` in DB; retired boxers are filtered out of training, aging, and the Roster page; a new Retired page and sidebar link expose them.

**Tech Stack:** TypeScript, React 18, IndexedDB via `idb`, React Router v7, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/db/db.ts` | Add `retired?: boolean` to `Boxer` |
| `src/lib/training.ts` | Add `ageTrainingMultiplier`, apply it in `applyTraining`; skip retired boxers in `runTraining` |
| `src/lib/aging.ts` | Add `regressionPointsPerMonth`, `applyStatRegression`; call regression in `runAgingPass` |
| `src/components/TopNav/TopNav.tsx` | Filter retired boxers from `runTraining`; call `applyStatRegression` in `runAgingPass` |
| `src/pages/Player/PlayerPage.tsx` | Add Retire button for gym boxers |
| `src/pages/Gym/Retired.tsx` | New page listing retired gym boxers |
| `src/components/Sidebar/Sidebar.tsx` | Add "Retired" link under Gym section |
| `src/routes.tsx` | Add `/gym/retired` route |
| `src/pages/Gym/Roster.tsx` | Filter out retired boxers |

---

### Task 1: Add `retired` field to `Boxer` type

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add `retired?: boolean` to the `Boxer` interface**

In `src/db/db.ts`, find the `Boxer` interface. Add `retired?: boolean` after `lastAgedYear?: number`:

```typescript
  birthDate?: string;      // ISO YYYY-MM-DD; day is approximate
  lastAgedYear?: number;   // year age was last incremented
  retired?: boolean;       // true = retired, still associated with gym
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: add retired field to Boxer type"
```

---

### Task 2: Age-based training slowdown in `applyTraining`

**Files:**
- Modify: `src/lib/training.ts`
- Test: `src/lib/training.test.ts`

- [ ] **Step 1: Write failing tests for `ageTrainingMultiplier`**

Add to `src/lib/training.test.ts` (import `ageTrainingMultiplier` alongside other imports):

```typescript
import {
  applyTraining,
  STYLE_STATS,
  EXP_PER_DAY,
  computeTrainingCampBoost,
  computeNpcBoost,
  NPC_BOOST_BY_REPUTATION,
  dateDiffDaysTraining,
  applyFightExp,
  FIGHT_EXP_BY_REPUTATION,
  rollTalentGain,
  talentGainProbability,
  ageTrainingMultiplier,
} from './training';
```

Add a new describe block at the bottom of the test file:

```typescript
describe('ageTrainingMultiplier', () => {
  it('returns 1.0 for age 35 and below', () => {
    expect(ageTrainingMultiplier(18)).toBe(1.0);
    expect(ageTrainingMultiplier(25)).toBe(1.0);
    expect(ageTrainingMultiplier(35)).toBe(1.0);
  });

  it('returns 0.95 for age 36', () => {
    expect(ageTrainingMultiplier(36)).toBeCloseTo(0.95, 10);
  });

  it('returns 0.90 for age 37', () => {
    expect(ageTrainingMultiplier(37)).toBeCloseTo(0.90, 10);
  });

  it('returns 0.75 for age 40', () => {
    expect(ageTrainingMultiplier(40)).toBeCloseTo(0.75, 10);
  });

  it('floors at 0.10 for age 53 and above', () => {
    expect(ageTrainingMultiplier(53)).toBe(0.10);
    expect(ageTrainingMultiplier(60)).toBe(0.10);
  });

  it('applyTraining gives less exp for a 40-year-old than a 25-year-old', () => {
    const youngBoxer = makeBoxer({ age: 25, trainingExp: {} });
    const oldBoxer = makeBoxer({ age: 40, trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    const youngResult = applyTraining(youngBoxer, coach, 10);
    const oldResult = applyTraining(oldBoxer, coach, 10);
    expect(oldResult.trainingExp!['jab']).toBeLessThan(youngResult.trainingExp!['jab']!);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/training.test.ts 2>&1 | tail -10
```

Expected: FAIL — `ageTrainingMultiplier` not exported.

- [ ] **Step 3: Implement `ageTrainingMultiplier` and apply it in `applyTraining`**

In `src/lib/training.ts`, add after `EXP_PER_DAY`:

```typescript
export function ageTrainingMultiplier(age: number): number {
  if (age <= 35) return 1.0;
  return Math.max(0.1, 1.0 - (age - 35) * 0.05);
}
```

Then in `applyTraining`, change the rate line from:

```typescript
const rate = EXP_PER_DAY[coach.skillLevel] * gymMultiplier;
```

to:

```typescript
const rate = EXP_PER_DAY[coach.skillLevel] * gymMultiplier * ageTrainingMultiplier(boxer.age);
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/training.test.ts 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/training.ts src/lib/training.test.ts
git commit -m "feat: apply age-based training multiplier — slower gains after 35"
```

---

### Task 3: Stat regression functions in `aging.ts`

**Files:**
- Modify: `src/lib/aging.ts`
- Test: `src/components/TopNav/TopNav.test.ts`

The regression functions are pure and belong in `aging.ts` alongside `shouldAgeBoxer`.

- [ ] **Step 1: Write failing tests**

In `src/components/TopNav/TopNav.test.ts`, add imports and a new describe block. The file already imports from `../../lib/aging`, so update the import to include the new exports:

```typescript
import { shouldAgeBoxer, regressionPointsPerMonth, applyStatRegression } from '../../lib/aging';
```

Add these describe blocks:

```typescript
describe('regressionPointsPerMonth', () => {
  it('returns 0 for age 35 and below', () => {
    expect(regressionPointsPerMonth(18)).toBe(0);
    expect(regressionPointsPerMonth(35)).toBe(0);
  });

  it('returns 0 for age 36–41 (floor of < 1.0)', () => {
    expect(regressionPointsPerMonth(36)).toBe(0);
    expect(regressionPointsPerMonth(41)).toBe(0);
  });

  it('returns 1 for age 42 (floor of 1.05)', () => {
    expect(regressionPointsPerMonth(42)).toBe(1);
  });

  it('returns 2 for age 49 (floor of 2.1)', () => {
    expect(regressionPointsPerMonth(49)).toBe(2);
  });

  it('returns 3 for age 56 (floor of 3.15)', () => {
    expect(regressionPointsPerMonth(56)).toBe(3);
  });
});

describe('applyStatRegression', () => {
  it('returns boxer unchanged when regressionPointsPerMonth is 0', () => {
    // age 35 → 0 points
    const boxer: Boxer = {
      name: 'Test', age: 35, weightClass: 'lightweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: 1, federationId: null, rankPoints: 0, demotionBuffer: 0,
      stats: {
        jab: 10, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [], injuries: [], titles: [], record: [],
    };
    const result = applyStatRegression(boxer);
    expect(result).toBe(boxer); // exact same reference — no copy made
  });

  it('deducts 1 point from a non-style stat for age 42 out-boxer', () => {
    // out-boxer style stats: jab, cross, headMovement, guard, positioning, speed
    // non-style stats include: leadHook, rearHook, uppercut, bodyMovement, timing, adaptability, discipline, power, endurance, recovery, toughness
    // age 42 → 1 point deducted from weakest non-style stat
    const boxer: Boxer = {
      name: 'Test', age: 42, weightClass: 'lightweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: 1, federationId: null, rankPoints: 0, demotionBuffer: 0,
      stats: {
        jab: 15, cross: 15, leadHook: 5, rearHook: 10, uppercut: 10,
        headMovement: 15, bodyMovement: 10, guard: 15, positioning: 15,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 15, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [], injuries: [], titles: [], record: [],
    };
    const result = applyStatRegression(boxer);
    // leadHook is the weakest non-style stat (value 5), so it takes the hit
    expect(result.stats.leadHook).toBe(4);
    // style stats untouched
    expect(result.stats.jab).toBe(15);
    expect(result.stats.cross).toBe(15);
  });

  it('floors stat at 1, not 0', () => {
    const boxer: Boxer = {
      name: 'Test', age: 42, weightClass: 'lightweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: 1, federationId: null, rankPoints: 0, demotionBuffer: 0,
      stats: {
        jab: 10, cross: 10, leadHook: 1, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [], injuries: [], titles: [], record: [],
    };
    const result = applyStatRegression(boxer);
    // leadHook already at 1 (floor), should not drop below 1; move to next weakest non-style
    expect(result.stats.leadHook).toBe(1);
    // next weakest non-style stats are all at 10; one of them takes the point
    const nonStyleStats = ['leadHook', 'rearHook', 'uppercut', 'bodyMovement', 'timing', 'adaptability', 'discipline', 'power', 'endurance', 'recovery', 'toughness'] as const;
    const totalNonStyle = nonStyleStats.reduce((sum, s) => sum + result.stats[s], 0);
    // started at 1 + 10*10 = 101, should be 100 after 1 point deducted from next weakest
    expect(totalNonStyle).toBe(100);
  });

  it('returns a new boxer object (immutable)', () => {
    const boxer: Boxer = {
      name: 'Test', age: 42, weightClass: 'lightweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: 1, federationId: null, rankPoints: 0, demotionBuffer: 0,
      stats: {
        jab: 10, cross: 10, leadHook: 5, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [], injuries: [], titles: [], record: [],
    };
    const result = applyStatRegression(boxer);
    expect(result).not.toBe(boxer);
    expect(boxer.stats.leadHook).toBe(5); // original unchanged
  });
});
```

Note: the `Boxer` type import is already present in `TopNav.test.ts`. If it's not, add:
```typescript
import type { Boxer } from '../../db/db';
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/components/TopNav/TopNav.test.ts 2>&1 | tail -10
```

Expected: FAIL — `regressionPointsPerMonth` and `applyStatRegression` not exported.

- [ ] **Step 3: Implement both functions in `src/lib/aging.ts`**

Replace the full content of `src/lib/aging.ts`:

```typescript
import type { Boxer, BoxerStats } from '../db/db';
import { STYLE_STATS } from './training';

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

export function regressionPointsPerMonth(age: number): number {
  if (age <= 35) return 0;
  return Math.floor((age - 35) * 0.15);
}

export function applyStatRegression(boxer: Boxer): Boxer {
  const points = regressionPointsPerMonth(boxer.age);
  if (points === 0) return boxer;

  const styleSet = new Set<keyof BoxerStats>(STYLE_STATS[boxer.style]);
  const allStats = Object.keys(boxer.stats) as (keyof BoxerStats)[];

  const nonStyleStats = allStats.filter(s => !styleSet.has(s));
  const styleStats = allStats.filter(s => styleSet.has(s));

  const stats = { ...boxer.stats };
  let remaining = points;

  // Deduct from non-style stats first (weakest first), then style stats
  for (const pool of [nonStyleStats, styleStats]) {
    if (remaining === 0) break;
    // Sort ascending by current value so weakest takes the hit first
    const sorted = [...pool].sort((a, b) => stats[a] - stats[b]);
    for (const stat of sorted) {
      if (remaining === 0) break;
      if (stats[stat] <= 1) continue; // already at floor
      stats[stat] -= 1;
      remaining -= 1;
    }
  }

  return { ...boxer, stats };
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/components/TopNav/TopNav.test.ts 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aging.ts src/components/TopNav/TopNav.test.ts
git commit -m "feat: add regressionPointsPerMonth and applyStatRegression to aging.ts"
```

---

### Task 4: Wire regression and retired-boxer filtering into TopNav

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`

- [ ] **Step 1: Read current `runAgingPass` and `runTraining` in TopNav**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && grep -n "runAgingPass\|runTraining\|retired" src/components/TopNav/TopNav.tsx | head -30
```

- [ ] **Step 2: Update imports in TopNav.tsx**

Add `applyStatRegression` to the aging import:

```typescript
import { shouldAgeBoxer, applyStatRegression } from '../../lib/aging';
```

- [ ] **Step 3: Update `runAgingPass` to call `applyStatRegression` for boxers that aged**

Replace the current `runAgingPass` function:

```typescript
async function runAgingPass(fromDate: string, toDate: string, boxers: Boxer[]): Promise<void> {
  if (fromDate.slice(0, 7) === toDate.slice(0, 7)) return;
  const newYear = Number(toDate.slice(0, 4));
  const newMonthNum = Number(toDate.slice(5, 7));
  await Promise.all(
    boxers.map(boxer => {
      if (boxer.retired) return Promise.resolve();
      if (!boxer.birthDate || boxer.lastAgedYear === undefined) return Promise.resolve();
      if (!shouldAgeBoxer(boxer.birthDate, boxer.lastAgedYear, newYear, newMonthNum)) return Promise.resolve();
      const aged = { ...boxer, age: boxer.age + 1, lastAgedYear: newYear };
      const regressed = applyStatRegression(aged);
      return putBoxer(regressed);
    })
  );
}
```

- [ ] **Step 4: Update `runTraining` to skip retired boxers**

Replace the current `runTraining` function:

```typescript
async function runTraining(fromDate: string, toDate: string, gymId: number, gymLevel: number) {
  const [allBoxers, allCoaches] = await Promise.all([getAllBoxers(), getAllCoaches()]);
  const gymBoxers = allBoxers.filter(b => b.gymId === gymId && b.id !== undefined && !b.retired);
  const days = Math.max(0, dateDiffDays(fromDate, toDate));
  if (days === 0) return;

  await Promise.all(
    gymBoxers.map(boxer => {
      const coach = allCoaches.find(c => c.assignedBoxerId === boxer.id);
      if (!coach) return Promise.resolve();
      const updated = applyTraining(boxer, coach, days, gymLevel);
      return putBoxer(updated);
    })
  );
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/TopNav/TopNav.tsx
git commit -m "feat: skip retired boxers in training and aging; apply stat regression on birthday"
```

---

### Task 5: Retire button on `PlayerPage`

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`

- [ ] **Step 1: Read the current PlayerPage header section**

Read `src/pages/Player/PlayerPage.tsx` lines 138–165 to see the load function and state, and lines 218–240 to see the header render area.

- [ ] **Step 2: Add `gymId` state and retire handler**

In `PlayerPage`, the component already loads `gym` to check `godModeEnabled`. Reuse that to get `gymId`.

Find the existing `useEffect` load function. It already does:
```typescript
const [b, coaches, gym] = await Promise.all([getBoxer(Number(id)), getAllCoaches(), getGym()]);
```

Add `putBoxer` to the imports at the top:
```typescript
import { getBoxer, putBoxer } from '../../db/boxerStore';
```

Add a `gymId` state variable alongside the other state:
```typescript
const [gymId, setGymId] = useState<number | null>(null);
```

Inside the load function, after `setGodMode(...)`, add:
```typescript
setGymId(gym?.id ?? null);
```

Add a `handleRetire` function inside the component (after the `useEffect`):
```typescript
async function handleRetire() {
  if (!boxer || boxer.id === undefined) return;
  if (!window.confirm(`Retire ${boxer.name}? This cannot be undone.`)) return;
  await putBoxer({ ...boxer, retired: true });
  navigate('/gym/roster');
}
```

Add `useNavigate` import if not already present — it is already imported via `react-router`.

- [ ] **Step 3: Add the Retire button to the header card**

Find the header card section in the JSX (the `{godMode && (...)}` block around line 221). After that block and before `<div className={styles.page}>`, add the Retire button:

```tsx
{boxer.gymId === gymId && gymId !== null && !boxer.retired && (
  <div style={{ marginBottom: 8 }}>
    <button
      onClick={handleRetire}
      style={{
        padding: '5px 14px',
        background: 'var(--danger)',
        color: '#fff',
        border: 'none',
        borderRadius: 3,
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      Retire Boxer
    </button>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Player/PlayerPage.tsx
git commit -m "feat: add Retire button to boxer profile page"
```

---

### Task 6: Filter retired boxers from Roster and add `/gym/retired` page

**Files:**
- Modify: `src/pages/Gym/Roster.tsx`
- Create: `src/pages/Gym/Retired.tsx`
- Modify: `src/components/Sidebar/Sidebar.tsx`
- Modify: `src/routes.tsx`

- [ ] **Step 1: Filter retired boxers from Roster**

In `src/pages/Gym/Roster.tsx`, find this line (around line 209):

```typescript
const gymRoster = allBoxers.filter(b => b.gymId === gymId);
```

Change it to:

```typescript
const gymRoster = allBoxers.filter(b => b.gymId === gymId && !b.retired);
```

- [ ] **Step 2: Create `src/pages/Gym/Retired.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getAllBoxers } from '../../db/boxerStore';
import { getGym } from '../../db/gymStore';
import type { Boxer } from '../../db/db';
import { calcRecord, capitalize, styleLabel } from './Roster';

export default function Retired() {
  const [retired, setRetired] = useState<Boxer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [gym, allBoxers] = await Promise.all([getGym(), getAllBoxers()]);
      const gymId = gym?.id ?? 1;
      setRetired(allBoxers.filter(b => b.gymId === gymId && b.retired === true));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Retired" subtitle="Alumni of your gym" />
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Retired" subtitle="Alumni of your gym" />
      {retired.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>No retired boxers yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Weight Class</th>
              <th>Style</th>
              <th>Record</th>
              <th>Reputation</th>
            </tr>
          </thead>
          <tbody>
            {retired.map(boxer => (
              <tr key={boxer.id}>
                <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                <td>{boxer.age}</td>
                <td>{capitalize(boxer.weightClass)}</td>
                <td>{styleLabel(boxer.style)}</td>
                <td>{calcRecord(boxer.record)}</td>
                <td>{boxer.reputation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add "Retired" link to Sidebar**

In `src/components/Sidebar/Sidebar.tsx`, find the Gym section links:

```typescript
{
  label: 'Gym',
  prefix: '/gym',
  links: [
    { to: '/gym/roster', label: 'Roster' },
    { to: '/gym/finances', label: 'Finances' },
    { to: '/gym/coaches', label: 'Coaches' },
  ],
},
```

Change to:

```typescript
{
  label: 'Gym',
  prefix: '/gym',
  links: [
    { to: '/gym/roster', label: 'Roster' },
    { to: '/gym/finances', label: 'Finances' },
    { to: '/gym/coaches', label: 'Coaches' },
    { to: '/gym/retired', label: 'Retired' },
  ],
},
```

- [ ] **Step 4: Add `/gym/retired` route**

In `src/routes.tsx`, add the import at the top:

```typescript
import Retired from './pages/Gym/Retired';
```

Then add the route inside the `gym` children array:

```typescript
{ path: 'retired', element: <Retired /> },
```

The gym children should now look like:

```typescript
{
  path: 'gym',
  element: <GymLayout />,
  children: [
    { index: true, element: <Navigate to="roster" replace /> },
    { path: 'roster', element: <Roster /> },
    { path: 'finances', element: <Finances /> },
    { path: 'coaches', element: <Coaches /> },
    { path: 'retired', element: <Retired /> },
  ],
},
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Gym/Roster.tsx src/pages/Gym/Retired.tsx src/components/Sidebar/Sidebar.tsx src/routes.tsx
git commit -m "feat: add Retired page and nav link; filter retired boxers from Roster"
```
