# Season Training Exp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coaches accumulate exp on their style's stats each day the game advances; when enough exp builds up a stat increases by 1; the boxer's PlayerPage shows a green/red progress bar for each trained stat.

**Architecture:** A pure `applyTraining(boxer, coach, days)` function in `src/lib/training.ts` handles all exp math. TopNav calls it for every gym boxer with an assigned coach after each sim step and persists the result. PlayerPage loads the boxer's assigned coach and renders a progress bar alongside the stat value for each coached stat.

**Tech Stack:** React 18, TypeScript, Vitest, IndexedDB (idb), CSS Modules

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/db/db.ts` | Modify | Add `trainingExp?` to `Boxer` interface |
| `src/lib/training.ts` | Create | `STYLE_STATS`, `EXP_PER_DAY`, `applyTraining` pure function |
| `src/lib/training.test.ts` | Create | Unit tests for `applyTraining` |
| `src/components/TopNav/TopNav.tsx` | Modify | Call `applyTraining` + `putBoxer` after each sim step |
| `src/pages/Player/PlayerPage.tsx` | Modify | Load assigned coach; render progress bars for trained stats |
| `src/pages/Player/PlayerPage.module.css` | Modify | Add `.statBar`, `.statBarFill`, `.statBarValue` styles |

---

### Task 1: Add `trainingExp` to the Boxer type

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add `trainingExp` field to the `Boxer` interface**

In `src/db/db.ts`, find the `Boxer` interface (currently ends with `record: FightRecord[];`) and add the optional field:

```ts
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
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: add trainingExp field to Boxer type"
```

---

### Task 2: Create the training library with tests

**Files:**
- Create: `src/lib/training.ts`
- Create: `src/lib/training.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/training.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyTraining, STYLE_STATS, EXP_PER_DAY } from './training';
import type { Boxer, Coach } from '../db/db';

function makeBoxer(overrides: Partial<Boxer> = {}): Boxer {
  return {
    name: 'Test Boxer',
    age: 22,
    weightClass: 'lightweight',
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
    trainingExp: {},
    ...overrides,
  };
}

function makeCoach(overrides: Partial<Coach> = {}): Coach {
  return {
    name: 'Test Coach',
    skillLevel: 'local',
    style: 'out-boxer',
    assignedBoxerId: null,
    ...overrides,
  };
}

describe('STYLE_STATS', () => {
  it('out-boxer trains jab, cross, headMovement, guard, positioning, speed', () => {
    expect(STYLE_STATS['out-boxer']).toEqual(
      expect.arrayContaining(['jab', 'cross', 'headMovement', 'guard', 'positioning', 'speed'])
    );
    expect(STYLE_STATS['out-boxer']).toHaveLength(6);
  });

  it('swarmer trains leadHook, rearHook, bodyMovement, positioning, endurance, toughness', () => {
    expect(STYLE_STATS['swarmer']).toEqual(
      expect.arrayContaining(['leadHook', 'rearHook', 'bodyMovement', 'positioning', 'endurance', 'toughness'])
    );
    expect(STYLE_STATS['swarmer']).toHaveLength(6);
  });

  it('slugger trains rearHook, uppercut, power, endurance, recovery, toughness', () => {
    expect(STYLE_STATS['slugger']).toEqual(
      expect.arrayContaining(['rearHook', 'uppercut', 'power', 'endurance', 'recovery', 'toughness'])
    );
    expect(STYLE_STATS['slugger']).toHaveLength(6);
  });

  it('counterpuncher trains timing, adaptability, discipline, headMovement, bodyMovement, speed', () => {
    expect(STYLE_STATS['counterpuncher']).toEqual(
      expect.arrayContaining(['timing', 'adaptability', 'discipline', 'headMovement', 'bodyMovement', 'speed'])
    );
    expect(STYLE_STATS['counterpuncher']).toHaveLength(6);
  });
});

describe('EXP_PER_DAY', () => {
  it('local = 1, contender = 2, championship-caliber = 4, all-time-great = 8', () => {
    expect(EXP_PER_DAY['local']).toBe(1);
    expect(EXP_PER_DAY['contender']).toBe(2);
    expect(EXP_PER_DAY['championship-caliber']).toBe(4);
    expect(EXP_PER_DAY['all-time-great']).toBe(8);
  });
});

describe('applyTraining', () => {
  it('accumulates exp for coached stats without leveling up', () => {
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 5);
    // local coach = 1 exp/day, 5 days = 5 exp per stat
    // threshold for stat=10 is 100; 5 < 100 so no level-up
    expect(result.trainingExp!['jab']).toBe(5);
    expect(result.trainingExp!['cross']).toBe(5);
    expect(result.trainingExp!['speed']).toBe(5);
    // non-coached stats unchanged
    expect(result.trainingExp!['leadHook']).toBeUndefined();
  });

  it('does not modify the input boxer (immutable)', () => {
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    applyTraining(boxer, coach, 5);
    expect(boxer.trainingExp!['jab']).toBeUndefined();
  });

  it('levels up a stat when exp reaches threshold', () => {
    // stat=10, threshold=100, contender=2exp/day, 50 days = 100 exp → level up
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'contender', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 50);
    expect(result.stats.jab).toBe(11);
    // remainder: 100 exp used, 0 leftover
    expect(result.trainingExp!['jab']).toBe(0);
  });

  it('carries over remainder exp after level-up', () => {
    // stat=10, threshold=100, contender=2/day, 55 days = 110 exp
    // 100 used for level-up, 10 remainder
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'contender', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 55);
    expect(result.stats.jab).toBe(11);
    expect(result.trainingExp!['jab']).toBe(10);
  });

  it('can level up multiple times in one sim step', () => {
    // stat=1, threshold=10, all-time-great=8/day
    // 3 days = 24 exp → level-up at 10 (stat→2, rem=14), level-up at 20 (stat→3, rem=4)
    const boxer = makeBoxer({
      stats: { jab: 1, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: {},
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 3);
    expect(result.stats.jab).toBe(3);
    expect(result.trainingExp!['jab']).toBe(4);
  });

  it('caps stat at 20 without natural talent', () => {
    const boxer = makeBoxer({
      stats: { jab: 20, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: { jab: 190 },
      naturalTalents: [],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    // 1 day × 8 = 8 exp, total 198 — still below threshold 200, no change
    const result = applyTraining(boxer, coach, 1);
    expect(result.stats.jab).toBe(20);
    expect(result.trainingExp!['jab']).toBe(198);
  });

  it('caps stat at 25 with natural talent for that stat', () => {
    const boxer = makeBoxer({
      stats: { jab: 24, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: { jab: 235 },
      naturalTalents: [{ stat: 'jab' }],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    // 1 day × 8 = 8 exp, total 243 — threshold for stat=24 is 240 → level up to 25
    const result = applyTraining(boxer, coach, 1);
    expect(result.stats.jab).toBe(25);
  });

  it('does not exceed cap of 25 even with natural talent', () => {
    const boxer = makeBoxer({
      stats: { jab: 25, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: { jab: 0 },
      naturalTalents: [{ stat: 'jab' }],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 100);
    expect(result.stats.jab).toBe(25);
    // exp still accumulates even at cap (harmless)
  });

  it('accumulates on top of existing exp', () => {
    const boxer = makeBoxer({ trainingExp: { jab: 50 } });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 10);
    // 50 existing + 10 new = 60, threshold=100, no level-up
    expect(result.trainingExp!['jab']).toBe(60);
    expect(result.stats.jab).toBe(10);
  });

  it('trains coach style stats regardless of boxer style', () => {
    // boxer is out-boxer, coach is swarmer — boxer gets swarmer stats trained
    const boxer = makeBoxer({ style: 'out-boxer', trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'swarmer' });
    const result = applyTraining(boxer, coach, 5);
    expect(result.trainingExp!['leadHook']).toBe(5);
    expect(result.trainingExp!['toughness']).toBe(5);
    // out-boxer stats not touched
    expect(result.trainingExp!['jab']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm test -- training 2>&1 | tail -20
```

Expected: multiple FAIL lines — `applyTraining` not defined.

- [ ] **Step 3: Create `src/lib/training.ts`**

```ts
import type { Boxer, BoxerStats, Coach, CoachSkillLevel, FightingStyle } from '../db/db';

export const STYLE_STATS: Record<FightingStyle, (keyof BoxerStats)[]> = {
  'out-boxer':      ['jab', 'cross', 'headMovement', 'guard', 'positioning', 'speed'],
  'swarmer':        ['leadHook', 'rearHook', 'bodyMovement', 'positioning', 'endurance', 'toughness'],
  'slugger':        ['rearHook', 'uppercut', 'power', 'endurance', 'recovery', 'toughness'],
  'counterpuncher': ['timing', 'adaptability', 'discipline', 'headMovement', 'bodyMovement', 'speed'],
};

export const EXP_PER_DAY: Record<CoachSkillLevel, number> = {
  'local': 1,
  'contender': 2,
  'championship-caliber': 4,
  'all-time-great': 8,
};

export function applyTraining(boxer: Boxer, coach: Coach, days: number): Boxer {
  const stats = { ...boxer.stats };
  const exp: Partial<Record<keyof BoxerStats, number>> = { ...(boxer.trainingExp ?? {}) };
  const rate = EXP_PER_DAY[coach.skillLevel];
  const trainedStats = STYLE_STATS[coach.style];
  const talentSet = new Set(boxer.naturalTalents.map(t => t.stat));

  for (const stat of trainedStats) {
    const cap = talentSet.has(stat) ? 25 : 20;
    if (stats[stat] >= cap) continue;

    exp[stat] = (exp[stat] ?? 0) + days * rate;

    while (stats[stat] < cap) {
      const threshold = stats[stat] * 10;
      if ((exp[stat] ?? 0) < threshold) break;
      exp[stat] = (exp[stat] ?? 0) - threshold;
      stats[stat] += 1;
    }
  }

  return { ...boxer, stats, trainingExp: exp };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm test -- training 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/training.ts src/lib/training.test.ts
git commit -m "feat: add applyTraining pure function with full test coverage"
```

---

### Task 3: Apply training on each sim step in TopNav

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`

The `TopNav` already imports `getAllBoxers` and `putBoxer` is not yet imported. After each sim step, for every gym boxer with an assigned coach, we call `applyTraining` and persist the updated boxer.

- [ ] **Step 1: Add imports to TopNav**

At the top of `src/components/TopNav/TopNav.tsx`, add two imports:

```ts
import { putBoxer } from '../../db/boxerStore';
import { getAllCoaches } from '../../db/coachStore';
import { applyTraining } from '../../lib/training';
```

The file's existing imports are:
```ts
import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { getGym, saveGym } from '../../db/gymStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllBoxers } from '../../db/boxerStore';
import { simForward, nextEventDate, addDays } from '../../lib/simTime';
import type { CalendarEvent, Gym } from '../../db/db';
import styles from './TopNav.module.css';
```

Change the boxerStore import line and add the two new imports so it reads:

```ts
import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { getGym, saveGym } from '../../db/gymStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllBoxers, putBoxer } from '../../db/boxerStore';
import { getAllCoaches } from '../../db/coachStore';
import { simForward, nextEventDate, addDays } from '../../lib/simTime';
import { applyTraining } from '../../lib/training';
import type { CalendarEvent, Gym } from '../../db/db';
import styles from './TopNav.module.css';
```

- [ ] **Step 2: Extract a shared `runTraining` helper inside the component**

Add this helper function inside the `TopNav` component body, after `handleSimFight` and before the `return` statement:

```ts
async function runTraining(fromDate: string, toDate: string, gymId: number) {
  const [allBoxers, allCoaches] = await Promise.all([getAllBoxers(), getAllCoaches()]);
  const gymBoxers = allBoxers.filter(b => b.gymId === gymId && b.id !== undefined);
  const days = Math.max(0, dateDiffDays(fromDate, toDate));
  if (days === 0) return;

  await Promise.all(
    gymBoxers.map(boxer => {
      const coach = allCoaches.find(c => c.assignedBoxerId === boxer.id);
      if (!coach) return Promise.resolve();
      const updated = applyTraining(boxer, coach, days);
      return putBoxer(updated);
    })
  );
}
```

- [ ] **Step 3: Add `dateDiffDays` helper at module level (above the component)**

Add this pure function at the top of the file, below the `formatGameDate` function:

```ts
function dateDiffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.round((b - a) / 86_400_000);
}
```

- [ ] **Step 4: Call `runTraining` in `handleSim`**

In `handleSim`, find the block after `await saveGym(updated)` and `setGym(updated)`:

```ts
const updated: Gym = { ...gym, currentDate: result.newDate };
await saveGym(updated);
setGym(updated);
setFightStop(result.stoppedAt);

// Re-fetch events so newly scheduled fights are visible to future sims
const [freshEvts, freshBoxers] = await Promise.all([
  getAllCalendarEvents(),
  getAllBoxers(),
]);
```

Insert the `runTraining` call before the re-fetch:

```ts
const updated: Gym = { ...gym, currentDate: result.newDate };
await saveGym(updated);
setGym(updated);
setFightStop(result.stoppedAt);

await runTraining(currentDate, result.newDate, updated.id ?? 1);

// Re-fetch events so newly scheduled fights are visible to future sims
const [freshEvts, freshBoxers] = await Promise.all([
  getAllCalendarEvents(),
  getAllBoxers(),
]);
```

- [ ] **Step 5: Call `runTraining` in `handleSimFight`**

In `handleSimFight`, the local `currentDate` is declared at the top. Find the block after `await saveGym(updated)`:

```ts
const updated: Gym = { ...gym, currentDate: addDays(currentDate, 1) };
await saveGym(updated);
setGym(updated);
setFightStop(null);
const [freshEvts, freshBoxers] = await Promise.all([
```

Insert the `runTraining` call before the re-fetch:

```ts
const updated: Gym = { ...gym, currentDate: addDays(currentDate, 1) };
await saveGym(updated);
setGym(updated);
setFightStop(null);

await runTraining(currentDate, updated.currentDate, updated.id ?? 1);

const [freshEvts, freshBoxers] = await Promise.all([
```

- [ ] **Step 6: Verify TypeScript compiles cleanly**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/TopNav/TopNav.tsx
git commit -m "feat: apply training exp on each sim step in TopNav"
```

---

### Task 4: Progress bars on PlayerPage

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`
- Modify: `src/pages/Player/PlayerPage.module.css`

- [ ] **Step 1: Add CSS for the progress bar**

In `src/pages/Player/PlayerPage.module.css`, append at the end of the file:

```css
/* Training progress bar */
.statBarWrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 80px;
}

.statBar {
  position: relative;
  width: 60px;
  height: 10px;
  background: var(--danger);
  border-radius: 2px;
  overflow: hidden;
}

.statBarFill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--success);
}

.statBarValue {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 600;
  white-space: nowrap;
}
```

- [ ] **Step 2: Update PlayerPage imports and data loading**

In `src/pages/Player/PlayerPage.tsx`, add the coach store import and the `STYLE_STATS` import. The current imports are:

```ts
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getBoxer, getAllBoxers } from '../../db/boxerStore';
import type { Boxer, BoxerStats, FightRecord } from '../../db/db';
import styles from './PlayerPage.module.css';
```

Change to:

```ts
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getBoxer, getAllBoxers } from '../../db/boxerStore';
import { getAllCoaches } from '../../db/coachStore';
import { STYLE_STATS } from '../../lib/training';
import type { Boxer, BoxerStats, Coach, FightRecord } from '../../db/db';
import styles from './PlayerPage.module.css';
```

- [ ] **Step 3: Add coach state and load it**

In the `PlayerPage` component body, add a `coach` state variable after the existing `useState` calls:

```ts
const [coach, setCoach] = useState<Coach | null | undefined>(undefined);
```

In the `useEffect`, replace the existing load:

```ts
useEffect(() => {
  if (!id) { setBoxer(null); return; }
  let cancelled = false;
  Promise.all([getBoxer(Number(id)), getAllBoxers(), getAllCoaches()]).then(([b, all, coaches]) => {
    if (cancelled) return;
    setBoxer(b ?? null);
    const index = new Map<string, number>();
    for (const boxer of all) {
      if (boxer.id !== undefined) index.set(boxer.name, boxer.id);
    }
    setOpponentIndex(index);
    const assignedCoach = coaches.find(c => c.assignedBoxerId === Number(id)) ?? null;
    setCoach(assignedCoach);
  });
  return () => { cancelled = true; };
}, [id]);
```

- [ ] **Step 4: Derive trained stats set**

After the `const activeTitles` line in the render (inside the main return block, before the JSX), add:

```ts
const trainedStats = new Set<keyof BoxerStats>(
  coach ? STYLE_STATS[coach.style] : []
);
```

- [ ] **Step 5: Replace the stat row value with conditional progress bar**

Find the existing stat row in the stats grid:

```tsx
{group.stats.map(stat => (
  <div key={stat} className={styles.statRow}>
    <span className={styles.statName}>{STAT_LABELS[stat]}</span>
    <span className={styles.statValue}>{boxer.stats[stat]}</span>
  </div>
))}
```

Replace with:

```tsx
{group.stats.map(stat => {
  const isTrained = trainedStats.has(stat);
  const currentExp = boxer.trainingExp?.[stat] ?? 0;
  const threshold = boxer.stats[stat] * 10;
  const pct = threshold > 0 ? Math.min(100, (currentExp / threshold) * 100) : 0;
  return (
    <div key={stat} className={styles.statRow}>
      <span className={styles.statName}>{STAT_LABELS[stat]}</span>
      {isTrained ? (
        <div className={styles.statBarWrapper}>
          <div className={styles.statBar}>
            <div className={styles.statBarFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.statBarValue}>{boxer.stats[stat]}</span>
        </div>
      ) : (
        <span className={styles.statValue}>{boxer.stats[stat]}</span>
      )}
    </div>
  );
})}
```

- [ ] **Step 6: Verify TypeScript compiles cleanly**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Run all tests to confirm nothing broken**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm test 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Player/PlayerPage.tsx src/pages/Player/PlayerPage.module.css
git commit -m "feat: show training exp progress bars on PlayerPage"
```
