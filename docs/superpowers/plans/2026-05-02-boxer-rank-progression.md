# Boxer Rank Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement dynamic reputation progression where boxers gain/lose rank points after fights, with a demotion buffer protecting recently promoted boxers.

**Architecture:** A new `src/lib/rankSystem.ts` module owns all rank logic (`RANK_CONFIG`, `applyRankChange`). `fightResultApplier.ts` calls it after every fight. Two new fields (`rankPoints`, `demotionBuffer`) are added to the `Boxer` interface with a DB version bump for migration.

**Tech Stack:** TypeScript, Vitest (tests), IndexedDB via `idb`, React + CSS Modules (UI)

---

### Task 1: Add rank fields to Boxer type and bump DB version

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add the three new fields to the `Boxer` interface** (after `trainingExp`)

```typescript
// In src/db/db.ts, replace the Boxer interface block:
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
  rankPoints: number;
  demotionBuffer: number;
  lastRankDelta?: {
    points: number;
    bufferPoints: number;
    promoted: boolean;
    demoted: boolean;
  };
}
```

- [ ] **Step 2: Bump the DB version from 10 to 11 and add migration block**

In `src/db/db.ts`, change:
```typescript
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 10, {
```
to:
```typescript
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 11, {
```

Then add at the end of the `upgrade` function (after the `oldVersion < 10` block):

```typescript
      if (oldVersion < 11) {
        // rankPoints, demotionBuffer, lastRankDelta added to Boxer.
        // idb returns undefined for missing fields on existing records;
        // runtime code in rankSystem.ts defaults rankPoints to 0 and
        // demotionBuffer to bufferMax for the boxer's current reputation.
      }
```

- [ ] **Step 3: Fix any TypeScript errors from missing fields in tests**

Run:
```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors about `rankPoints` and `demotionBuffer` missing in test `makeBoxer` helpers. Fix each one:

In `src/lib/fightSim.test.ts`, add to `makeBoxer`:
```typescript
rankPoints: 0,
demotionBuffer: 10,
```

In `src/components/TopNav/TopNav.test.ts`, `src/db/worldGen.test.ts`, and any other test files with `makeBoxer` or inline `Boxer` literals — add `rankPoints: 0, demotionBuffer: 10` to each.

- [ ] **Step 4: Verify TS compiles clean**

Run:
```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -20
```
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/db/db.ts && git add -p && git commit -m "feat: add rankPoints/demotionBuffer/lastRankDelta fields to Boxer type (DB v11)"
```

---

### Task 2: Create rankSystem.ts with RANK_CONFIG and applyRankChange

**Files:**
- Create: `src/lib/rankSystem.ts`
- Create: `src/lib/rankSystem.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/rankSystem.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { RANK_CONFIG, REPUTATION_ORDER, applyRankChange } from './rankSystem';
import type { Boxer, BoxerStats } from '../db/db';

function makeStats(val: number): BoxerStats {
  return {
    jab: val, cross: val, leadHook: val, rearHook: val, uppercut: val,
    headMovement: val, bodyMovement: val, guard: val, positioning: val,
    timing: val, adaptability: val, discipline: val,
    speed: val, power: val, endurance: val, recovery: val, toughness: val,
  };
}

function makeBoxer(overrides: Partial<Boxer> = {}): Boxer {
  return {
    id: 1,
    name: 'Test',
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
    rankPoints: 0,
    demotionBuffer: 10,
    ...overrides,
  };
}

describe('RANK_CONFIG', () => {
  it('has an entry for every reputation level', () => {
    for (const rep of REPUTATION_ORDER) {
      expect(RANK_CONFIG[rep]).toBeDefined();
      expect(RANK_CONFIG[rep].baseWinPoints).toBeGreaterThan(0);
    }
  });

  it('All-Time Great has Infinity promotionThreshold', () => {
    expect(RANK_CONFIG['All-Time Great'].promotionThreshold).toBe(Infinity);
  });
});

describe('applyRankChange - wins', () => {
  it('same-rank win adds points and never goes negative', () => {
    const boxer = makeBoxer({ reputation: 'Unknown', rankPoints: 0, demotionBuffer: 10 });
    const opponent = makeBoxer({ reputation: 'Unknown' });
    const result = applyRankChange(boxer, opponent, 'win', false);
    expect(result.rankPoints).toBeGreaterThan(0);
    expect(result.demotionBuffer).toBe(10); // buffer unchanged on win
  });

  it('beating a higher-ranked opponent gives more points than same rank', () => {
    const boxer = makeBoxer({ reputation: 'Unknown', rankPoints: 0, demotionBuffer: 10 });
    const sameOpponent = makeBoxer({ reputation: 'Unknown' });
    const higherOpponent = makeBoxer({ reputation: 'Rising Star' });
    const sameResult = applyRankChange(boxer, sameOpponent, 'win', false);
    const higherResult = applyRankChange(boxer, higherOpponent, 'win', false);
    expect(higherResult.rankPoints).toBeGreaterThan(sameResult.rankPoints);
  });

  it('beating a much lower-ranked opponent gives near-zero points (never negative)', () => {
    const boxer = makeBoxer({ reputation: 'Nationally Ranked', rankPoints: 0, demotionBuffer: 40 });
    const opponent = makeBoxer({ reputation: 'Unknown' });
    const result = applyRankChange(boxer, opponent, 'win', false);
    expect(result.rankPoints).toBeGreaterThanOrEqual(0);
    expect(result.rankPoints).toBeLessThan(5);
  });

  it('title fight win uses 2x base regardless of gap', () => {
    const boxer = makeBoxer({ reputation: 'Unknown', rankPoints: 0, demotionBuffer: 10 });
    const opponent = makeBoxer({ reputation: 'Unknown' });
    const normalResult = applyRankChange(boxer, opponent, 'win', false);
    const titleResult = applyRankChange(boxer, opponent, 'win', true);
    expect(titleResult.rankPoints).toBeGreaterThan(normalResult.rankPoints);
  });

  it('promotion happens when rankPoints reaches threshold', () => {
    const threshold = RANK_CONFIG['Unknown'].promotionThreshold;
    const boxer = makeBoxer({ reputation: 'Unknown', rankPoints: threshold - 1, demotionBuffer: 5 });
    const opponent = makeBoxer({ reputation: 'Unknown' });
    const result = applyRankChange(boxer, opponent, 'win', false);
    expect(result.reputation).toBe('Local Star');
    expect(result.rankPoints).toBe(0);
    expect(result.demotionBuffer).toBe(RANK_CONFIG['Local Star'].bufferMax);
    expect(result.lastRankDelta?.promoted).toBe(true);
  });

  it('All-Time Great cannot be promoted further', () => {
    const boxer = makeBoxer({ reputation: 'All-Time Great', rankPoints: 999, demotionBuffer: 50 });
    const opponent = makeBoxer({ reputation: 'All-Time Great' });
    const result = applyRankChange(boxer, opponent, 'win', false);
    expect(result.reputation).toBe('All-Time Great');
  });
});

describe('applyRankChange - losses', () => {
  it('loss drains buffer before rankPoints', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 20, demotionBuffer: 20 });
    const opponent = makeBoxer({ reputation: 'Rising Star' });
    const result = applyRankChange(boxer, opponent, 'loss', false);
    expect(result.demotionBuffer).toBeLessThan(20);
    expect(result.rankPoints).toBe(20); // rankPoints untouched while buffer absorbs
  });

  it('loss overflow drains rankPoints after buffer is empty', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 20, demotionBuffer: 0 });
    const opponent = makeBoxer({ reputation: 'Rising Star' });
    const result = applyRankChange(boxer, opponent, 'loss', false);
    expect(result.rankPoints).toBeLessThan(20);
  });

  it('demotion occurs when both rankPoints and buffer reach 0', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 0, demotionBuffer: 0 });
    const opponent = makeBoxer({ reputation: 'Rising Star' });
    const result = applyRankChange(boxer, opponent, 'loss', false);
    expect(result.reputation).toBe('Local Star');
    expect(result.lastRankDelta?.demoted).toBe(true);
    // rankPoints set to 70% of lower rank's threshold
    const expected = Math.floor(RANK_CONFIG['Local Star'].promotionThreshold * 0.7);
    expect(result.rankPoints).toBe(expected);
    expect(result.demotionBuffer).toBe(RANK_CONFIG['Local Star'].bufferMax);
  });

  it('title fight loss has no rank penalty', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 20, demotionBuffer: 0 });
    const opponent = makeBoxer({ reputation: 'Rising Star' });
    const result = applyRankChange(boxer, opponent, 'loss', true);
    expect(result.rankPoints).toBe(20);
    expect(result.demotionBuffer).toBe(0);
    expect(result.reputation).toBe('Rising Star');
  });

  it('Unknown is the floor — no demotion below Unknown', () => {
    const boxer = makeBoxer({ reputation: 'Unknown', rankPoints: 0, demotionBuffer: 0 });
    const opponent = makeBoxer({ reputation: 'Unknown' });
    const result = applyRankChange(boxer, opponent, 'loss', false);
    expect(result.reputation).toBe('Unknown');
  });

  it('losing to lower-ranked opponent gives bigger loss than same rank', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 0, demotionBuffer: 30 });
    const sameOpponent = makeBoxer({ reputation: 'Rising Star' });
    const lowerOpponent = makeBoxer({ reputation: 'Unknown' });
    const sameResult = applyRankChange(boxer, sameOpponent, 'loss', false);
    const lowerResult = applyRankChange(boxer, lowerOpponent, 'loss', false);
    expect(lowerResult.demotionBuffer).toBeLessThan(sameResult.demotionBuffer);
  });
});

describe('applyRankChange - draws', () => {
  it('draw makes no change to rank fields', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 15, demotionBuffer: 12 });
    const opponent = makeBoxer({ reputation: 'Rising Star' });
    const result = applyRankChange(boxer, opponent, 'draw', false);
    expect(result.reputation).toBe('Rising Star');
    expect(result.rankPoints).toBe(15);
    expect(result.demotionBuffer).toBe(12);
    expect(result.lastRankDelta).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/rankSystem.test.ts 2>&1 | tail -20
```
Expected: FAIL — "Cannot find module './rankSystem'"

- [ ] **Step 3: Implement rankSystem.ts**

Create `src/lib/rankSystem.ts`:

```typescript
import type { Boxer, ReputationLevel } from '../db/db';

export const REPUTATION_ORDER: ReputationLevel[] = [
  'Unknown',
  'Local Star',
  'Rising Star',
  'Respectable Opponent',
  'Contender',
  'Championship Caliber',
  'Nationally Ranked',
  'World Class Fighter',
  'International Superstar',
  'All-Time Great',
];

export const RANK_CONFIG: Record<ReputationLevel, {
  promotionThreshold: number;
  bufferMax: number;
  baseWinPoints: number;
}> = {
  'Unknown':                 { promotionThreshold: 20,       bufferMax: 10, baseWinPoints: 6  },
  'Local Star':              { promotionThreshold: 30,       bufferMax: 15, baseWinPoints: 8  },
  'Rising Star':             { promotionThreshold: 40,       bufferMax: 20, baseWinPoints: 10 },
  'Respectable Opponent':    { promotionThreshold: 55,       bufferMax: 25, baseWinPoints: 13 },
  'Contender':               { promotionThreshold: 70,       bufferMax: 30, baseWinPoints: 17 },
  'Championship Caliber':    { promotionThreshold: 85,       bufferMax: 35, baseWinPoints: 20 },
  'Nationally Ranked':       { promotionThreshold: 100,      bufferMax: 40, baseWinPoints: 23 },
  'World Class Fighter':     { promotionThreshold: 120,      bufferMax: 45, baseWinPoints: 27 },
  'International Superstar': { promotionThreshold: 150,      bufferMax: 50, baseWinPoints: 32 },
  'All-Time Great':          { promotionThreshold: Infinity, bufferMax: 50, baseWinPoints: 32 },
};

const WIN_MULTIPLIERS: [number, number][] = [
  // [gapThreshold, multiplier] — gap = opponentIndex - boxerIndex
  [2,  1.5],
  [1,  1.25],
  [0,  1.0],
  [-1, 0.4],
  [-Infinity, 0.1],
];

const LOSS_MULTIPLIERS: [number, number][] = [
  [2,  0.3],
  [1,  0.45],
  [0,  0.6],
  [-1, 0.9],
  [-Infinity, 1.2],
];

function getMultiplier(gap: number, table: [number, number][]): number {
  for (const [threshold, mult] of table) {
    if (gap >= threshold) return mult;
  }
  return table[table.length - 1][1];
}

export function applyRankChange(
  boxer: Boxer,
  opponent: Boxer,
  result: 'win' | 'loss' | 'draw',
  isTitleFight: boolean,
): Boxer {
  if (result === 'draw') return boxer;

  const boxerIndex = REPUTATION_ORDER.indexOf(boxer.reputation);
  const opponentIndex = REPUTATION_ORDER.indexOf(opponent.reputation);
  const gap = opponentIndex - boxerIndex;

  const config = RANK_CONFIG[boxer.reputation];
  const rankPoints = boxer.rankPoints ?? 0;
  const demotionBuffer = boxer.demotionBuffer ?? config.bufferMax;

  if (result === 'win') {
    const multiplier = isTitleFight ? 2.0 : getMultiplier(gap, WIN_MULTIPLIERS);
    const earned = Math.max(0, Math.round(config.baseWinPoints * multiplier));
    const newRankPoints = rankPoints + earned;

    if (newRankPoints >= config.promotionThreshold) {
      const nextRep = REPUTATION_ORDER[boxerIndex + 1];
      if (!nextRep) {
        // Already at ceiling
        return {
          ...boxer,
          rankPoints: newRankPoints,
          lastRankDelta: { points: earned, bufferPoints: 0, promoted: false, demoted: false },
        };
      }
      return {
        ...boxer,
        reputation: nextRep,
        rankPoints: 0,
        demotionBuffer: RANK_CONFIG[nextRep].bufferMax,
        lastRankDelta: { points: earned, bufferPoints: 0, promoted: true, demoted: false },
      };
    }

    return {
      ...boxer,
      rankPoints: newRankPoints,
      lastRankDelta: { points: earned, bufferPoints: 0, promoted: false, demoted: false },
    };
  }

  // Loss
  if (isTitleFight) {
    return {
      ...boxer,
      lastRankDelta: { points: 0, bufferPoints: 0, promoted: false, demoted: false },
    };
  }

  const multiplier = getMultiplier(gap, LOSS_MULTIPLIERS);
  const lost = Math.round(config.baseWinPoints * 0.6 * multiplier);

  const newBuffer = Math.max(0, demotionBuffer - lost);
  const bufferDrained = demotionBuffer - newBuffer;
  const overflow = lost - bufferDrained;
  const newRankPoints = Math.max(0, rankPoints - Math.max(0, overflow));

  // Floor: Unknown cannot demote
  if (newRankPoints <= 0 && newBuffer <= 0 && boxerIndex > 0) {
    const prevRep = REPUTATION_ORDER[boxerIndex - 1];
    const prevConfig = RANK_CONFIG[prevRep];
    return {
      ...boxer,
      reputation: prevRep,
      rankPoints: Math.floor(prevConfig.promotionThreshold * 0.7),
      demotionBuffer: prevConfig.bufferMax,
      lastRankDelta: { points: lost, bufferPoints: bufferDrained, promoted: false, demoted: true },
    };
  }

  return {
    ...boxer,
    rankPoints: newRankPoints,
    demotionBuffer: newBuffer,
    lastRankDelta: { points: lost, bufferPoints: bufferDrained, promoted: false, demoted: false },
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/rankSystem.test.ts 2>&1 | tail -20
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/lib/rankSystem.ts src/lib/rankSystem.test.ts && git commit -m "feat: implement rankSystem with RANK_CONFIG and applyRankChange"
```

---

### Task 3: Initialize rank fields in worldGen and fix existing tests

**Files:**
- Modify: `src/db/worldGen.ts`
- Modify: any test files with TypeScript errors from Task 1

- [ ] **Step 1: Add rank field initialization to generateBoxer in worldGen.ts**

In `src/db/worldGen.ts`, find where `Boxer` objects are constructed. The boxer object is built in the `generateBoxer` (or equivalent) function. Add the two new required fields. Search for the pattern where `reputation` is assigned and a Boxer object is returned.

Run:
```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && grep -n "reputation" src/db/worldGen.ts | head -20
```

Then in the function that builds and returns the `Boxer` object, add after `trainingExp`:
```typescript
rankPoints: 0,
demotionBuffer: RANK_CONFIG[reputation].bufferMax,
```

Also add the import at the top of `worldGen.ts`:
```typescript
import { RANK_CONFIG } from '../lib/rankSystem';
```

- [ ] **Step 2: Run the full test suite to find remaining TS/test errors**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1 | tail -40
```

Fix any remaining TypeScript errors in test files — each `makeBoxer` or inline `Boxer` literal needs `rankPoints: 0, demotionBuffer: 10`.

- [ ] **Step 3: Confirm all tests pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1 | tail -10
```
Expected: all test suites pass, no failures.

- [ ] **Step 4: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/db/worldGen.ts && git add -p && git commit -m "feat: initialize rankPoints and demotionBuffer in worldGen boxer creation"
```

---

### Task 4: Call applyRankChange in fightResultApplier

**Files:**
- Modify: `src/components/TopNav/fightResultApplier.ts`
- Modify: `src/components/TopNav/TopNav.test.ts` (update existing test or add one)

- [ ] **Step 1: Write a failing test for rank change application**

In `src/components/TopNav/TopNav.test.ts`, find how `applyFightResult` is tested. Add a test that verifies `rankPoints` changes after a fight. Look at the existing test structure first:

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && cat src/components/TopNav/TopNav.test.ts
```

Then add to the test file (in the appropriate describe block):

```typescript
it('applyFightResult updates winner rankPoints and loser demotionBuffer', async () => {
  // Use existing test setup pattern (world gen or direct IDB seeding)
  // Verify winner.rankPoints > 0 and loser.demotionBuffer < original after apply
});
```

Follow the existing test pattern in that file for seeding data. The key assertions:
```typescript
const winner = await getBoxer(winnerId);
const loser = await getBoxer(loserId);
expect(winner!.rankPoints).toBeGreaterThan(0);
expect(winner!.lastRankDelta?.promoted).toBeDefined();
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/components/TopNav/TopNav.test.ts 2>&1 | tail -20
```
Expected: FAIL — rankPoints is still 0 after apply.

- [ ] **Step 3: Update fightResultApplier.ts to call applyRankChange**

Replace `src/components/TopNav/fightResultApplier.ts` with:

```typescript
import { getFight, putFight } from '../../db/fightStore';
import { getBoxer, putBoxer } from '../../db/boxerStore';
import { getTitlesByFederation, putTitle } from '../../db/titleStore';
import { getFightContract, putFightContract } from '../../db/fightContractStore';
import { applyRankChange } from '../../lib/rankSystem';
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
    await Promise.all([putBoxer(updatedWinner), putBoxer(updatedLoser)]);
  } else {
    if (winner) await putBoxer({ ...winner, record: [...winner.record, winnerRecord] });
    if (loser)  await putBoxer({ ...loser,  record: [...loser.record,  loserRecord]  });
  }

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
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/components/TopNav/TopNav.test.ts 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 5: Run full suite to catch regressions**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1 | tail -10
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/components/TopNav/fightResultApplier.ts && git add -p && git commit -m "feat: apply rank changes to both boxers in fightResultApplier"
```

---

### Task 5: Roster page — compact rank progress indicator

**Files:**
- Modify: `src/pages/Gym/Roster.tsx`
- Modify: `src/pages/Gym/Roster.module.css`

- [ ] **Step 1: Add CSS classes for rank bars to Roster.module.css**

Append to `src/pages/Gym/Roster.module.css`:

```css
.rankCell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 80px;
}

.rankLabel {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.rankBarTrack {
  height: 5px;
  background: var(--bg-surface);
  border-radius: 2px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.rankBarFill {
  height: 100%;
  background: #2196f3;
  border-radius: 2px;
  transition: width 0.2s;
}

.bufferBarFill {
  height: 100%;
  background: var(--warning);
  border-radius: 2px;
  transition: width 0.2s;
}
```

- [ ] **Step 2: Add a RankMiniBar component inline in Roster.tsx and add a Reputation column**

In `src/pages/Gym/Roster.tsx`, add the import at the top:
```typescript
import { RANK_CONFIG } from '../../lib/rankSystem';
```

Add this helper component above the `export default function Roster()` line:

```typescript
function RankMiniBar({ boxer }: { boxer: Boxer }) {
  const config = RANK_CONFIG[boxer.reputation];
  const rankPoints = boxer.rankPoints ?? 0;
  const demotionBuffer = boxer.demotionBuffer ?? config.bufferMax;
  const progressPct = config.promotionThreshold === Infinity
    ? 100
    : Math.min(100, (rankPoints / config.promotionThreshold) * 100);
  const bufferPct = Math.min(100, (demotionBuffer / config.bufferMax) * 100);
  const tooltip = config.promotionThreshold === Infinity
    ? `${boxer.reputation} · Buffer: ${demotionBuffer} / ${config.bufferMax}`
    : `${rankPoints} / ${config.promotionThreshold} pts to next rank · Buffer: ${demotionBuffer} / ${config.bufferMax}`;

  return (
    <div className={styles.rankCell} title={tooltip}>
      <span className={styles.rankLabel}>{boxer.reputation}</span>
      <div className={styles.rankBarTrack}>
        <div className={styles.rankBarFill} style={{ width: `${progressPct}%` }} />
      </div>
      <div className={styles.rankBarTrack}>
        <div className={styles.bufferBarFill} style={{ width: `${bufferPct}%` }} />
      </div>
    </div>
  );
}
```

In the table `<thead>`, add a `<th>Rank</th>` after the `<th>Record</th>` column.

In the table `<tbody>` rows, add after the Record `<td>`:
```tsx
<td><RankMiniBar boxer={boxer} /></td>
```

- [ ] **Step 3: Verify Roster renders without error**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/pages/Gym/Roster.test.ts 2>&1 | tail -10
```
Expected: all tests PASS (the new component doesn't break existing tests).

- [ ] **Step 4: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/pages/Gym/Roster.tsx src/pages/Gym/Roster.module.css && git commit -m "feat: add compact rank progress bars to Roster page"
```

---

### Task 6: PlayerPage — Ranking section with progress bars and last fight delta

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`
- Modify: `src/pages/Player/PlayerPage.module.css`

- [ ] **Step 1: Add CSS for the Ranking section**

Append to `src/pages/Player/PlayerPage.module.css`:

```css
/* Ranking section */
.rankSection {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.rankRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.rankRow:last-child {
  border-bottom: none;
}

.rankRowLabel {
  color: var(--text-secondary);
  font-size: 12px;
  min-width: 80px;
}

.rankBarContainer {
  flex: 1;
  margin: 0 12px;
  height: 8px;
  background: var(--bg-surface);
  border-radius: 3px;
  border: 1px solid var(--border);
  overflow: hidden;
}

.rankBarBlue {
  height: 100%;
  background: #2196f3;
  border-radius: 3px;
  transition: width 0.2s;
}

.rankBarAmber {
  height: 100%;
  background: var(--warning);
  border-radius: 3px;
  transition: width 0.2s;
}

.rankBarNumbers {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.rankDeltaPositive {
  color: var(--success);
  font-size: 12px;
  font-weight: 600;
}

.rankDeltaNegative {
  color: var(--danger);
  font-size: 12px;
  font-weight: 600;
}

.rankDeltaNeutral {
  color: var(--text-muted);
  font-size: 12px;
}

.rankPromoted {
  color: var(--success);
  font-weight: 700;
  font-size: 13px;
}

.rankDemoted {
  color: var(--danger);
  font-weight: 700;
  font-size: 13px;
}
```

- [ ] **Step 2: Add the Ranking section to PlayerPage.tsx**

Add import at top of `src/pages/Player/PlayerPage.tsx`:
```typescript
import { RANK_CONFIG } from '../../lib/rankSystem';
```

Add a `RankingSection` component above `export default function PlayerPage()`:

```typescript
function RankingSection({ boxer }: { boxer: Boxer }) {
  const config = RANK_CONFIG[boxer.reputation];
  const rankPoints = boxer.rankPoints ?? 0;
  const demotionBuffer = boxer.demotionBuffer ?? config.bufferMax;
  const delta = boxer.lastRankDelta;

  const progressPct = config.promotionThreshold === Infinity
    ? 100
    : Math.min(100, (rankPoints / config.promotionThreshold) * 100);
  const bufferPct = Math.min(100, (demotionBuffer / config.bufferMax) * 100);

  const progressLabel = config.promotionThreshold === Infinity
    ? `${rankPoints} pts (max rank)`
    : `${rankPoints} / ${config.promotionThreshold} pts`;

  function renderDelta() {
    if (!delta) return null;
    if (delta.promoted) return <span className={styles.rankPromoted}>Promoted to {boxer.reputation}!</span>;
    if (delta.demoted) return <span className={styles.rankDemoted}>Demoted to {boxer.reputation}</span>;
    if (delta.points === 0 && delta.bufferPoints === 0) return <span className={styles.rankDeltaNeutral}>No rank change (title fight loss)</span>;
    if (delta.bufferPoints > 0) return <span className={styles.rankDeltaNegative}>−{delta.bufferPoints} buffer pts</span>;
    if (delta.points > 0 && !delta.promoted) return <span className={styles.rankDeltaPositive}>+{delta.points} pts</span>;
    if (delta.points > 0 && delta.demoted) return <span className={styles.rankDeltaNegative}>−{delta.points} pts</span>;
    return null;
  }

  return (
    <div className={styles.rankSection}>
      <div className={styles.sectionTitle}>Ranking</div>
      <div className={styles.rankRow}>
        <span className={styles.rankRowLabel}>Rank</span>
        <span style={{ flex: 1 }}>{boxer.reputation}</span>
      </div>
      <div className={styles.rankRow}>
        <span className={styles.rankRowLabel}>Progress</span>
        <div className={styles.rankBarContainer}>
          <div className={styles.rankBarBlue} style={{ width: `${progressPct}%` }} />
        </div>
        <span className={styles.rankBarNumbers}>{progressLabel}</span>
      </div>
      <div className={styles.rankRow}>
        <span className={styles.rankRowLabel}>Buffer</span>
        <div className={styles.rankBarContainer}>
          <div className={styles.rankBarAmber} style={{ width: `${bufferPct}%` }} />
        </div>
        <span className={styles.rankBarNumbers}>{demotionBuffer} / {config.bufferMax}</span>
      </div>
      {delta && (
        <div className={styles.rankRow}>
          <span className={styles.rankRowLabel}>Last fight</span>
          <span style={{ flex: 1 }}>{renderDelta()}</span>
        </div>
      )}
    </div>
  );
}
```

In the `PlayerPage` JSX, add `<RankingSection boxer={boxer} />` after the stats grid and before the fight record section:

```tsx
        {/* Ranking */}
        <RankingSection boxer={boxer} />

        {/* Fight record */}
```

- [ ] **Step 3: Verify TS compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -20
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/pages/Player/PlayerPage.tsx src/pages/Player/PlayerPage.module.css && git commit -m "feat: add Ranking section with progress/buffer bars to PlayerPage"
```

---

### Task 7: Post-fight rank change display in TopNav fight banner

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`
- Modify: `src/components/TopNav/TopNav.module.css`

- [ ] **Step 1: Add CSS for rank change banner**

Find `src/components/TopNav/TopNav.module.css` and append:

```css
.rankChangeLine {
  font-size: 12px;
  margin-top: 4px;
  color: var(--text-secondary);
}

.rankChangePromoted {
  color: var(--success);
  font-weight: 700;
}

.rankChangeDemoted {
  color: var(--danger);
  font-weight: 700;
}
```

- [ ] **Step 2: Capture rank change results in handleSimFight**

In `src/components/TopNav/TopNav.tsx`:

Add state at the top of the `TopNav` component:
```typescript
const [rankChanges, setRankChanges] = useState<Array<{ name: string; delta: NonNullable<Boxer['lastRankDelta']>; reputation: string }>>([]);
```

Add the `Boxer` type to imports:
```typescript
import type { CalendarEvent, Gym, Boxer } from '../../db/db';
```

After `await applyFightResult(...)` in `handleSimFight`, read the updated winner and loser back and collect their `lastRankDelta`:

```typescript
        const [updatedWinner, updatedLoser] = await Promise.all([
          getBoxer(simResult.winnerId),
          getBoxer(simResult.loserId),
        ]);
        const changes: typeof rankChanges = [];
        if (updatedWinner?.lastRankDelta) {
          changes.push({ name: updatedWinner.name, delta: updatedWinner.lastRankDelta, reputation: updatedWinner.reputation });
        }
        if (updatedLoser?.lastRankDelta) {
          changes.push({ name: updatedLoser.name, delta: updatedLoser.lastRankDelta, reputation: updatedLoser.reputation });
        }
        setRankChanges(prev => [...prev, ...changes]);
```

Also clear `rankChanges` at the start of `handleSimFight` (before the loop):
```typescript
setRankChanges([]);
```

- [ ] **Step 3: Render rank changes in the fight banner**

In the TopNav JSX, find the `fightBanner` div. After the existing banner content, add:

```tsx
      {rankChanges.length > 0 && (
        <div className={styles.fightBanner}>
          {rankChanges.map((change, i) => {
            const { name, delta, reputation } = change;
            if (delta.promoted) return (
              <div key={i} className={styles.rankChangeLine}>
                <span className={styles.rankChangePromoted}>{name}: Promoted to {reputation}!</span>
              </div>
            );
            if (delta.demoted) return (
              <div key={i} className={styles.rankChangeLine}>
                <span className={styles.rankChangeDemoted}>{name}: Demoted to {reputation}</span>
              </div>
            );
            if (delta.points > 0) return (
              <div key={i} className={styles.rankChangeLine}>
                {name}: <span className={styles.rankChangePromoted}>+{delta.points} rank pts</span> ({reputation})
              </div>
            );
            if (delta.bufferPoints > 0) return (
              <div key={i} className={styles.rankChangeLine}>
                {name}: <span className={styles.rankChangeDemoted}>−{delta.bufferPoints} buffer pts</span> ({reputation})
              </div>
            );
            return null;
          })}
          <button className={styles.dismissBtn} onClick={() => setRankChanges([])}>Dismiss</button>
        </div>
      )}
```

- [ ] **Step 4: Verify TS compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -20
```
Expected: no output.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1 | tail -10
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/components/TopNav/TopNav.tsx src/components/TopNav/TopNav.module.css && git commit -m "feat: show rank change results in TopNav banner after sim fight"
```

---

## Self-Review

**Spec coverage:**
- ✅ `rankPoints` and `demotionBuffer` on `Boxer` — Task 1
- ✅ `lastRankDelta` on `Boxer` — Task 1
- ✅ DB version bump + migration comment — Task 1
- ✅ `RANK_CONFIG` with all 10 levels — Task 2
- ✅ `applyRankChange` with win/loss/draw/title logic — Task 2
- ✅ All edge cases (floor, ceiling, non-negative) — Task 2 tests
- ✅ `worldGen` initialization — Task 3
- ✅ `fightResultApplier` integration — Task 4
- ✅ Roster compact rank indicator — Task 5
- ✅ PlayerPage Ranking section — Task 6
- ✅ Post-fight summary in TopNav — Task 7

**Type consistency:**
- `applyRankChange` is defined in Task 2 and called identically in Tasks 4, 5, 6
- `RANK_CONFIG` imported from `rankSystem` in Tasks 5, 6 — same module
- `lastRankDelta` shape defined in Task 1, read in Tasks 6, 7 — consistent field names

**Placeholder check:** No TBDs. Task 4 Step 1 instructs to follow existing test patterns with a `grep` command to find them first.
