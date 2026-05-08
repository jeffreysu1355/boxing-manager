# Training Camp Stat Boost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players assign boxers to a training camp before a fight to earn a temporary, fight-scoped stat boost that scales with days trained (max 50% at 60 days); NPC opponents in player fights also get a reputation-based fixed boost.

**Architecture:** Boost math lives in `training.ts` alongside the existing `applyTraining`. A new `tempStatBoost` optional field on `Boxer` stores the computed deltas just before a fight and is cleared after. The Roster page gains "Start/Cancel Training Camp" UI. Fight integration hooks into the existing `handleSimFight` path in `TopNav.tsx` (both "Play Fight" and "Sim Fight" go through this path).

**Tech Stack:** TypeScript, React 18, Vitest, IndexedDB via `idb`, CSS Modules.

---

## File Map

| File | Change |
|---|---|
| `src/db/db.ts` | Add `tempStatBoost` field to `Boxer` interface |
| `src/lib/training.ts` | Add `computeTrainingCampBoost` and `computeNpcBoost` functions |
| `src/lib/training.test.ts` | Add unit tests for new functions |
| `src/components/TopNav/fightResultApplier.ts` | Clear `tempStatBoost` after fight resolves |
| `src/components/TopNav/TopNav.tsx` | Apply boost before sim fight; clear stale boosts on time advance |
| `src/pages/Gym/Roster.tsx` | Add training camp UI, boost % display, export helpers |
| `src/pages/Gym/Roster.test.ts` | Add tests for new exported helpers |
| `src/pages/Gym/Roster.module.css` | Add styles for training camp form and boost badge |

---

## Task 1: Add `tempStatBoost` to the `Boxer` type

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add the field to the `Boxer` interface**

In `src/db/db.ts`, after the `trainingExp` field (line 142), add:

```ts
  tempStatBoost?: {
    stats: Partial<BoxerStats>;
    expiresOnFightId: number;
  };
```

The full updated `Boxer` interface around that section:

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
  tempStatBoost?: {
    stats: Partial<BoxerStats>;
    expiresOnFightId: number;
  };
  rankPoints: number;
  demotionBuffer: number;
  nextFightDate?: string;
  lastRankDelta?: {
    points: number;
    bufferPoints: number;
    promoted: boolean;
    demoted: boolean;
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors (or only pre-existing warnings).

- [ ] **Step 3: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: add tempStatBoost field to Boxer type"
```

---

## Task 2: Implement boost calculation functions in `training.ts`

**Files:**
- Modify: `src/lib/training.ts`

- [ ] **Step 1: Add the `dateDiffDays` helper and `computeTrainingCampBoost` function**

Append to `src/lib/training.ts` after the existing `applyTraining` function:

```ts
export function dateDiffDaysTraining(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function computeTrainingCampBoost(
  boxer: Boxer,
  coach: Coach,
  campStartDate: string,
  fightDate: string,
  currentDate: string,
): Partial<Record<keyof BoxerStats, number>> {
  const totalDays = Math.min(60, Math.max(0, dateDiffDaysTraining(campStartDate, fightDate)));
  const trainedDays = Math.min(totalDays, Math.max(0, dateDiffDaysTraining(campStartDate, currentDate)));

  if (totalDays === 0 || trainedDays === 0) return {};

  const earlySegment = Math.max(0, totalDays - 14);
  const earlyDays = Math.min(trainedDays, earlySegment);
  const lateDays = Math.max(0, trainedDays - earlySegment);

  const earlyFraction = earlySegment > 0 ? (earlyDays / earlySegment) * 0.80 : 0;
  const lateFraction = lateDays > 0 ? (lateDays / 14) * 0.20 : 0;
  const boostFraction = earlyFraction + lateFraction;

  const talentSet = new Set(boxer.naturalTalents.map(t => t.stat));
  const result: Partial<Record<keyof BoxerStats, number>> = {};

  for (const stat of STYLE_STATS[coach.style]) {
    const cap = talentSet.has(stat) ? 25 : 20;
    const current = boxer.stats[stat];
    const delta = Math.floor(current * 0.50 * boostFraction);
    const clamped = Math.min(delta, cap - current);
    if (clamped > 0) result[stat] = clamped;
  }

  return result;
}

export const NPC_BOOST_BY_REPUTATION: Record<import('./training').never, never> & Record<string, number> = {
  'Unknown': 0,
  'Local Star': 0.05,
  'Rising Star': 0.10,
  'Respectable Opponent': 0.15,
  'Contender': 0.20,
  'Championship Caliber': 0.25,
  'Nationally Ranked': 0.30,
  'World Class Fighter': 0.35,
  'International Superstar': 0.40,
  'All-Time Great': 0.45,
};

export function computeNpcBoost(boxer: Boxer): Partial<Record<keyof BoxerStats, number>> {
  const fraction = NPC_BOOST_BY_REPUTATION[boxer.reputation] ?? 0;
  if (fraction === 0) return {};

  const talentSet = new Set(boxer.naturalTalents.map(t => t.stat));
  const result: Partial<Record<keyof BoxerStats, number>> = {};

  for (const stat of STYLE_STATS[boxer.style]) {
    const cap = talentSet.has(stat) ? 25 : 20;
    const current = boxer.stats[stat];
    const delta = Math.floor(current * fraction);
    const clamped = Math.min(delta, cap - current);
    if (clamped > 0) result[stat] = clamped;
  }

  return result;
}
```

> Note: The `NPC_BOOST_BY_REPUTATION` map uses `string` keys because `ReputationLevel` is imported from `db.ts`. Replace the awkward `Record<import...>` intersection with a clean typed version:

Actually, use this cleaner version for `NPC_BOOST_BY_REPUTATION`:

```ts
import type { Boxer, BoxerStats, Coach, CoachSkillLevel, FightingStyle, ReputationLevel } from '../db/db';

// (at top — replace the existing import line)
```

And:

```ts
export const NPC_BOOST_BY_REPUTATION: Record<ReputationLevel, number> = {
  'Unknown': 0,
  'Local Star': 0.05,
  'Rising Star': 0.10,
  'Respectable Opponent': 0.15,
  'Contender': 0.20,
  'Championship Caliber': 0.25,
  'Nationally Ranked': 0.30,
  'World Class Fighter': 0.35,
  'International Superstar': 0.40,
  'All-Time Great': 0.45,
};
```

The full updated `src/lib/training.ts` after all changes:

```ts
import type { Boxer, BoxerStats, Coach, CoachSkillLevel, FightingStyle, ReputationLevel } from '../db/db';

export const STYLE_STATS: Record<FightingStyle, (keyof BoxerStats)[]> = {
  'out-boxer':      ['jab', 'cross', 'headMovement', 'guard', 'positioning', 'speed'],
  'swarmer':        ['leadHook', 'rearHook', 'bodyMovement', 'positioning', 'endurance', 'toughness'],
  'slugger':        ['rearHook', 'uppercut', 'power', 'endurance', 'recovery', 'toughness'],
  'counterpuncher': ['timing', 'adaptability', 'discipline', 'headMovement', 'bodyMovement', 'speed'],
};

export const EXP_PER_DAY: Record<CoachSkillLevel, number> = {
  'local': 0.25,
  'contender': 0.5,
  'championship-caliber': 0.75,
  'all-time-great': 1.0,
};

export function applyTraining(boxer: Boxer, coach: Coach, days: number): Boxer {
  const stats = { ...boxer.stats };
  const exp: Partial<Record<keyof BoxerStats, number>> = { ...(boxer.trainingExp ?? {}) };
  const rate = EXP_PER_DAY[coach.skillLevel];
  const trainedStats = STYLE_STATS[coach.style];
  const talentSet = new Set(boxer.naturalTalents.map(t => t.stat));

  for (const stat of trainedStats) {
    const cap = talentSet.has(stat) ? 25 : 20;

    exp[stat] = (exp[stat] ?? 0) + days * rate;

    if (stats[stat] >= cap) continue;
    if (stats[stat] === 0) continue;

    while (stats[stat] < cap) {
      const threshold = stats[stat] * 10;
      if ((exp[stat] ?? 0) < threshold) break;
      exp[stat] = (exp[stat] ?? 0) - threshold;
      stats[stat] += 1;
    }
  }

  return { ...boxer, stats, trainingExp: exp };
}

export function dateDiffDaysTraining(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function computeTrainingCampBoost(
  boxer: Boxer,
  coach: Coach,
  campStartDate: string,
  fightDate: string,
  currentDate: string,
): Partial<Record<keyof BoxerStats, number>> {
  const totalDays = Math.min(60, Math.max(0, dateDiffDaysTraining(campStartDate, fightDate)));
  const trainedDays = Math.min(totalDays, Math.max(0, dateDiffDaysTraining(campStartDate, currentDate)));

  if (totalDays === 0 || trainedDays === 0) return {};

  const earlySegment = Math.max(0, totalDays - 14);
  const earlyDays = Math.min(trainedDays, earlySegment);
  const lateDays = Math.max(0, trainedDays - earlySegment);

  const earlyFraction = earlySegment > 0 ? (earlyDays / earlySegment) * 0.80 : 0;
  const lateFraction = lateDays > 0 ? (lateDays / 14) * 0.20 : 0;
  const boostFraction = earlyFraction + lateFraction;

  const talentSet = new Set(boxer.naturalTalents.map(t => t.stat));
  const result: Partial<Record<keyof BoxerStats, number>> = {};

  for (const stat of STYLE_STATS[coach.style]) {
    const cap = talentSet.has(stat) ? 25 : 20;
    const current = boxer.stats[stat];
    const delta = Math.floor(current * 0.50 * boostFraction);
    const clamped = Math.min(delta, cap - current);
    if (clamped > 0) result[stat] = clamped;
  }

  return result;
}

export const NPC_BOOST_BY_REPUTATION: Record<ReputationLevel, number> = {
  'Unknown': 0,
  'Local Star': 0.05,
  'Rising Star': 0.10,
  'Respectable Opponent': 0.15,
  'Contender': 0.20,
  'Championship Caliber': 0.25,
  'Nationally Ranked': 0.30,
  'World Class Fighter': 0.35,
  'International Superstar': 0.40,
  'All-Time Great': 0.45,
};

export function computeNpcBoost(boxer: Boxer): Partial<Record<keyof BoxerStats, number>> {
  const fraction = NPC_BOOST_BY_REPUTATION[boxer.reputation] ?? 0;
  if (fraction === 0) return {};

  const talentSet = new Set(boxer.naturalTalents.map(t => t.stat));
  const result: Partial<Record<keyof BoxerStats, number>> = {};

  for (const stat of STYLE_STATS[boxer.style]) {
    const cap = talentSet.has(stat) ? 25 : 20;
    const current = boxer.stats[stat];
    const delta = Math.floor(current * fraction);
    const clamped = Math.min(delta, cap - current);
    if (clamped > 0) result[stat] = clamped;
  }

  return result;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/training.ts
git commit -m "feat: add computeTrainingCampBoost and computeNpcBoost to training.ts"
```

---

## Task 3: Unit tests for `computeTrainingCampBoost` and `computeNpcBoost`

**Files:**
- Modify: `src/lib/training.test.ts`

- [ ] **Step 1: Add imports and helpers at the top of the test file**

The existing `makeBoxer` and `makeCoach` helpers already exist. Add the new imports at the top:

```ts
import { describe, it, expect } from 'vitest';
import {
  applyTraining,
  STYLE_STATS,
  EXP_PER_DAY,
  computeTrainingCampBoost,
  computeNpcBoost,
  NPC_BOOST_BY_REPUTATION,
  dateDiffDaysTraining,
} from './training';
import type { Boxer, Coach } from '../db/db';
```

(Replace the existing import line.)

- [ ] **Step 2: Add `computeTrainingCampBoost` test suite**

Append after the existing `applyTraining` describe block:

```ts
describe('computeTrainingCampBoost', () => {
  it('returns empty object when trainedDays is 0', () => {
    const boxer = makeBoxer();
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    // camp starts today, currentDate = campStartDate → 0 days trained
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-05-01');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('returns empty object when totalDays is 0 (fight is today)', () => {
    const boxer = makeBoxer();
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-05-01', '2026-05-01');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('produces ~80% of max boost after training through the early segment only', () => {
    // camp: 2026-05-01 → 2026-07-01 (61 days, capped at 60)
    // currentDate at 46 days in (end of earlySegment = 60-14=46)
    // earlyFraction = (46/46)*0.80 = 0.80, lateFraction = 0
    const boxer = makeBoxer(); // all stats = 10
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-06-16');
    // boostFraction = 0.80, delta = floor(10 * 0.5 * 0.80) = floor(4) = 4
    expect(result['jab']).toBe(4);
    expect(result['cross']).toBe(4);
    expect(result['speed']).toBe(4);
    // non-specialty stats not included
    expect(result['leadHook']).toBeUndefined();
  });

  it('produces full 50% boost after 60 days of training', () => {
    // camp: 2026-05-01 → 2026-07-01 (61 days, capped at 60)
    // currentDate at fight date → trainedDays = totalDays = 60
    const boxer = makeBoxer(); // all stats = 10
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-07-01');
    // boostFraction = 1.0, delta = floor(10 * 0.5 * 1.0) = 5
    expect(result['jab']).toBe(5);
    expect(result['cross']).toBe(5);
  });

  it('clamps delta when stat is at cap (20) without natural talent', () => {
    const boxer = makeBoxer({
      stats: {
        jab: 20, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-07-01');
    // jab=20, cap=20, clamped to 0 → not included
    expect(result['jab']).toBeUndefined();
    // cross=10, delta=5, cap=20, not clamped
    expect(result['cross']).toBe(5);
  });

  it('clamps delta when natural talent stat is at 24 (cap=25, room=1)', () => {
    const boxer = makeBoxer({
      stats: {
        jab: 24, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [{ stat: 'jab' }],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-07-01');
    // jab=24, delta=floor(24*0.5*1.0)=12, cap=25, room=1 → clamped to 1
    expect(result['jab']).toBe(1);
  });

  it('only boosts stats in the coach style, not all stats', () => {
    const boxer = makeBoxer();
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'swarmer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-07-01');
    // swarmer stats: leadHook, rearHook, bodyMovement, positioning, endurance, toughness
    expect(result['leadHook']).toBe(5);
    expect(result['rearHook']).toBe(5);
    // out-boxer stats not boosted
    expect(result['jab']).toBeUndefined();
    expect(result['cross']).toBeUndefined();
  });

  it('caps training days at 60 even if camp is longer', () => {
    // camp is 90 days long; currentDate is also at 90 days
    // totalDays should be capped at 60, trainedDays also capped at 60
    const boxer = makeBoxer();
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    // 2026-05-01 + 90 days = 2026-07-30
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-30', '2026-07-30');
    // full boost regardless of extra days
    expect(result['jab']).toBe(5);
  });
});
```

- [ ] **Step 3: Add `computeNpcBoost` test suite**

Append after the `computeTrainingCampBoost` describe block:

```ts
describe('computeNpcBoost', () => {
  it('returns empty object for Unknown reputation', () => {
    const boxer = makeBoxer({ reputation: 'Unknown' });
    const result = computeNpcBoost(boxer);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('returns 5% boost for Local Star (floor of 10 * 0.05 = 0)', () => {
    const boxer = makeBoxer({ reputation: 'Local Star', style: 'out-boxer' });
    // stat=10, delta=floor(10*0.05)=floor(0.5)=0 → not included
    const result = computeNpcBoost(boxer);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('returns correct boost for All-Time Great (45%)', () => {
    const boxer = makeBoxer({ reputation: 'All-Time Great', style: 'out-boxer' });
    // stat=10, delta=floor(10*0.45)=floor(4.5)=4
    const result = computeNpcBoost(boxer);
    expect(result['jab']).toBe(4);
    expect(result['cross']).toBe(4);
    expect(result['speed']).toBe(4);
    // non-style stats not boosted
    expect(result['leadHook']).toBeUndefined();
  });

  it('boosts style stats only, matching boxer style', () => {
    const boxer = makeBoxer({ reputation: 'All-Time Great', style: 'slugger' });
    // slugger stats: rearHook, uppercut, power, endurance, recovery, toughness
    const result = computeNpcBoost(boxer);
    expect(result['rearHook']).toBe(4);
    expect(result['uppercut']).toBe(4);
    expect(result['jab']).toBeUndefined();
  });

  it('clamps delta so boosted stat does not exceed cap', () => {
    const boxer = makeBoxer({
      reputation: 'All-Time Great',
      style: 'out-boxer',
      stats: {
        jab: 19, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
    });
    // jab=19, delta=floor(19*0.45)=floor(8.55)=8, cap=20, room=1 → clamped to 1
    const result = computeNpcBoost(boxer);
    expect(result['jab']).toBe(1);
  });
});
```

- [ ] **Step 4: Run all tests**

```bash
npm run test 2>&1 | tail -30
```

Expected: all existing tests pass, new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/training.test.ts
git commit -m "test: add unit tests for computeTrainingCampBoost and computeNpcBoost"
```

---

## Task 4: Apply boost in `fightResultApplier.ts` (clear after fight)

**Files:**
- Modify: `src/components/TopNav/fightResultApplier.ts`

- [ ] **Step 1: Clear `tempStatBoost` from both boxers after fight resolves**

In `applyFightResult`, the section that pushes records onto both boxers (step 2) currently calls `putBoxer` on updated winner and loser. Extend those updates to also clear `tempStatBoost` when it references this fight.

Replace the existing step 2 block:

```ts
  // 2. Push records onto both boxers and apply rank changes
  const [winner, loser] = await Promise.all([getBoxer(winnerId), getBoxer(loserId)]);
  if (winner && loser) {
    const updatedWinner = applyRankChange(
      { ...winner, record: [...winner.record, winnerRecord] },
      loser,
      'win',
      isTitleFight,
    );
    const updatedLoser = applyRankChange(
      { ...loser, record: [...loser.record, loserRecord] },
      winner,
      'loss',
      isTitleFight,
    );
    const clearBoostWinner = updatedWinner.tempStatBoost?.expiresOnFightId === fightId
      ? { ...updatedWinner, tempStatBoost: undefined }
      : updatedWinner;
    const clearBoostLoser = updatedLoser.tempStatBoost?.expiresOnFightId === fightId
      ? { ...updatedLoser, tempStatBoost: undefined }
      : updatedLoser;
    await Promise.all([putBoxer(clearBoostWinner), putBoxer(clearBoostLoser)]);
  } else {
    if (winner) {
      const withRecord = { ...winner, record: [...winner.record, winnerRecord] };
      const cleared = withRecord.tempStatBoost?.expiresOnFightId === fightId
        ? { ...withRecord, tempStatBoost: undefined }
        : withRecord;
      await putBoxer(cleared);
    }
    if (loser) {
      const withRecord = { ...loser, record: [...loser.record, loserRecord] };
      const cleared = withRecord.tempStatBoost?.expiresOnFightId === fightId
        ? { ...withRecord, tempStatBoost: undefined }
        : withRecord;
      await putBoxer(cleared);
    }
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TopNav/fightResultApplier.ts
git commit -m "feat: clear tempStatBoost from boxers after fight resolves"
```

---

## Task 5: Apply boost before fight simulation in `TopNav.tsx`

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`

This task covers two things: (a) applying the training camp boost and NPC boost before `simulateFight`, and (b) clearing stale boosts during time sim when a fight day passes without being played.

- [ ] **Step 1: Add new imports at the top of `TopNav.tsx`**

Add to the existing import block:

```ts
import {
  applyTraining,
  computeTrainingCampBoost,
  computeNpcBoost,
} from '../../lib/training';
import { getEventsByFight } from '../../db/calendarEventStore';
import { getAllFights } from '../../db/fightStore';
```

(The file already imports `applyTraining` and `getAllCalendarEvents` — update the training import to include the new exports, and add `getEventsByFight` and `getAllFights`.)

- [ ] **Step 2: Add a `applyBoostAndSim` helper function**

Add this function above `handleSim` in `TopNav.tsx`:

```ts
async function applyBoostAndSim(
  boxerA: import('../../db/db').Boxer,
  boxerB: import('../../db/db').Boxer,
  fight: import('../../db/db').Fight,
  allCoaches: import('../../db/db').Coach[],
  allCampEvents: import('../../db/db').CalendarEvent[],
  currentDate: string,
  gymBoxerIdSet: Set<number>,
): Promise<{ boostedA: import('../../db/db').Boxer; boostedB: import('../../db/db').Boxer }> {
  function applyBoost(
    boxer: import('../../db/db').Boxer,
    isGymBoxer: boolean,
  ): import('../../db/db').Boxer {
    if (isGymBoxer) {
      const campEvent = allCampEvents.find(
        e => e.type === 'training-camp' && e.fightId === fight.id && e.boxerIds.includes(boxer.id!)
      );
      const coach = allCoaches.find(c => c.assignedBoxerId === boxer.id);
      if (campEvent && coach && campEvent.endDate) {
        const deltas = computeTrainingCampBoost(boxer, coach, campEvent.date, campEvent.endDate, currentDate);
        const boostedStats = { ...boxer.stats };
        for (const [stat, delta] of Object.entries(deltas) as [keyof import('../../db/db').BoxerStats, number][]) {
          boostedStats[stat] = (boostedStats[stat] as number) + delta;
        }
        return { ...boxer, stats: boostedStats };
      }
      return boxer;
    } else {
      const deltas = computeNpcBoost(boxer);
      const boostedStats = { ...boxer.stats };
      for (const [stat, delta] of Object.entries(deltas) as [keyof import('../../db/db').BoxerStats, number][]) {
        boostedStats[stat] = (boostedStats[stat] as number) + delta;
      }
      return { ...boxer, stats: boostedStats };
    }
  }

  const aIsGym = gymBoxerIdSet.has(boxerA.id!);
  const bIsGym = gymBoxerIdSet.has(boxerB.id!);

  return {
    boostedA: applyBoost(boxerA, aIsGym),
    boostedB: applyBoost(boxerB, bIsGym),
  };
}
```

- [ ] **Step 3: Update `handleSimFight` to use boosts**

In the `handleSimFight` function, after fetching `boxerA`, `boxerB`, `federation`, and before calling `simulateFight`, add the boost step. Replace:

```ts
        const simResult = simulateFight(boxerA, boxerB, fight, federation.name);
```

With:

```ts
        const allCampEvents = await getAllCalendarEvents();
        const { boostedA, boostedB } = await applyBoostAndSim(
          boxerA, boxerB, fight, allCoaches, allCampEvents, currentDate, gymBoxerIds,
        );
        const simResult = simulateFight(boostedA, boostedB, fight, federation.name);
```

Also add `allCoaches` to the existing fetch in `handleSimFight`. The fetch currently does:

```ts
        const [boxerA, boxerB, federation] = await Promise.all([
          getBoxer(fight.boxerIds[0]),
          getBoxer(fight.boxerIds[1]),
          getFederation(fight.federationId),
        ]);
```

Change to:

```ts
        const [boxerA, boxerB, federation, allCoaches] = await Promise.all([
          getBoxer(fight.boxerIds[0]),
          getBoxer(fight.boxerIds[1]),
          getFederation(fight.federationId),
          getAllCoaches(),
        ]);
```

- [ ] **Step 4: Clear stale boosts when time advances past a fight date**

In `handleSim`, after `await runTraining(...)`, add:

```ts
      // Clear tempStatBoost for gym boxers whose fight day has passed
      const allGymBoxers = await getAllBoxers();
      const gymBoxerList = allGymBoxers.filter(b => b.gymId === (updated.id ?? 1) && b.id !== undefined);
      const allFightsData = await getAllFights();
      const fightDateMap = new Map(allFightsData.filter(f => f.id !== undefined).map(f => [f.id!, f.date]));
      await Promise.all(
        gymBoxerList
          .filter(b => {
            const boost = b.tempStatBoost;
            if (!boost) return false;
            const fightDate = fightDateMap.get(boost.expiresOnFightId);
            return fightDate !== undefined && fightDate <= result.newDate;
          })
          .map(b => putBoxer({ ...b, tempStatBoost: undefined }))
      );
```

Make sure `getAllFights` is imported — add to the existing import:

```ts
import { getFight, getAllFights } from '../../db/fightStore';
```

(The file currently only imports `getFight`.)

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/TopNav/TopNav.tsx
git commit -m "feat: apply training camp and NPC boost before fight sim; clear stale boosts on time advance"
```

---

## Task 6: Roster UI — training camp form and boost display

**Files:**
- Modify: `src/pages/Gym/Roster.tsx`
- Modify: `src/pages/Gym/Roster.module.css`

- [ ] **Step 1: Add new imports and exports to `Roster.tsx`**

Add to the imports at the top:

```ts
import { putCalendarEvent, deleteCalendarEvent } from '../../db/calendarEventStore';
import { computeTrainingCampBoost, dateDiffDaysTraining } from '../../lib/training';
import { getAllCoaches } from '../../db/coachStore';
import type { Coach } from '../../db/db';
```

- [ ] **Step 2: Add `computeCampBoostPct` helper (exported for tests)**

Add this exported function after `capitalize`:

```ts
export function computeCampBoostPct(
  campStartDate: string,
  fightDate: string,
  currentDate: string,
): number {
  const totalDays = Math.min(60, Math.max(0, dateDiffDaysTraining(campStartDate, fightDate)));
  const trainedDays = Math.min(totalDays, Math.max(0, dateDiffDaysTraining(campStartDate, currentDate)));

  if (totalDays === 0 || trainedDays === 0) return 0;

  const earlySegment = Math.max(0, totalDays - 14);
  const earlyDays = Math.min(trainedDays, earlySegment);
  const lateDays = Math.max(0, trainedDays - earlySegment);

  const earlyFraction = earlySegment > 0 ? (earlyDays / earlySegment) * 0.80 : 0;
  const lateFraction = lateDays > 0 ? (lateDays / 14) * 0.20 : 0;
  return Math.round((earlyFraction + lateFraction) * 50);
}
```

- [ ] **Step 3: Add training camp state and data to the `Roster` component**

In the `Roster` component, add new state:

```ts
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [campEvents, setCampEvents] = useState<CalendarEvent[]>([]);
  const [campFormBoxerId, setCampFormBoxerId] = useState<number | null>(null);
  const [campStartInput, setCampStartInput] = useState('');
```

In the `load()` function inside `useEffect`, add `getAllCoaches()` to the Promise.all and set state:

```ts
      const [gym, allBoxers, allEvents, allFights, allFederations, allCoaches] = await Promise.all([
        getGym(),
        getAllBoxers(),
        getAllCalendarEvents(),
        getAllFights(),
        getAllFederations(),
        getAllCoaches(),
      ]);
      // ... existing code ...
      setCoaches(allCoaches);
      setCampEvents(allEvents.filter(e => e.type === 'training-camp'));
```

- [ ] **Step 4: Add training camp action handlers**

Add these handlers inside the `Roster` component, after the existing state declarations:

```ts
  async function handleStartCamp(boxerId: number, fightId: number, fightDate: string) {
    if (!campStartInput) return;
    await putCalendarEvent({
      type: 'training-camp',
      date: campStartInput,
      endDate: fightDate,
      fightId,
      boxerIds: [boxerId],
    });
    setCampFormBoxerId(null);
    setCampStartInput('');
    // Reload events
    const allEvents = await import('../../db/calendarEventStore').then(m => m.getAllCalendarEvents());
    setEvents(allEvents);
    setCampEvents(allEvents.filter(e => e.type === 'training-camp'));
  }

  async function handleCancelCamp(campEventId: number) {
    await deleteCalendarEvent(campEventId);
    const allEvents = await import('../../db/calendarEventStore').then(m => m.getAllCalendarEvents());
    setEvents(allEvents);
    setCampEvents(allEvents.filter(e => e.type === 'training-camp'));
  }
```

- [ ] **Step 5: Update `getBoxerStatus` to show boost % in label**

The existing `getBoxerStatus` returns a static label `'In Training Camp'`. Update it to accept an optional `boostPct` parameter:

```ts
export function getBoxerStatus(
  boxer: Boxer,
  events: CalendarEvent[],
  today: string,
  boostPct?: number,
): BoxerStatus {
  if (boxer.id === undefined) return { label: 'Active', color: 'var(--success)' };
  const activeInjuries = boxer.injuries.filter(i => i.recoveryDays > 0);
  if (activeInjuries.length > 0) {
    const worst = activeInjuries.reduce((a, b) =>
      SEVERITY_ORDER[b.severity] > SEVERITY_ORDER[a.severity] ? b : a
    );
    const sev = worst.severity.charAt(0).toUpperCase() + worst.severity.slice(1);
    const days = worst.recoveryDays;
    return { label: `Injured (${sev}, ${days} day${days === 1 ? '' : 's'})`, color: 'var(--danger)' };
  }

  const boxerEvents = events.filter(e => e.boxerIds.includes(boxer.id!) && e.date >= today);
  if (boxerEvents.some(e => e.type === 'training-camp')) {
    const label = boostPct !== undefined && boostPct > 0
      ? `In Training Camp · +${boostPct}%`
      : 'In Training Camp';
    return { label, color: 'var(--warning)' };
  }
  if (boxerEvents.some(e => e.type === 'fight')) {
    return { label: 'Scheduled Fight', color: '#2196f3' };
  }
  return { label: 'Active', color: 'var(--success)' };
}
```

- [ ] **Step 6: Update the Roster table render to include camp UI**

In the `roster.map(boxer => ...)` block, compute camp context before the return:

```tsx
              {roster.map(boxer => {
                // Find the next fight event for this boxer
                const nextFightEvent = events
                  .filter(e => e.type === 'fight' && e.boxerIds.includes(boxer.id!) && e.date > today)
                  .sort((a, b) => a.date.localeCompare(b.date))[0];

                // Find active training camp event for this boxer's next fight
                const campEvent = nextFightEvent
                  ? campEvents.find(e => e.fightId === nextFightEvent.fightId && e.boxerIds.includes(boxer.id!))
                  : undefined;

                // Compute boost %
                const boostPct = campEvent
                  ? computeCampBoostPct(campEvent.date, campEvent.endDate ?? nextFightEvent!.date, today)
                  : undefined;

                const status = getBoxerStatus(boxer, events, today, boostPct);
                const nextFight = getNextFight(boxer, events, fightsMap, federationsMap, today, boxersMap);
                const hasActiveFight = events.some(e => e.type === 'fight' && e.boxerIds.includes(boxer.id!) && e.date >= today);
                const hasActiveInjury = boxer.injuries.some(i => i.recoveryDays > 0);
                const showCampButton = nextFightEvent && !campEvent && !hasActiveInjury;
                const showCampForm = campFormBoxerId === boxer.id;

                return (
                  <tr key={boxer.id}>
                    <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                    <td>{boxer.age}</td>
                    <td>{capitalize(boxer.weightClass)}</td>
                    <td className={styles.styleTag}>{styleLabel(boxer.style)}</td>
                    <td>{calcRecord(boxer.record)}</td>
                    <td><RankMiniBar boxer={boxer} /></td>
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
                    <td>
                      {!hasActiveFight && !hasActiveInjury && (
                        <button
                          className={styles.scheduleBtn}
                          onClick={() => navigate(`/league/schedule?boxerId=${boxer.id}`)}
                        >
                          Schedule Fight
                        </button>
                      )}
                      {campEvent && campEvent.id !== undefined && (
                        <button
                          className={styles.cancelCampBtn}
                          onClick={() => handleCancelCamp(campEvent.id!)}
                        >
                          Cancel Camp
                        </button>
                      )}
                      {showCampButton && !showCampForm && (
                        <button
                          className={styles.scheduleBtn}
                          onClick={() => {
                            setCampFormBoxerId(boxer.id!);
                            setCampStartInput(today);
                          }}
                        >
                          Start Training Camp
                        </button>
                      )}
                      {showCampForm && (
                        <div className={styles.campForm}>
                          <input
                            type="date"
                            className={styles.campDateInput}
                            value={campStartInput}
                            min={today}
                            max={nextFightEvent!.date}
                            onChange={e => setCampStartInput(e.target.value)}
                          />
                          <button
                            className={styles.campConfirmBtn}
                            onClick={() => handleStartCamp(boxer.id!, nextFightEvent!.fightId, nextFightEvent!.date)}
                          >
                            Start Camp
                          </button>
                          <button
                            className={styles.cancelCampBtn}
                            onClick={() => { setCampFormBoxerId(null); setCampStartInput(''); }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
```

- [ ] **Step 7: Add CSS for new elements**

Append to `src/pages/Gym/Roster.module.css`:

```css
.campForm {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.campDateInput {
  font-size: 11px;
  padding: 2px 4px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 3px;
}

.campConfirmBtn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid var(--success);
  background: transparent;
  color: var(--success);
  border-radius: 3px;
  cursor: pointer;
}

.cancelCampBtn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid var(--danger);
  background: transparent;
  color: var(--danger);
  border-radius: 3px;
  cursor: pointer;
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Gym/Roster.tsx src/pages/Gym/Roster.module.css
git commit -m "feat: add training camp UI to Roster page with boost % display"
```

---

## Task 7: Unit tests for new Roster helpers

**Files:**
- Modify: `src/pages/Gym/Roster.test.ts`

- [ ] **Step 1: Add import for new helpers**

Update the import at the top of `src/pages/Gym/Roster.test.ts`:

```ts
import {
  getBoxerStatus,
  getNextFight,
  calcRecord,
  styleLabel,
  capitalize,
  computeCampBoostPct,
} from './Roster';
```

- [ ] **Step 2: Add tests for `computeCampBoostPct`**

Append after the existing describe blocks:

```ts
describe('computeCampBoostPct', () => {
  it('returns 0 when no days trained (currentDate = campStartDate)', () => {
    expect(computeCampBoostPct('2026-05-01', '2026-07-01', '2026-05-01')).toBe(0);
  });

  it('returns 0 when fight is today (totalDays = 0)', () => {
    expect(computeCampBoostPct('2026-05-01', '2026-05-01', '2026-05-01')).toBe(0);
  });

  it('returns 40 (80% of 50%) after training through the early segment', () => {
    // camp 2026-05-01 → 2026-07-01 (61 days → totalDays capped at 60)
    // earlySegment = 60-14 = 46
    // currentDate at 46 days in: 2026-05-01 + 46 = 2026-06-16
    expect(computeCampBoostPct('2026-05-01', '2026-07-01', '2026-06-16')).toBe(40);
  });

  it('returns 50 after full 60 days of training', () => {
    // camp 2026-05-01 → 2026-07-01, currentDate = fight date
    expect(computeCampBoostPct('2026-05-01', '2026-07-01', '2026-07-01')).toBe(50);
  });
});

describe('getBoxerStatus with boostPct', () => {
  it('shows boost % in label when in training camp and boostPct provided', () => {
    const events: CalendarEvent[] = [
      { id: 1, type: 'training-camp', date: '2026-05-01', boxerIds: [1], fightId: 10 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY, 32);
    expect(status.label).toBe('In Training Camp · +32%');
  });

  it('omits boost % when boostPct is 0', () => {
    const events: CalendarEvent[] = [
      { id: 1, type: 'training-camp', date: '2026-05-01', boxerIds: [1], fightId: 10 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY, 0);
    expect(status.label).toBe('In Training Camp');
  });

  it('omits boost % when boostPct is undefined', () => {
    const events: CalendarEvent[] = [
      { id: 1, type: 'training-camp', date: '2026-05-01', boxerIds: [1], fightId: 10 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY);
    expect(status.label).toBe('In Training Camp');
  });
});
```

- [ ] **Step 3: Run all tests**

```bash
npm run test 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Gym/Roster.test.ts
git commit -m "test: add unit tests for computeCampBoostPct and updated getBoxerStatus"
```

---

## Task 8: Update `PRD.md`

**Files:**
- Modify: `PRD.md`

- [ ] **Step 1: Find and mark the training camp boost item**

Search `PRD.md` for any training-related checklist items in the Coach System section and mark the pre-fight training camp feature as complete. If no specific item exists, add and check one under the Coach System section:

```markdown
- [x] Pre-fight training camp: temporary stat boost (scales with days, max 50% at 60 days)
```

- [ ] **Step 2: Commit**

```bash
git add PRD.md
git commit -m "docs: mark training camp stat boost as complete in PRD.md"
```
