# Coach Recruiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace auto-assigned coaches with a persistent recruiting pool where players hire coaches for a one-time fee and pay monthly salaries, with a gym-level-based cap on total coaches.

**Architecture:** `Coach` gains `gymId` and `monthlySalary` fields; `Gym.coachIds` is removed (coach ownership tracked via `Coach.gymId`). World gen produces a 24-coach recruiting pool (all `gymId: null`). A new `runCoachSalaries` function deducts monthly salary from gym balance during sim. A new Coach Recruiting page under Players handles hiring; the Gym > Coaches page gains release buttons.

**Tech Stack:** React 18, TypeScript, IndexedDB via `idb`, Vitest, React Router v7, CSS Modules

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/db/db.ts` | Modify | Add `gymId`, `monthlySalary` to `Coach`; remove `coachIds` from `Gym`; bump DB to v13; add coach constants |
| `src/db/worldGen.ts` | Modify | Rewrite `generateCoaches()` for 24-coach pool; remove `coachIds` from gym init |
| `src/lib/coachSalaries.ts` | Create | `runCoachSalaries(fromDate, toDate, gymId)` |
| `src/lib/coachSalaries.test.ts` | Create | Unit tests for month-counting and deduction |
| `src/components/TopNav/TopNav.tsx` | Modify | Call `runCoachSalaries` after `simulateNpcFights` |
| `src/pages/Gym/Coaches.tsx` | Modify | Load coaches by `gymId`; add Release buttons; rename section |
| `src/pages/Players/CoachRecruiting.tsx` | Create | New Coach Recruiting page |
| `src/pages/Players/CoachRecruiting.module.css` | Create | Page styles |
| `src/routes.tsx` | Modify | Add `/players/coaches` route |
| `src/components/Sidebar/Sidebar.tsx` | Modify | Add "Coaches" link under Players |
| `src/lib/training.test.ts` | Modify | Update `makeCoach` helper to include new fields |

---

## Task 1: Update `Coach` and `Gym` types, add constants, bump DB to v13

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Update `Coach` interface**

In `src/db/db.ts`, replace the `Coach` interface:

```ts
// Before:
export interface Coach {
  id?: number;
  name: string;
  skillLevel: CoachSkillLevel;
  style: FightingStyle;
  assignedBoxerId: number | null;
}

// After:
export interface Coach {
  id?: number;
  name: string;
  skillLevel: CoachSkillLevel;
  style: FightingStyle;
  assignedBoxerId: number | null;
  gymId: number | null;      // null = available in recruiting pool
  monthlySalary: number;     // deducted monthly from gym balance
}
```

- [ ] **Step 2: Remove `coachIds` from `Gym` interface**

```ts
// Before:
export interface Gym {
  id?: number;
  name: string;
  level: number;
  balance: number;
  rosterIds: number[];
  coachIds: number[];
  currentDate: string;
  recruitRefreshDate?: string;
}

// After:
export interface Gym {
  id?: number;
  name: string;
  level: number;
  balance: number;
  rosterIds: number[];
  currentDate: string;
  recruitRefreshDate?: string;
}
```

- [ ] **Step 3: Add coach constants after the existing type definitions (before the DB schema section)**

Add after the `Gym` interface:

```ts
export const GYM_LEVEL_COACH_CAP: Record<number, number> = {
  1: 5,  2: 5,
  3: 6,  4: 7,
  5: 9,  6: 11,
  7: 13, 8: 15,
  9: 17, 10: 20,
};

export const COACH_HIRING_FEE: Record<CoachSkillLevel, number> = {
  'local':                   5_000,
  'contender':              50_000,
  'championship-caliber':  400_000,
  'all-time-great':      2_000_000,
};

export const COACH_MONTHLY_SALARY: Record<CoachSkillLevel, number> = {
  'local':                    500,
  'contender':              3_000,
  'championship-caliber':  15_000,
  'all-time-great':        75_000,
};
```

- [ ] **Step 4: Bump DB version to 13 and add migration comment**

```ts
// Before:
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 12, {

// After:
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 13, {
```

Add after the `if (oldVersion < 12)` block:

```ts
      if (oldVersion < 13) {
        // Coach gained gymId and monthlySalary fields.
        // Gym.coachIds field is abandoned (coach ownership tracked via Coach.gymId).
        // Existing coach records without gymId/monthlySalary return undefined;
        // runtime code treats gymId undefined as null (available pool).
      }
```

- [ ] **Step 5: Run TypeScript check**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors about `coachIds` missing on Gym usages in `worldGen.ts` (we'll fix in Task 2). No other errors.

- [ ] **Step 6: Update `training.test.ts` `makeCoach` helper**

In `src/lib/training.test.ts`, the `makeCoach` function must include the new fields:

```ts
// Before:
function makeCoach(overrides: Partial<Coach> = {}): Coach {
  return {
    name: 'Test Coach',
    skillLevel: 'local',
    style: 'out-boxer',
    assignedBoxerId: null,
    ...overrides,
  };
}

// After:
function makeCoach(overrides: Partial<Coach> = {}): Coach {
  return {
    name: 'Test Coach',
    skillLevel: 'local',
    style: 'out-boxer',
    assignedBoxerId: null,
    gymId: 1,
    monthlySalary: 500,
    ...overrides,
  };
}
```

- [ ] **Step 7: Commit**

```bash
git add src/db/db.ts src/lib/training.test.ts
git commit -m "feat: add gymId/monthlySalary to Coach, remove coachIds from Gym, add coach constants"
```

---

## Task 2: Update world generation for 24-coach recruiting pool

**Files:**
- Modify: `src/db/worldGen.ts`

- [ ] **Step 1: Import new constants**

At the top of `src/db/worldGen.ts`, add to the existing type imports from `./db`:

```ts
import type {
  Boxer,
  BoxerStats,
  Coach,
  Federation,
  FederationName,
  FightingStyle,
  FightRecord,
  NaturalTalent,
  ReputationLevel,
  Title,
} from './db';
import { COACH_MONTHLY_SALARY } from './db';
```

- [ ] **Step 2: Rewrite `generateCoaches()`**

Replace the entire `generateCoaches` function (currently lines ~514–551):

```ts
async function generateCoaches(): Promise<void> {
  const styles: FightingStyle[] = ['out-boxer', 'swarmer', 'slugger', 'counterpuncher'];

  // 2 Local + 2 Contender + 1 Championship Caliber + 1 All-Time Great per style = 24 total
  const entries: Array<{ skillLevel: CoachSkillLevel; style: FightingStyle }> = [];
  for (const style of styles) {
    entries.push({ skillLevel: 'local', style });
    entries.push({ skillLevel: 'local', style });
    entries.push({ skillLevel: 'contender', style });
    entries.push({ skillLevel: 'contender', style });
    entries.push({ skillLevel: 'championship-caliber', style });
    entries.push({ skillLevel: 'all-time-great', style });
  }

  for (const { skillLevel, style } of entries) {
    const coach: Omit<Coach, 'id'> = {
      name: generateName(pick(FEDERATION_NAMES)),
      skillLevel,
      style,
      assignedBoxerId: null,
      gymId: null,
      monthlySalary: COACH_MONTHLY_SALARY[skillLevel],
    };
    await putCoach(coach);
  }
}
```

Note: `CoachSkillLevel` is already imported via `Coach` type.

- [ ] **Step 3: Remove `coachIds` from gym initialization in `generateWorld()`**

Find the gym save block (around line 780):

```ts
// Before:
  await saveGym({
    name: 'My Gym',
    level: 1,
    balance: 500_000_000,
    rosterIds: [],
    coachIds: [],
    currentDate: '2026-01-01',
  });

  // 7. Seed coaches and update gym
  const coachIds = await generateCoaches();
  const gym = await getGym();
  if (gym) {
    await saveGym({ ...gym, coachIds });
  }

// After:
  await saveGym({
    name: 'My Gym',
    level: 1,
    balance: 500_000_000,
    rosterIds: [],
    currentDate: '2026-01-01',
  });

  // 7. Seed coaches into recruiting pool (all gymId: null)
  await generateCoaches();
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/worldGen.ts
git commit -m "feat: rewrite generateCoaches to produce 24-coach persistent recruiting pool"
```

---

## Task 3: Implement `runCoachSalaries`

**Files:**
- Create: `src/lib/coachSalaries.ts`
- Create: `src/lib/coachSalaries.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/coachSalaries.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { countMonthsElapsed, calcTotalMonthlySalary } from './coachSalaries';
import type { Coach } from '../db/db';

function makeCoach(skillLevel: Coach['skillLevel'], gymId: number | null = 1): Coach {
  return {
    id: 1,
    name: 'Test',
    skillLevel,
    style: 'out-boxer',
    assignedBoxerId: null,
    gymId,
    monthlySalary: skillLevel === 'local' ? 500
      : skillLevel === 'contender' ? 3_000
      : skillLevel === 'championship-caliber' ? 15_000
      : 75_000,
  };
}

describe('countMonthsElapsed', () => {
  it('returns 0 within the same month', () => {
    expect(countMonthsElapsed('2026-01-15', '2026-01-28')).toBe(0);
  });

  it('returns 1 crossing one month boundary', () => {
    expect(countMonthsElapsed('2026-01-15', '2026-02-10')).toBe(1);
  });

  it('returns 2 crossing two month boundaries', () => {
    expect(countMonthsElapsed('2026-01-15', '2026-03-20')).toBe(2);
  });

  it('returns 12 crossing a full year', () => {
    expect(countMonthsElapsed('2026-01-01', '2027-01-01')).toBe(12);
  });

  it('returns 0 for same date', () => {
    expect(countMonthsElapsed('2026-06-01', '2026-06-01')).toBe(0);
  });
});

describe('calcTotalMonthlySalary', () => {
  it('returns 0 with no coaches', () => {
    expect(calcTotalMonthlySalary([], 1)).toBe(0);
  });

  it('returns 0 when no coaches belong to gym', () => {
    const coaches = [makeCoach('local', null), makeCoach('local', 2)];
    expect(calcTotalMonthlySalary(coaches, 1)).toBe(0);
  });

  it('sums salaries of coaches belonging to gym', () => {
    const coaches = [
      makeCoach('local', 1),       // 500
      makeCoach('contender', 1),   // 3000
      makeCoach('local', null),    // not hired
    ];
    expect(calcTotalMonthlySalary(coaches, 1)).toBe(3_500);
  });

  it('ignores coaches from other gyms', () => {
    const coaches = [
      makeCoach('all-time-great', 1),  // 75000
      makeCoach('local', 2),           // different gym
    ];
    expect(calcTotalMonthlySalary(coaches, 1)).toBe(75_000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/coachSalaries.test.ts 2>&1 | head -10
```

Expected: FAIL — `Cannot find module './coachSalaries'`

- [ ] **Step 3: Create `src/lib/coachSalaries.ts`**

```ts
import { getAllCoaches } from '../db/coachStore';
import { getGym, saveGym } from '../db/gymStore';
import type { Coach } from '../db/db';

export function countMonthsElapsed(fromDate: string, toDate: string): number {
  const [fy, fm] = fromDate.split('-').map(Number);
  const [ty, tm] = toDate.split('-').map(Number);
  return Math.max(0, (ty * 12 + tm) - (fy * 12 + fm));
}

export function calcTotalMonthlySalary(coaches: Coach[], gymId: number): number {
  return coaches
    .filter(c => c.gymId === gymId)
    .reduce((sum, c) => sum + c.monthlySalary, 0);
}

export async function runCoachSalaries(
  fromDate: string,
  toDate: string,
  gymId: number,
): Promise<void> {
  const months = countMonthsElapsed(fromDate, toDate);
  if (months === 0) return;

  const [gym, allCoaches] = await Promise.all([getGym(), getAllCoaches()]);
  if (!gym) return;

  const totalPerMonth = calcTotalMonthlySalary(allCoaches, gymId);
  const deduction = totalPerMonth * months;
  if (deduction === 0) return;

  await saveGym({ ...gym, balance: gym.balance - deduction });
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/coachSalaries.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/coachSalaries.ts src/lib/coachSalaries.test.ts
git commit -m "feat: implement runCoachSalaries with monthly deduction"
```

---

## Task 4: Wire `runCoachSalaries` into TopNav

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`

- [ ] **Step 1: Add import**

In `src/components/TopNav/TopNav.tsx`, add after the `simulateNpcFights` import:

```ts
import { runCoachSalaries } from '../../lib/coachSalaries';
```

- [ ] **Step 2: Call `runCoachSalaries` after `simulateNpcFights`**

Find:
```ts
      await runTraining(currentDate, result.newDate, updated.id ?? 1);
      await simulateNpcFights(currentDate, result.newDate);

      if (needsRecruitRefresh) {
```

Change to:
```ts
      await runTraining(currentDate, result.newDate, updated.id ?? 1);
      await simulateNpcFights(currentDate, result.newDate);
      await runCoachSalaries(currentDate, result.newDate, updated.id ?? 1);

      if (needsRecruitRefresh) {
```

- [ ] **Step 3: Run TypeScript check and tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit && npx vitest run 2>&1 | tail -6
```

Expected: no TS errors, all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/TopNav/TopNav.tsx
git commit -m "feat: deduct coach salaries on each sim step"
```

---

## Task 5: Update Gym > Coaches page to use `gymId` and add Release buttons

**Files:**
- Modify: `src/pages/Gym/Coaches.tsx`

- [ ] **Step 1: Rewrite `Coaches.tsx`**

Replace the full contents of `src/pages/Gym/Coaches.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym, saveGym } from '../../db/gymStore';
import { getAllCoaches, putCoach } from '../../db/coachStore';
import { getAllBoxers } from '../../db/boxerStore';
import type { Boxer, Coach, CoachSkillLevel, Gym } from '../../db/db';
import styles from './Coaches.module.css';

const SKILL_LABELS: Record<CoachSkillLevel, string> = {
  'local': 'Local',
  'contender': 'Contender',
  'championship-caliber': 'Championship Caliber',
  'all-time-great': 'All-Time Great',
};

export const COACH_SKILL_INDEX: Record<CoachSkillLevel, number> = {
  'local': 0,
  'contender': 1,
  'championship-caliber': 2,
  'all-time-great': 3,
};

export const GYM_LEVEL_MAX_COACH_SKILL: Record<number, CoachSkillLevel> = {
  1: 'local', 2: 'local', 3: 'local',
  4: 'contender', 5: 'contender', 6: 'contender',
  7: 'championship-caliber', 8: 'championship-caliber', 9: 'championship-caliber',
  10: 'all-time-great',
};

function styleLabel(style: string): string {
  return style.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-');
}

function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

export default function Coaches() {
  const [roster, setRoster] = useState<Boxer[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [gymData, allCoaches, allBoxers] = await Promise.all([
        getGym(),
        getAllCoaches(),
        getAllBoxers(),
      ]);
      if (!cancelled) {
        const gymId = gymData?.id ?? 1;
        const gymRoster = allBoxers.filter(b => b.gymId === gymId);
        const hiredCoaches = allCoaches.filter(c => c.gymId === gymId);
        setRoster(gymRoster);
        setCoaches(hiredCoaches);
        setGym(gymData ?? null);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleAssign(boxer: Boxer, coachIdStr: string) {
    const updated = [...coaches];

    const prevIdx = updated.findIndex(c => c.assignedBoxerId === boxer.id);
    if (prevIdx !== -1) {
      const prev = { ...updated[prevIdx], assignedBoxerId: null };
      updated[prevIdx] = prev;
      await putCoach(prev);
    }

    if (coachIdStr !== '') {
      const newCoachId = Number(coachIdStr);
      const newIdx = updated.findIndex(c => c.id === newCoachId);
      if (newIdx !== -1) {
        const next = { ...updated[newIdx], assignedBoxerId: boxer.id! };
        updated[newIdx] = next;
        await putCoach(next);
      }
    }

    setCoaches(updated);
  }

  async function handleRelease(coach: Coach) {
    const released = { ...coach, gymId: null as null, assignedBoxerId: null as null };
    await putCoach(released);
    setCoaches(prev => prev.filter(c => c.id !== coach.id));
  }

  const gymLevel = gym?.level ?? 1;
  const maxSkillIdx = COACH_SKILL_INDEX[GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local'];
  const unassigned = coaches.filter(c => c.assignedBoxerId === null);

  if (loading) {
    return (
      <div>
        <PageHeader title="Coaches" subtitle="Current coaches and training assignments" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Coaches" subtitle="Current coaches and training assignments" />
      <div className={styles.page}>

        <section>
          <h2 className={styles.sectionTitle}>Roster</h2>
          {roster.length === 0 ? (
            <p className={styles.empty}>No boxers on your roster yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Style</th>
                  <th>Reputation</th>
                  <th>Coach</th>
                </tr>
              </thead>
              <tbody>
                {roster.map(boxer => {
                  const assignedCoach = coaches.find(c => c.assignedBoxerId === boxer.id);
                  return (
                    <tr key={boxer.id}>
                      <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                      <td className={styles.styleTag}>{styleLabel(boxer.style)}</td>
                      <td>{boxer.reputation}</td>
                      <td>
                        <select
                          className={styles.coachSelect}
                          value={assignedCoach?.id?.toString() ?? ''}
                          onChange={e => handleAssign(boxer, e.target.value)}
                        >
                          <option value="">None</option>
                          {coaches
                            .filter(c =>
                              COACH_SKILL_INDEX[c.skillLevel] <= maxSkillIdx ||
                              c.assignedBoxerId === boxer.id
                            )
                            .map(coach => (
                              <option key={coach.id} value={coach.id?.toString()}>
                                {coach.name} ({SKILL_LABELS[coach.skillLevel]})
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Unassigned Coaches</h2>
          {unassigned.length === 0 ? (
            <p className={styles.empty}>All hired coaches are assigned.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Skill Level</th>
                  <th>Style</th>
                  <th>Monthly Salary</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map(coach => (
                  <tr key={coach.id}>
                    <td>{coach.name}</td>
                    <td className={styles.skillTag}>{SKILL_LABELS[coach.skillLevel]}</td>
                    <td className={styles.styleTag}>{styleLabel(coach.style)}</td>
                    <td>{formatMoney(coach.monthlySalary)}/mo</td>
                    <td>
                      <button
                        className={styles.releaseBtn}
                        onClick={() => handleRelease(coach)}
                      >
                        Release
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `releaseBtn` style to `src/pages/Gym/Coaches.module.css`**

Read the current CSS file first, then append:

```css
.releaseBtn {
  background: transparent;
  border: 1px solid var(--danger, #c0392b);
  color: var(--danger, #c0392b);
  padding: 2px 10px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.85rem;
}

.releaseBtn:hover {
  background: var(--danger, #c0392b);
  color: #fff;
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Gym/Coaches.tsx src/pages/Gym/Coaches.module.css
git commit -m "feat: update Coaches page to use gymId, add Release buttons"
```

---

## Task 6: Create Coach Recruiting page

**Files:**
- Create: `src/pages/Players/CoachRecruiting.tsx`
- Create: `src/pages/Players/CoachRecruiting.module.css`
- Modify: `src/routes.tsx`
- Modify: `src/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Create `src/pages/Players/CoachRecruiting.module.css`**

```css
.page {
  padding: 1rem;
}

.balanceCallout {
  margin-bottom: 1rem;
  font-size: 0.95rem;
}

.coachCountCallout {
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
}

.atCap {
  color: var(--danger, #c0392b);
  font-weight: bold;
}

.empty {
  color: var(--text-muted, #888);
  font-style: italic;
}

.hireBtn {
  background: var(--accent, #2980b9);
  color: #fff;
  border: none;
  padding: 3px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.85rem;
}

.hireBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.skillTag {
  font-size: 0.8rem;
}

.styleTag {
  font-size: 0.8rem;
}
```

- [ ] **Step 2: Create `src/pages/Players/CoachRecruiting.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym, saveGym } from '../../db/gymStore';
import { getAllCoaches, putCoach } from '../../db/coachStore';
import {
  GYM_LEVEL_COACH_CAP,
  COACH_HIRING_FEE,
  COACH_MONTHLY_SALARY,
  type Coach,
  type CoachSkillLevel,
  type Gym,
} from '../../db/db';
import { COACH_SKILL_INDEX, GYM_LEVEL_MAX_COACH_SKILL } from '../Gym/Coaches';
import styles from './CoachRecruiting.module.css';

const SKILL_LABELS: Record<CoachSkillLevel, string> = {
  'local': 'Local',
  'contender': 'Contender',
  'championship-caliber': 'Championship Caliber',
  'all-time-great': 'All-Time Great',
};

function styleLabel(style: string): string {
  return style.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-');
}

function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

export default function CoachRecruiting() {
  const [gym, setGym] = useState<Gym | null>(null);
  const [pool, setPool] = useState<Coach[]>([]);
  const [hiredCount, setHiredCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [gymData, allCoaches] = await Promise.all([getGym(), getAllCoaches()]);
      if (!cancelled) {
        const gymId = gymData?.id ?? 1;
        const gymLevel = gymData?.level ?? 1;
        const maxSkillIdx = COACH_SKILL_INDEX[GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local'];
        const available = allCoaches.filter(
          c => c.gymId === null && COACH_SKILL_INDEX[c.skillLevel] <= maxSkillIdx
        );
        const hired = allCoaches.filter(c => c.gymId === gymId).length;
        setGym(gymData ?? null);
        setPool(available);
        setHiredCount(hired);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleHire(coach: Coach) {
    if (!gym || !coach.id) return;
    const gymId = gym.id ?? 1;
    const gymLevel = gym.level ?? 1;
    const cap = GYM_LEVEL_COACH_CAP[gymLevel] ?? 5;
    const fee = COACH_HIRING_FEE[coach.skillLevel];
    if (hiredCount >= cap || gym.balance < fee) return;

    const updatedGym: Gym = { ...gym, balance: gym.balance - fee };
    const updatedCoach: Coach = { ...coach, gymId };

    await Promise.all([saveGym(updatedGym), putCoach(updatedCoach)]);

    setGym(updatedGym);
    setPool(prev => prev.filter(c => c.id !== coach.id));
    setHiredCount(prev => prev + 1);
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Coach Recruiting" subtitle="Hire coaches to train your boxers" />
        <p className={styles.empty}>Loading…</p>
      </div>
    );
  }

  const gymLevel = gym?.level ?? 1;
  const cap = GYM_LEVEL_COACH_CAP[gymLevel] ?? 5;
  const atCap = hiredCount >= cap;

  return (
    <div>
      <PageHeader title="Coach Recruiting" subtitle="Hire coaches to train your boxers" />
      <div className={styles.page}>
        <div className={styles.balanceCallout}>
          Gym Balance: <strong>{formatMoney(gym?.balance ?? 0)}</strong>
        </div>
        <div className={styles.coachCountCallout}>
          Coaches: <strong className={atCap ? styles.atCap : undefined}>{hiredCount} / {cap}</strong>
        </div>

        {pool.length === 0 ? (
          <p className={styles.empty}>No coaches available at your gym level.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Skill Level</th>
                <th>Style</th>
                <th>Monthly Salary</th>
                <th>Hiring Fee</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pool.map(coach => {
                const fee = COACH_HIRING_FEE[coach.skillLevel];
                const canAfford = (gym?.balance ?? 0) >= fee;
                const disabled = atCap || !canAfford;
                const title = atCap ? 'Roster full'
                  : !canAfford ? 'Insufficient funds'
                  : undefined;
                return (
                  <tr key={coach.id}>
                    <td>{coach.name}</td>
                    <td className={styles.skillTag}>{SKILL_LABELS[coach.skillLevel]}</td>
                    <td className={styles.styleTag}>{styleLabel(coach.style)}</td>
                    <td>{formatMoney(coach.monthlySalary)}/mo</td>
                    <td>{formatMoney(fee)}</td>
                    <td>
                      <button
                        className={styles.hireBtn}
                        disabled={disabled}
                        title={title}
                        onClick={() => handleHire(coach)}
                      >
                        Hire
                      </button>
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

- [ ] **Step 3: Add route in `src/routes.tsx`**

Add import:
```ts
import CoachRecruiting from './pages/Players/CoachRecruiting';
```

Add route inside the `players` children array, after `recruiting`:
```ts
          { path: 'coaches', element: <CoachRecruiting /> },
```

The full players children block:
```ts
        children: [
          { index: true, element: <Navigate to="recruiting" replace /> },
          { path: 'recruiting', element: <Recruiting /> },
          { path: 'coaches', element: <CoachRecruiting /> },
          { path: 'compare', element: <Compare /> },
        ],
```

- [ ] **Step 4: Add sidebar link in `src/components/Sidebar/Sidebar.tsx`**

Update the `/players` section:
```ts
  '/players': [
    {
      label: 'Players',
      links: [
        { to: '/players/recruiting', label: 'Recruiting' },
        { to: '/players/coaches', label: 'Coaches' },
        { to: '/players/compare', label: 'Compare' },
      ],
    },
  ],
```

- [ ] **Step 5: Run TypeScript check**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Players/CoachRecruiting.tsx src/pages/Players/CoachRecruiting.module.css src/routes.tsx src/components/Sidebar/Sidebar.tsx
git commit -m "feat: add Coach Recruiting page under Players"
```

---

## Task 7: Update DB version assertion in `db.test.ts`

**Files:**
- Modify: `src/db/db.test.ts`

- [ ] **Step 1: Update version assertions**

In `src/db/db.test.ts`, find all `toBe(12)` version assertions and change to `toBe(13)`:

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && grep -n "toBe(12)" src/db/db.test.ts
```

For each match, change `toBe(12)` → `toBe(13)`. Also update any test description strings that say "version 12" → "version 13".

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/db/db.test.ts
git commit -m "fix: update db.test.ts version assertions to DB v13"
```
