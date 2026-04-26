# Fight Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement fight simulation so "Sim Fight" computes a winner from stats + style + randomness, then persists the result to both boxers' records and the Fight record in IndexedDB.

**Architecture:** A pure `simulateFight` function in `src/lib/fightSim.ts` computes the outcome with no DB access. `TopNav.tsx`'s `handleSimFight` loads the relevant data, calls `simulateFight`, and writes all DB updates before advancing the game date.

**Tech Stack:** TypeScript, React, IndexedDB via `idb`, Vitest for tests, `fake-indexeddb` for test isolation.

---

## File Map

- **Create:** `src/lib/fightSim.ts` — pure fight simulation function and helpers
- **Create:** `src/lib/fightSim.test.ts` — unit tests for the simulation algorithm
- **Modify:** `src/components/TopNav/TopNav.tsx` — wire `handleSimFight` to call `simulateFight` and persist results

---

## Task 1: Pure fight simulation function

**Files:**
- Create: `src/lib/fightSim.ts`
- Create: `src/lib/fightSim.test.ts`

### Background

The algorithm (from spec):

**Stat score** — weighted average of all 17 stats, focus stats weighted 2x, normalized to 0–1 by dividing by 20:
```
statScore(boxer) = sum(stat * weight) / sum(weights) / 20
```

Focus stats per style:
- `'out-boxer'`: jab, cross, headMovement, guard, positioning, speed
- `'swarmer'`: leadHook, rearHook, bodyMovement, positioning, endurance, toughness
- `'slugger'`: rearHook, uppercut, power, endurance, recovery, toughness
- `'counterpuncher'`: timing, adaptability, discipline, headMovement, bodyMovement, speed

**Style score for boxer A** (1.0 if A counters B, 0.5 neutral, 0.0 if B counters A):
- Out-Boxer counters Counterpuncher
- Swarmer counters Out-Boxer
- Slugger counters Swarmer
- Counterpuncher counters Slugger

**Tier gap** (reputation index 0–9: Unknown=0 … All-Time Great=9):
```
randomWeight = Math.max(0.01, 0.10 - tierGap * 0.01)
```

**Win probability for A**:
```
styleComponent  = styleScore(A vs B) * 0.20
statComponent   = (statScore(A) / (statScore(A) + statScore(B))) * 0.70
randomComponent = (randomRoll < 0.5 ? 1 : 0) * randomWeight
total           = 0.20 + 0.70 + randomWeight
winProbA        = (styleComponent + statComponent + randomComponent) / total
```

**Method from margin** (`margin = abs(winProbA - 0.5)`):
- margin > 0.35 → KO
- margin > 0.20 → TKO
- margin > 0.08 → Split Decision
- else → Decision

**Round**:
- KO: random int 1–6
- TKO: random int 4–10
- Decision/Split Decision: 12

**Time**:
- KO/TKO: `"${randInt(0,2)}:${randInt(0,59).toString().padStart(2,'0')}"`
- Decision/Split Decision: `"3:00"`

**Finishing move**:
```ts
const FINISH_MOVES: Record<FightingStyle, string[]> = {
  'out-boxer':      ['Jab', 'Cross', 'Right Cross'],
  'swarmer':        ['Lead Hook', 'Rear Hook', 'Body Shot'],
  'slugger':        ['Rear Hook', 'Uppercut', 'Overhand Right'],
  'counterpuncher': ['Counter Right', 'Counter Left Hook', 'Body Counter'],
};
```
- KO/TKO: random pick from winner's style array
- Decision/Split Decision: null

- [ ] **Step 1: Write the failing tests**

Create `src/lib/fightSim.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  computeStatScore,
  computeStyleScore,
  computeRandomWeight,
  simulateFight,
  type FightSimResult,
} from './fightSim';
import type { Boxer, BoxerStats, Fight } from '../db/db';

function makeStats(val: number): BoxerStats {
  return {
    jab: val, cross: val, leadHook: val, rearHook: val, uppercut: val,
    headMovement: val, bodyMovement: val, guard: val, positioning: val,
    timing: val, adaptability: val, discipline: val,
    speed: val, power: val, endurance: val, recovery: val, toughness: val,
  };
}

function makeBoxer(id: number, overrides: Partial<Boxer> = {}): Boxer {
  return {
    id,
    name: `Boxer ${id}`,
    age: 25,
    weightClass: 'welterweight',
    style: 'slugger',
    reputation: 'Unknown',
    gymId: 1,
    federationId: 1,
    stats: makeStats(10),
    naturalTalents: [],
    injuries: [],
    titles: [],
    record: [],
    ...overrides,
  };
}

function makeFight(overrides: Partial<Fight> = {}): Fight {
  return {
    id: 1,
    date: '2026-03-14',
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
  };
}

describe('computeStatScore', () => {
  it('returns 0.5 for all stats at 10 (max 20)', () => {
    const boxer = makeBoxer(1, { style: 'slugger', stats: makeStats(10) });
    expect(computeStatScore(boxer)).toBeCloseTo(0.5);
  });

  it('returns 1.0 for all stats at 20', () => {
    const boxer = makeBoxer(1, { style: 'slugger', stats: makeStats(20) });
    expect(computeStatScore(boxer)).toBeCloseTo(1.0);
  });

  it('returns 0 for all stats at 0', () => {
    const boxer = makeBoxer(1, { style: 'slugger', stats: makeStats(0) });
    expect(computeStatScore(boxer)).toBeCloseTo(0);
  });

  it('focus stats weigh more than non-focus stats', () => {
    // slugger focus: rearHook, uppercut, power, endurance, recovery, toughness
    const highFocus = makeBoxer(1, {
      style: 'slugger',
      stats: { ...makeStats(5), rearHook: 20, uppercut: 20, power: 20, endurance: 20, recovery: 20, toughness: 20 },
    });
    const highNonFocus = makeBoxer(2, {
      style: 'slugger',
      stats: { ...makeStats(20), rearHook: 5, uppercut: 5, power: 5, endurance: 5, recovery: 5, toughness: 5 },
    });
    expect(computeStatScore(highFocus)).toBeGreaterThan(computeStatScore(highNonFocus));
  });
});

describe('computeStyleScore', () => {
  it('returns 1.0 when A counters B', () => {
    // Swarmer counters Out-Boxer
    expect(computeStyleScore('swarmer', 'out-boxer')).toBe(1.0);
  });

  it('returns 0.0 when B counters A', () => {
    // Out-Boxer is countered by Swarmer
    expect(computeStyleScore('out-boxer', 'swarmer')).toBe(0.0);
  });

  it('returns 0.5 for neutral matchup', () => {
    expect(computeStyleScore('slugger', 'out-boxer')).toBe(0.5);
  });
});

describe('computeRandomWeight', () => {
  it('returns 0.10 at tier gap 0', () => {
    expect(computeRandomWeight(0)).toBeCloseTo(0.10);
  });

  it('returns 0.01 at tier gap 9', () => {
    expect(computeRandomWeight(9)).toBeCloseTo(0.01);
  });

  it('returns 0.01 minimum even beyond gap 9', () => {
    expect(computeRandomWeight(20)).toBeCloseTo(0.01);
  });

  it('decreases linearly between gap 0 and 9', () => {
    expect(computeRandomWeight(5)).toBeCloseTo(0.05);
  });
});

describe('simulateFight', () => {
  it('returns a result with winner and loser ids that match the two boxers', () => {
    const a = makeBoxer(1);
    const b = makeBoxer(2);
    const result = simulateFight(a, b, makeFight(), 'North America Boxing Federation');
    expect([result.winnerId, result.loserId].sort()).toEqual([1, 2]);
    expect(result.winnerId).not.toBe(result.loserId);
  });

  it('winnerRecord has result win and loserRecord has result loss', () => {
    const a = makeBoxer(1);
    const b = makeBoxer(2);
    const result = simulateFight(a, b, makeFight(), 'North America Boxing Federation');
    expect(result.winnerRecord.result).toBe('win');
    expect(result.loserRecord.result).toBe('loss');
  });

  it('winnerRecord opponentId equals loserId and vice versa', () => {
    const a = makeBoxer(1);
    const b = makeBoxer(2);
    const result = simulateFight(a, b, makeFight(), 'North America Boxing Federation');
    expect(result.winnerRecord.opponentId).toBe(result.loserId);
    expect(result.loserRecord.opponentId).toBe(result.winnerId);
  });

  it('decision has round 12, time 3:00, no finishingMove', () => {
    // Force a decision: equal boxers, same style → small margin
    // Run many times and find a decision result
    let found: FightSimResult | null = null;
    for (let i = 0; i < 200; i++) {
      const r = simulateFight(makeBoxer(1), makeBoxer(2), makeFight(), 'NABF');
      if (r.method === 'Decision' || r.method === 'Split Decision') { found = r; break; }
    }
    expect(found).not.toBeNull();
    expect(found!.round).toBe(12);
    expect(found!.time).toBe('3:00');
    expect(found!.finishingMove).toBeNull();
  });

  it('KO has round between 1 and 6 and a finishingMove', () => {
    // Force a KO: massive stat advantage
    let found: FightSimResult | null = null;
    for (let i = 0; i < 500; i++) {
      const a = makeBoxer(1, { stats: makeStats(20) });
      const b = makeBoxer(2, { stats: makeStats(1) });
      const r = simulateFight(a, b, makeFight(), 'NABF');
      if (r.method === 'KO') { found = r; break; }
    }
    expect(found).not.toBeNull();
    expect(found!.round).toBeGreaterThanOrEqual(1);
    expect(found!.round).toBeLessThanOrEqual(6);
    expect(found!.finishingMove).not.toBeNull();
  });

  it('heavily favored boxer wins far more often than not', () => {
    const a = makeBoxer(1, { stats: makeStats(20), reputation: 'All-Time Great' });
    const b = makeBoxer(2, { stats: makeStats(1), reputation: 'Unknown' });
    let aWins = 0;
    for (let i = 0; i < 100; i++) {
      const r = simulateFight(a, b, makeFight(), 'NABF');
      if (r.winnerId === 1) aWins++;
    }
    expect(aWins).toBeGreaterThan(90);
  });

  it('stores federation name and fight date on fight records', () => {
    const a = makeBoxer(1);
    const b = makeBoxer(2);
    const fight = makeFight({ date: '2026-06-15' });
    const result = simulateFight(a, b, fight, 'European Boxing Federation');
    expect(result.winnerRecord.federation).toBe('European Boxing Federation');
    expect(result.winnerRecord.date).toBe('2026-06-15');
    expect(result.loserRecord.federation).toBe('European Boxing Federation');
    expect(result.loserRecord.date).toBe('2026-06-15');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- fightSim
```

Expected: FAIL — `Cannot find module './fightSim'`

- [ ] **Step 3: Implement `src/lib/fightSim.ts`**

```ts
import type { Boxer, Fight, FightingStyle, FightMethod, FightRecord, ReputationLevel } from '../db/db';

export interface FightSimResult {
  winnerId: number;
  loserId: number;
  method: FightMethod;
  finishingMove: string | null;
  round: number;
  time: string;
  winnerRecord: FightRecord;
  loserRecord: FightRecord;
}

const REPUTATION_INDEX: Record<ReputationLevel, number> = {
  'Unknown': 0,
  'Local Star': 1,
  'Rising Star': 2,
  'Respectable Opponent': 3,
  'Contender': 4,
  'Championship Caliber': 5,
  'Nationally Ranked': 6,
  'World Class Fighter': 7,
  'International Superstar': 8,
  'All-Time Great': 9,
};

const STYLE_FOCUS: Record<FightingStyle, (keyof Boxer['stats'])[]> = {
  'out-boxer':      ['jab', 'cross', 'headMovement', 'guard', 'positioning', 'speed'],
  'swarmer':        ['leadHook', 'rearHook', 'bodyMovement', 'positioning', 'endurance', 'toughness'],
  'slugger':        ['rearHook', 'uppercut', 'power', 'endurance', 'recovery', 'toughness'],
  'counterpuncher': ['timing', 'adaptability', 'discipline', 'headMovement', 'bodyMovement', 'speed'],
};

// Counters: key is countered BY value
const STYLE_COUNTERS: Record<FightingStyle, FightingStyle> = {
  'out-boxer':      'swarmer',
  'swarmer':        'slugger',
  'slugger':        'counterpuncher',
  'counterpuncher': 'out-boxer',
};

const FINISH_MOVES: Record<FightingStyle, string[]> = {
  'out-boxer':      ['Jab', 'Cross', 'Right Cross'],
  'swarmer':        ['Lead Hook', 'Rear Hook', 'Body Shot'],
  'slugger':        ['Rear Hook', 'Uppercut', 'Overhand Right'],
  'counterpuncher': ['Counter Right', 'Counter Left Hook', 'Body Counter'],
};

const ALL_STATS: (keyof Boxer['stats'])[] = [
  'jab', 'cross', 'leadHook', 'rearHook', 'uppercut',
  'headMovement', 'bodyMovement', 'guard', 'positioning',
  'timing', 'adaptability', 'discipline',
  'speed', 'power', 'endurance', 'recovery', 'toughness',
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function computeStatScore(boxer: Boxer): number {
  const focus = new Set(STYLE_FOCUS[boxer.style]);
  let weightedSum = 0;
  let totalWeight = 0;
  for (const stat of ALL_STATS) {
    const weight = focus.has(stat) ? 2 : 1;
    weightedSum += boxer.stats[stat] * weight;
    totalWeight += weight;
  }
  return (weightedSum / totalWeight) / 20;
}

export function computeStyleScore(styleA: FightingStyle, styleB: FightingStyle): number {
  if (STYLE_COUNTERS[styleB] === styleA) return 1.0; // A counters B
  if (STYLE_COUNTERS[styleA] === styleB) return 0.0; // B counters A
  return 0.5;
}

export function computeRandomWeight(tierGap: number): number {
  return Math.max(0.01, 0.10 - tierGap * 0.01);
}

export function simulateFight(
  boxerA: Boxer,
  boxerB: Boxer,
  fight: Fight,
  federationName: string,
): FightSimResult {
  const statA = computeStatScore(boxerA);
  const statB = computeStatScore(boxerB);
  const styleScore = computeStyleScore(boxerA.style, boxerB.style);

  const tierGap = Math.abs(REPUTATION_INDEX[boxerA.reputation] - REPUTATION_INDEX[boxerB.reputation]);
  const randomWeight = computeRandomWeight(tierGap);

  const styleComponent  = styleScore * 0.20;
  const statComponent   = (statA / (statA + statB)) * 0.70;
  const randomComponent = (Math.random() < 0.5 ? 1 : 0) * randomWeight;
  const total           = 0.20 + 0.70 + randomWeight;

  const winProbA = (styleComponent + statComponent + randomComponent) / total;
  const aWins    = Math.random() < winProbA;

  const winner = aWins ? boxerA : boxerB;
  const loser  = aWins ? boxerB : boxerA;
  const margin = Math.abs(winProbA - 0.5);

  let method: FightMethod;
  if (margin > 0.35)      method = 'KO';
  else if (margin > 0.20) method = 'TKO';
  else if (margin > 0.08) method = 'Split Decision';
  else                    method = 'Decision';

  const isFinish = method === 'KO' || method === 'TKO';

  const round = method === 'KO'  ? randInt(1, 6)
              : method === 'TKO' ? randInt(4, 10)
              : 12;

  const time = isFinish
    ? `${randInt(0, 2)}:${randInt(0, 59).toString().padStart(2, '0')}`
    : '3:00';

  const finishingMove = isFinish ? pick(FINISH_MOVES[winner.style]) : null;

  const winnerRecord: FightRecord = {
    result: 'win',
    opponentName: loser.name,
    opponentId: loser.id!,
    method,
    finishingMove,
    round,
    time,
    federation: federationName,
    date: fight.date,
  };

  const loserRecord: FightRecord = {
    result: 'loss',
    opponentName: winner.name,
    opponentId: winner.id!,
    method,
    finishingMove,
    round,
    time,
    federation: federationName,
    date: fight.date,
  };

  return {
    winnerId: winner.id!,
    loserId: loser.id!,
    method,
    finishingMove,
    round,
    time,
    winnerRecord,
    loserRecord,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- fightSim
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fightSim.ts src/lib/fightSim.test.ts
git commit -m "feat: implement simulateFight pure function"
```

---

## Task 2: Wire `handleSimFight` in TopNav to run simulation and persist results

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`

### Background

Current `handleSimFight` (lines 150–179 of `TopNav.tsx`):
1. Advances date by 1 day
2. Runs training for that day
3. Refreshes events and boxer IDs

New `handleSimFight` must:
1. Find all fight `CalendarEvent`s for today involving gym boxers
2. For each fight event: load `Fight`, both `Boxer`s, `Federation`; call `simulateFight`; persist results
3. Advance date by 1 day
4. Run training for that day
5. Refresh events and boxer IDs

**DB writes per fight:**
- `putFight` — update winner/method/round/time/finishingMove
- `putBoxer` (winner) — push winnerRecord
- `putBoxer` (loser) — push loserRecord
- If `fight.isTitleFight`: find title for this federation+weightClass via `getTitlesByFederation`, update champion and reigns via `putTitle`
- `putFightContract` — set status to `'completed'` (find contract via `fight.contractId`)

**New imports needed:**
```ts
import { getFight, putFight } from '../../db/fightStore';
import { getBoxer } from '../../db/boxerStore';
import { getFederation } from '../../db/federationStore';
import { getTitlesByFederation } from '../../db/titleStore';
import { putTitle } from '../../db/titleStore';
import { getFightContract, putFightContract } from '../../db/fightContractStore';
import { simulateFight } from '../../lib/fightSim';
```

- [ ] **Step 1: Write the failing test**

There is no existing test file for `TopNav.tsx`. Because `handleSimFight` now coordinates DB calls plus the pure sim, test the integration via a manual smoke-test check instead: after wiring, run the full test suite to make sure nothing regresses.

For now, write a focused unit test that verifies the title-transfer logic works in isolation. Add this to a new `src/components/TopNav/TopNav.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB } from '../../db/db';
import { putBoxer } from '../../db/boxerStore';
import { putFight } from '../../db/fightStore';
import { putTitle, getAllTitles } from '../../db/titleStore';
import { putFederation } from '../../db/federationStore';
import { putFightContract } from '../../db/fightContractStore';
import { applyFightResult } from './fightResultApplier';
import type { Boxer, Fight, BoxerStats } from '../../db/db';

function makeStats(val: number): BoxerStats {
  return {
    jab: val, cross: val, leadHook: val, rearHook: val, uppercut: val,
    headMovement: val, bodyMovement: val, guard: val, positioning: val,
    timing: val, adaptability: val, discipline: val,
    speed: val, power: val, endurance: val, recovery: val, toughness: val,
  };
}

beforeEach(async () => {
  // @ts-expect-error fake-indexeddb
  global.indexedDB = new IDBFactory();
  await closeAndResetDB();
});

afterEach(async () => {
  await closeAndResetDB();
});

describe('applyFightResult', () => {
  it('adds winnerRecord and loserRecord to boxer fight histories', async () => {
    const fedId = await putFederation({ name: 'North America Boxing Federation', prestige: 8 });
    const winnerId = await putBoxer({
      name: 'Winner', age: 25, weightClass: 'welterweight', style: 'slugger',
      reputation: 'Unknown', gymId: 1, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const loserId = await putBoxer({
      name: 'Loser', age: 25, weightClass: 'welterweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: null, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const contractId = await putFightContract({
      boxerId: winnerId, opponentId: loserId, federationId: fedId,
      weightClass: 'welterweight', guaranteedPayout: 1000, ppvSplitPercentage: 50,
      ppvNetworkId: null, isTitleFight: false, status: 'accepted',
      counterOfferPayout: null, counterOfferPpvSplit: null, roundsUsed: 1,
      scheduledDate: '2026-03-14', fightId: null,
    });
    const fightId = await putFight({
      date: '2026-03-14', federationId: fedId, weightClass: 'welterweight',
      boxerIds: [winnerId, loserId], winnerId: null,
      method: 'Decision', finishingMove: null, round: null, time: null,
      isTitleFight: false, contractId,
    });

    await applyFightResult({
      fightId,
      winnerId,
      loserId,
      method: 'KO',
      finishingMove: 'Rear Hook',
      round: 3,
      time: '1:45',
      winnerRecord: {
        result: 'win', opponentName: 'Loser', opponentId: loserId,
        method: 'KO', finishingMove: 'Rear Hook', round: 3, time: '1:45',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      loserRecord: {
        result: 'loss', opponentName: 'Winner', opponentId: winnerId,
        method: 'KO', finishingMove: 'Rear Hook', round: 3, time: '1:45',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      isTitleFight: false,
      federationId: fedId,
      weightClass: 'welterweight',
      fightDate: '2026-03-14',
      contractId,
    });

    const { getBoxer } = await import('../../db/boxerStore');
    const winner = await getBoxer(winnerId);
    const loser = await getBoxer(loserId);
    expect(winner!.record).toHaveLength(1);
    expect(winner!.record[0].result).toBe('win');
    expect(loser!.record).toHaveLength(1);
    expect(loser!.record[0].result).toBe('loss');
  });

  it('updates title on a title fight win', async () => {
    const fedId = await putFederation({ name: 'North America Boxing Federation', prestige: 8 });
    const oldChampId = await putBoxer({
      name: 'Old Champ', age: 30, weightClass: 'welterweight', style: 'slugger',
      reputation: 'Championship Caliber', gymId: null, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const challengerId = await putBoxer({
      name: 'Challenger', age: 25, weightClass: 'welterweight', style: 'out-boxer',
      reputation: 'Contender', gymId: 1, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const titleId = await putTitle({
      federationId: fedId, weightClass: 'welterweight',
      currentChampionId: oldChampId,
      reigns: [{ boxerId: oldChampId, dateWon: '2025-01-01', dateLost: null, defenseCount: 2 }],
    });
    const contractId = await putFightContract({
      boxerId: challengerId, opponentId: oldChampId, federationId: fedId,
      weightClass: 'welterweight', guaranteedPayout: 10000, ppvSplitPercentage: 50,
      ppvNetworkId: null, isTitleFight: true, status: 'accepted',
      counterOfferPayout: null, counterOfferPpvSplit: null, roundsUsed: 1,
      scheduledDate: '2026-03-14', fightId: null,
    });
    const fightId = await putFight({
      date: '2026-03-14', federationId: fedId, weightClass: 'welterweight',
      boxerIds: [challengerId, oldChampId], winnerId: null,
      method: 'Decision', finishingMove: null, round: null, time: null,
      isTitleFight: true, contractId,
    });

    await applyFightResult({
      fightId,
      winnerId: challengerId,
      loserId: oldChampId,
      method: 'Decision',
      finishingMove: null,
      round: 12,
      time: '3:00',
      winnerRecord: {
        result: 'win', opponentName: 'Old Champ', opponentId: oldChampId,
        method: 'Decision', finishingMove: null, round: 12, time: '3:00',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      loserRecord: {
        result: 'loss', opponentName: 'Challenger', opponentId: challengerId,
        method: 'Decision', finishingMove: null, round: 12, time: '3:00',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      isTitleFight: true,
      federationId: fedId,
      weightClass: 'welterweight',
      fightDate: '2026-03-14',
      contractId,
    });

    const { getTitle } = await import('../../db/titleStore');
    const title = await getTitle(titleId);
    expect(title!.currentChampionId).toBe(challengerId);
    expect(title!.reigns).toHaveLength(2);
    expect(title!.reigns[0].dateLost).toBe('2026-03-14');
    expect(title!.reigns[1].boxerId).toBe(challengerId);
    expect(title!.reigns[1].dateLost).toBeNull();
  });

  it('marks the fight contract as completed', async () => {
    const fedId = await putFederation({ name: 'North America Boxing Federation', prestige: 8 });
    const winnerId = await putBoxer({
      name: 'W', age: 25, weightClass: 'welterweight', style: 'slugger',
      reputation: 'Unknown', gymId: 1, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const loserId = await putBoxer({
      name: 'L', age: 25, weightClass: 'welterweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: null, federationId: fedId,
      stats: makeStats(10), naturalTalents: [], injuries: [], titles: [], record: [],
    });
    const contractId = await putFightContract({
      boxerId: winnerId, opponentId: loserId, federationId: fedId,
      weightClass: 'welterweight', guaranteedPayout: 1000, ppvSplitPercentage: 50,
      ppvNetworkId: null, isTitleFight: false, status: 'accepted',
      counterOfferPayout: null, counterOfferPpvSplit: null, roundsUsed: 1,
      scheduledDate: '2026-03-14', fightId: null,
    });
    const fightId = await putFight({
      date: '2026-03-14', federationId: fedId, weightClass: 'welterweight',
      boxerIds: [winnerId, loserId], winnerId: null,
      method: 'Decision', finishingMove: null, round: null, time: null,
      isTitleFight: false, contractId,
    });

    await applyFightResult({
      fightId, winnerId, loserId, method: 'Decision', finishingMove: null,
      round: 12, time: '3:00',
      winnerRecord: {
        result: 'win', opponentName: 'L', opponentId: loserId,
        method: 'Decision', finishingMove: null, round: 12, time: '3:00',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      loserRecord: {
        result: 'loss', opponentName: 'W', opponentId: winnerId,
        method: 'Decision', finishingMove: null, round: 12, time: '3:00',
        federation: 'North America Boxing Federation', date: '2026-03-14',
      },
      isTitleFight: false, federationId: fedId, weightClass: 'welterweight',
      fightDate: '2026-03-14', contractId,
    });

    const { getFightContract } = await import('../../db/fightContractStore');
    const contract = await getFightContract(contractId);
    expect(contract!.status).toBe('completed');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- TopNav.test
```

Expected: FAIL — `Cannot find module './fightResultApplier'`

- [ ] **Step 3: Create `src/components/TopNav/fightResultApplier.ts`**

This extracts all DB writes from `handleSimFight` into a testable, importable function:

```ts
import { getFight, putFight } from '../../db/fightStore';
import { getBoxer, putBoxer } from '../../db/boxerStore';
import { getTitlesByFederation, putTitle } from '../../db/titleStore';
import { getFightContract, putFightContract } from '../../db/fightContractStore';
import type { FightMethod, FightRecord, WeightClass } from '../../db/db';

export interface ApplyFightResultParams {
  fightId: number;
  winnerId: number;
  loserId: number;
  method: FightMethod;
  finishingMove: string | null;
  round: number;
  time: string;
  winnerRecord: FightRecord;
  loserRecord: FightRecord;
  isTitleFight: boolean;
  federationId: number;
  weightClass: WeightClass;
  fightDate: string;
  contractId: number;
}

export async function applyFightResult(params: ApplyFightResultParams): Promise<void> {
  const {
    fightId, winnerId, loserId, method, finishingMove, round, time,
    winnerRecord, loserRecord, isTitleFight, federationId, weightClass,
    fightDate, contractId,
  } = params;

  // 1. Update Fight record
  const fight = await getFight(fightId);
  if (fight) {
    await putFight({ ...fight, winnerId, method, finishingMove, round, time });
  }

  // 2. Push records onto both boxers
  const [winner, loser] = await Promise.all([getBoxer(winnerId), getBoxer(loserId)]);
  if (winner) await putBoxer({ ...winner, record: [...winner.record, winnerRecord] });
  if (loser)  await putBoxer({ ...loser,  record: [...loser.record,  loserRecord]  });

  // 3. Title transfer
  if (isTitleFight) {
    const titles = await getTitlesByFederation(federationId);
    const title = titles.find(t => t.weightClass === weightClass);
    if (title && title.id !== undefined) {
      const updatedReigns = title.reigns.map(r =>
        r.dateLost === null ? { ...r, dateLost: fightDate } : r
      );
      updatedReigns.push({ boxerId: winnerId, dateWon: fightDate, dateLost: null, defenseCount: 0 });
      await putTitle({ ...title, currentChampionId: winnerId, reigns: updatedReigns });
    }
  }

  // 4. Mark contract completed
  const contract = await getFightContract(contractId);
  if (contract) {
    await putFightContract({ ...contract, status: 'completed' });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- TopNav.test
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TopNav/fightResultApplier.ts src/components/TopNav/TopNav.test.ts
git commit -m "feat: add applyFightResult for persisting fight outcomes"
```

---

## Task 3: Wire `handleSimFight` in TopNav

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`

- [ ] **Step 1: Add new imports to `TopNav.tsx`**

At the top of `src/components/TopNav/TopNav.tsx`, add these imports after the existing ones:

```ts
import { getFight, putFight } from '../../db/fightStore';
import { getBoxer } from '../../db/boxerStore';
import { getFederation } from '../../db/federationStore';
import { simulateFight } from '../../lib/fightSim';
import { applyFightResult } from './fightResultApplier';
```

- [ ] **Step 2: Replace `handleSimFight` with the full implementation**

Replace the entire `handleSimFight` function (currently lines 150–179) with:

```ts
async function handleSimFight() {
  const currentDate = gym?.currentDate ?? '2026-01-01';
  if (!gym || isSimming) return;
  setIsSimming(true);
  setDropdownOpen(false);
  try {
    // Find all fight events for today involving gym boxers
    const todayFights = events.filter(
      e => e.type === 'fight' && e.date === currentDate && e.boxerIds.some(id => gymBoxerIds.has(id))
    );

    for (const event of todayFights) {
      const fight = await getFight(event.fightId);
      if (!fight || fight.winnerId !== null) continue; // already resolved

      const [boxerA, boxerB, federation] = await Promise.all([
        getBoxer(fight.boxerIds[0]),
        getBoxer(fight.boxerIds[1]),
        getFederation(fight.federationId),
      ]);
      if (!boxerA || !boxerB || !federation) continue;

      const simResult = simulateFight(boxerA, boxerB, fight, federation.name);

      await applyFightResult({
        fightId: fight.id!,
        winnerId: simResult.winnerId,
        loserId: simResult.loserId,
        method: simResult.method,
        finishingMove: simResult.finishingMove,
        round: simResult.round,
        time: simResult.time,
        winnerRecord: simResult.winnerRecord,
        loserRecord: simResult.loserRecord,
        isTitleFight: fight.isTitleFight,
        federationId: fight.federationId,
        weightClass: fight.weightClass,
        fightDate: fight.date,
        contractId: fight.contractId,
      });
    }

    // Advance date and run training
    const updated: Gym = { ...gym, currentDate: addDays(currentDate, 1) };
    await saveGym(updated);
    setGym(updated);
    setFightStop(null);

    await runTraining(currentDate, updated.currentDate, updated.id ?? 1);

    const [freshEvts, freshBoxers] = await Promise.all([
      getAllCalendarEvents(),
      getAllBoxers(),
    ]);
    setEvents(freshEvts);
    const freshGymId = updated.id ?? 1;
    const freshIds = new Set(
      freshBoxers
        .filter(b => b.gymId === freshGymId && b.id !== undefined)
        .map(b => b.id!)
    );
    setGymBoxerIds(freshIds);
  } finally {
    setIsSimming(false);
  }
}
```

- [ ] **Step 3: Run build to confirm no type errors**

```bash
npm run build 2>&1 | head -30
```

Expected: clean build (no new TypeScript errors).

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TopNav/TopNav.tsx
git commit -m "feat: wire handleSimFight to simulate fight and persist results"
```
