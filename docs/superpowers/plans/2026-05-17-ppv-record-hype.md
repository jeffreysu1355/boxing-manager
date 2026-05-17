# PPV Record Hype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make boxing records (win rate + current win streak) influence PPV viewership via two stacking multipliers on top of the existing reputation rank bonus.

**Architecture:** Add two pure helper functions (`calcRecordMultiplier`, `calcStreakMultiplier`) to `ppvCalc.ts`. Extend `calcViewers` with two optional `FightRecord[]` params. Update `fightResultApplier.ts` to pass the boxer records. No DB schema changes.

**Tech Stack:** TypeScript, Vitest (tests), IndexedDB via `idb` (data layer — no changes needed here)

---

## File Map

| File | Change |
|------|--------|
| `src/lib/ppvCalc.ts` | Add `calcRecordMultiplier`, `calcStreakMultiplier`; extend `calcViewers` params |
| `src/lib/ppvCalc.test.ts` | Add tests for both helpers and updated `calcViewers` |
| `src/components/TopNav/fightResultApplier.ts` | Pass `gymBoxer.record` and `opponent.record` to `calcViewers` |

---

## Task 1: Add `calcRecordMultiplier` with tests

**Files:**
- Modify: `src/lib/ppvCalc.ts`
- Modify: `src/lib/ppvCalc.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `src/lib/ppvCalc.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calcViewers, calcPpvPayout, PPV_REVENUE_PER_VIEWER, calcRecordMultiplier } from './ppvCalc';

describe('calcRecordMultiplier', () => {
  const win = (n: number) => Array.from({ length: n }, () => ({
    result: 'win' as const, opponentName: 'X', opponentId: null,
    method: 'KO', finishingMove: null, round: 1, time: '1:00',
    federation: 'NABF', date: '2026-01-01',
  }));
  const loss = (n: number) => Array.from({ length: n }, () => ({
    result: 'loss' as const, opponentName: 'X', opponentId: null,
    method: 'KO', finishingMove: null, round: 1, time: '1:00',
    federation: 'NABF', date: '2026-01-01',
  }));

  it('returns 1.0 for two fighters with no fights (neutral default)', () => {
    expect(calcRecordMultiplier([], [])).toBe(1.0);
  });

  it('returns 1.0 when both have 50% win rate (anchor point)', () => {
    // 1 win, 1 loss each → 50% → geometric mean 0.5 → multiplier 1.0
    expect(calcRecordMultiplier([...win(1), ...loss(1)], [...win(1), ...loss(1)])).toBe(1.0);
  });

  it('returns 1.4 when both are undefeated (max bonus)', () => {
    // 100% win rate each → geometric mean 1.0 → multiplier 1.4
    expect(calcRecordMultiplier(win(10), win(10))).toBe(1.4);
  });

  it('returns near 1.0 for lopsided matchup (90% vs 10%)', () => {
    // geometric mean = sqrt(0.9 * 0.1) = sqrt(0.09) ≈ 0.3 → below 0.5 anchor → 1.0
    const highWin = [...win(9), ...loss(1)];
    const lowWin = [...win(1), ...loss(9)];
    expect(calcRecordMultiplier(highWin, lowWin)).toBe(1.0);
  });

  it('returns ~1.24 for two 80% win rate fighters', () => {
    // geometric mean = 0.8 → (0.8 - 0.5) * 0.8 = 0.24 → multiplier 1.24
    const record = [...win(8), ...loss(2)];
    expect(calcRecordMultiplier(record, record)).toBeCloseTo(1.24, 2);
  });

  it('caps at 1.4 even above 100% (only wins)', () => {
    expect(calcRecordMultiplier(win(100), win(100))).toBe(1.4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/lib/ppvCalc.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|PASS|calcRecordMultiplier"
```

Expected: FAIL — `calcRecordMultiplier is not exported`

- [ ] **Step 3: Implement `calcRecordMultiplier` in `ppvCalc.ts`**

Add this import at the top of `src/lib/ppvCalc.ts`:

```typescript
import type { FightRecord } from '../db/db';
```

Add this function after the existing constants:

```typescript
export function calcRecordMultiplier(recordA: FightRecord[], recordB: FightRecord[]): number {
  const winRate = (record: FightRecord[]) => {
    if (record.length === 0) return 0.5;
    const wins = record.filter(r => r.result === 'win').length;
    return wins / record.length;
  };
  const geoMean = Math.sqrt(winRate(recordA) * winRate(recordB));
  return 1.0 + Math.min(0.4, Math.max(0, geoMean - 0.5) * 0.8);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/lib/ppvCalc.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|PASS|calcRecordMultiplier"
```

Expected: all `calcRecordMultiplier` tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ppvCalc.ts src/lib/ppvCalc.test.ts
git commit -m "feat: add calcRecordMultiplier for win-rate-based PPV hype"
```

---

## Task 2: Add `calcStreakMultiplier` with tests

**Files:**
- Modify: `src/lib/ppvCalc.ts`
- Modify: `src/lib/ppvCalc.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `src/lib/ppvCalc.test.ts` (after the `calcRecordMultiplier` describe block):

```typescript
import { calcStreakMultiplier } from './ppvCalc';

describe('calcStreakMultiplier', () => {
  const makeRecord = (results: ('win' | 'loss')[]) =>
    results.map(result => ({
      result, opponentName: 'X', opponentId: null,
      method: 'KO', finishingMove: null, round: 1, time: '1:00',
      federation: 'NABF', date: '2026-01-01',
    }));

  it('returns 1.0 for two fighters with no fights', () => {
    expect(calcStreakMultiplier([], [])).toBe(1.0);
  });

  it('returns 1.0 when neither is on a winning streak', () => {
    const record = makeRecord(['win', 'loss']);
    expect(calcStreakMultiplier(record, record)).toBe(1.0);
  });

  it('returns 1.15 when both are on 5+ fight win streaks (max bonus)', () => {
    const record = makeRecord(['loss', 'win', 'win', 'win', 'win', 'win']);
    expect(calcStreakMultiplier(record, record)).toBeCloseTo(1.15, 5);
  });

  it('returns ~1.0 when one is on a streak but the other is not', () => {
    const streaking = makeRecord(['win', 'win', 'win', 'win', 'win']);
    const notStreaking = makeRecord(['win', 'loss']);
    // geometric mean of (5/5) and (0/5) = 0 → no bonus
    expect(calcStreakMultiplier(streaking, notStreaking)).toBe(1.0);
  });

  it('returns ~1.09 when both are on 3-fight win streaks', () => {
    // sqrt((3/5) * (3/5)) * 0.15 = 0.6 * 0.15 = 0.09 → 1.09
    const record = makeRecord(['win', 'win', 'win', 'win', 'win', 'loss', 'win', 'win', 'win']);
    expect(calcStreakMultiplier(record, record)).toBeCloseTo(1.09, 5);
  });

  it('caps streak at 5 regardless of longer streak', () => {
    const longStreak = makeRecord(['win', 'win', 'win', 'win', 'win', 'win', 'win', 'win']);
    expect(calcStreakMultiplier(longStreak, longStreak)).toBeCloseTo(1.15, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/lib/ppvCalc.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|PASS|calcStreakMultiplier"
```

Expected: FAIL — `calcStreakMultiplier is not exported`

- [ ] **Step 3: Implement `calcStreakMultiplier` in `ppvCalc.ts`**

Add this function after `calcRecordMultiplier` in `src/lib/ppvCalc.ts`:

```typescript
export function calcStreakMultiplier(recordA: FightRecord[], recordB: FightRecord[]): number {
  const currentStreak = (record: FightRecord[]) => {
    let streak = 0;
    for (let i = record.length - 1; i >= 0; i--) {
      if (record[i].result !== 'win') break;
      streak++;
    }
    return Math.min(streak, 5);
  };
  const geoMean = Math.sqrt((currentStreak(recordA) / 5) * (currentStreak(recordB) / 5));
  return 1.0 + geoMean * 0.15;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/lib/ppvCalc.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|PASS|calcStreakMultiplier"
```

Expected: all `calcStreakMultiplier` tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ppvCalc.ts src/lib/ppvCalc.test.ts
git commit -m "feat: add calcStreakMultiplier for win-streak-based PPV hype"
```

---

## Task 3: Wire record multipliers into `calcViewers`

**Files:**
- Modify: `src/lib/ppvCalc.ts`
- Modify: `src/lib/ppvCalc.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the `calcViewers` describe block in `src/lib/ppvCalc.test.ts` (inside the existing describe, after the last `it`):

```typescript
  it('applies record multiplier when both records are passed', () => {
    // both 100% win rate → recordMult = 1.4; no streak → streakMult = 1.0
    const wins = Array.from({ length: 10 }, () => ({
      result: 'win' as const, opponentName: 'X', opponentId: null,
      method: 'KO', finishingMove: null, round: 1, time: '1:00',
      federation: 'NABF', date: '2026-01-01',
    }));
    const viewers = calcViewers({
      network, gymBoxerRank: 0, opponentRank: 0,
      isTitleFight: false, isSameFederation: false,
      gymBoxerRecord: wins, opponentRecord: wins,
    });
    expect(viewers).toBeCloseTo(600_000 * 1.4, 0);
  });

  it('applies streak multiplier when both on 5-fight win streaks', () => {
    // 50% win rate (neutral record mult 1.0) + both on 5-streak → streakMult = 1.15
    const mixedRecord = Array.from({ length: 10 }, (_, i) => ({
      result: (i % 2 === 0 ? 'win' : 'loss') as 'win' | 'loss',
      opponentName: 'X', opponentId: null,
      method: 'KO', finishingMove: null, round: 1, time: '1:00',
      federation: 'NABF', date: '2026-01-01',
    }));
    // end with 5 wins to create streak
    const streakRecord = [
      ...mixedRecord,
      ...Array.from({ length: 5 }, () => ({
        result: 'win' as const, opponentName: 'X', opponentId: null,
        method: 'KO', finishingMove: null, round: 1, time: '1:00',
        federation: 'NABF', date: '2026-01-01',
      })),
    ];
    const viewers = calcViewers({
      network, gymBoxerRank: 0, opponentRank: 0,
      isTitleFight: false, isSameFederation: false,
      gymBoxerRecord: streakRecord, opponentRecord: streakRecord,
    });
    // winRate ≈ 10/15 each → geoMean ≈ 0.667 → recordMult ≈ 1.133; streakMult = 1.15
    const winRate = 10 / 15;
    const geoMean = Math.sqrt(winRate * winRate);
    const expectedRecordMult = 1.0 + Math.min(0.4, Math.max(0, geoMean - 0.5) * 0.8);
    expect(viewers).toBeCloseTo(600_000 * expectedRecordMult * 1.15, 0);
  });

  it('neutral multipliers (1.0) when records are omitted', () => {
    // existing behavior unchanged when gymBoxerRecord/opponentRecord not passed
    const viewers = calcViewers({
      network, gymBoxerRank: 0, opponentRank: 0,
      isTitleFight: false, isSameFederation: false,
    });
    expect(viewers).toBe(600_000);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/lib/ppvCalc.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|PASS|record multiplier|streak multiplier|neutral"
```

Expected: FAIL — `gymBoxerRecord` is not a known param on `ViewerParams`

- [ ] **Step 3: Extend `calcViewers` in `ppvCalc.ts`**

Replace the `ViewerParams` interface and `calcViewers` function in `src/lib/ppvCalc.ts`:

```typescript
interface ViewerParams {
  network: {
    baseViewership: number;
    titleFightMultiplier: number;
    minBoxerRank: number;
    federationId: number;
  };
  gymBoxerRank: number;
  opponentRank: number;
  isTitleFight: boolean;
  isSameFederation: boolean;
  gymBoxerRecord?: FightRecord[];
  opponentRecord?: FightRecord[];
}

export function calcViewers(params: ViewerParams): number {
  const {
    network, gymBoxerRank, opponentRank,
    isTitleFight, isSameFederation,
    gymBoxerRecord = [], opponentRecord = [],
  } = params;

  const base = network.baseViewership * 0.6;
  const homeFederationBonus = isSameFederation ? 1.2 : 1.0;

  const excessA = Math.max(0, gymBoxerRank - network.minBoxerRank);
  const excessB = Math.max(0, opponentRank - network.minBoxerRank);
  const rankBonus = Math.min(1.5, 1 + (excessA + excessB) * 0.05);

  const titleBonus = isTitleFight ? network.titleFightMultiplier : 1.0;
  const recordMult = calcRecordMultiplier(gymBoxerRecord, opponentRecord);
  const streakMult = calcStreakMultiplier(gymBoxerRecord, opponentRecord);

  return Math.round(base * homeFederationBonus * rankBonus * titleBonus * recordMult * streakMult);
}
```

- [ ] **Step 4: Run all ppvCalc tests to verify everything passes**

```bash
npm test -- src/lib/ppvCalc.test.ts --reporter=verbose 2>&1 | tail -15
```

Expected: all tests PASS, 0 failures

- [ ] **Step 5: Commit**

```bash
git add src/lib/ppvCalc.ts src/lib/ppvCalc.test.ts
git commit -m "feat: wire record and streak multipliers into calcViewers"
```

---

## Task 4: Pass boxer records in `fightResultApplier.ts`

**Files:**
- Modify: `src/components/TopNav/fightResultApplier.ts`

The `winner` and `loser` boxer objects are already fetched at this point. `gymBoxer` and `opponent` are derived from them. We just pass their `.record` arrays to `calcViewers`.

- [ ] **Step 1: Update the `calcViewers` call in `fightResultApplier.ts`**

Find the `calcViewers` call (around line 128) and replace it:

```typescript
          const baseViewers = calcViewers({
            network,
            gymBoxerRank,
            opponentRank,
            isTitleFight,
            isSameFederation: network.federationId === federationId,
            gymBoxerRecord: gymBoxer?.record ?? [],
            opponentRecord: opponent?.record ?? [],
          });
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test -- --reporter=verbose 2>&1 | tail -10
```

Expected: all 404+ tests PASS, 0 failures

- [ ] **Step 3: Commit**

```bash
git add src/components/TopNav/fightResultApplier.ts
git commit -m "feat: pass boxer records to calcViewers for PPV record hype"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run full test suite one more time**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests pass

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors

- [ ] **Step 3: Confirm the feature end-to-end (manual)**

Start the dev server and schedule a fight with a PPV network. After the fight resolves, check the Finances page. Two fighters with long win streaks and high win rates should yield a noticeably higher PPV payout than the base calculation.

```bash
npm run dev
```
