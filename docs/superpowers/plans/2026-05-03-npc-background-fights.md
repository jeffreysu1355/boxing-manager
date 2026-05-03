# NPC Background Fight Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simulate background fights for all non-gym boxers during time advancement, updating records/titles and displaying results on a new League > Results page.

**Architecture:** When `handleSim` runs in TopNav, a new `simulateNpcFights(fromDate, toDate)` function matches non-gym boxers whose `nextFightDate` falls in the sim window, runs `simulateFight()` on each pair, and persists results to the existing `fights` store (marked by `contractId: null`). A new RecentResults page queries those fights filtered to the last 12 months.

**Tech Stack:** React 18, TypeScript, IndexedDB via `idb`, Vitest, React Router v7, CSS Modules

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/db/db.ts` | Modify | Add `nextFightDate?: string` to `Boxer`; change `contractId: number` → `contractId: number | null` on `Fight`; bump DB version to 12 |
| `src/components/TopNav/fightResultApplier.ts` | Modify | Guard contract lookup on `contractId !== null` |
| `src/db/worldGen.ts` | Modify | Set `nextFightDate` on generated federation boxers, free agents, and prospects |
| `src/lib/npcFightSim.ts` | Create | `simulateNpcFights(fromDate, toDate)` — full matching + simulation pipeline |
| `src/lib/npcFightSim.test.ts` | Create | Unit tests for matching logic, title fight detection, double-booking, re-roll |
| `src/components/TopNav/TopNav.tsx` | Modify | Call `simulateNpcFights` after `runTraining` |
| `src/pages/League/RecentResults.tsx` | Create | Read-only page showing NPC fights from last 12 months |
| `src/pages/League/RecentResults.module.css` | Create | Page styles |
| `src/routes.tsx` | Modify | Add `/league/results` route |
| `src/components/Sidebar/Sidebar.tsx` | Modify | Add "Results" link under League section |

---

## Task 1: Update `Fight.contractId` to be nullable and bump DB version

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Update the `Fight` interface and add DB migration**

In `src/db/db.ts`, make two changes:

1. Change the `contractId` field on `Fight`:
```ts
// Before:
contractId: number;

// After:
contractId: number | null; // null = NPC-simulated fight with no player contract
```

2. Change the DB version from `11` to `12` and add a no-op migration comment block:
```ts
// Before:
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 11, {

// After:
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 12, {
```

And add after the existing `if (oldVersion < 11)` block:
```ts
      if (oldVersion < 12) {
        // contractId on Fight changed from number to number | null.
        // Existing fights have a numeric contractId and remain valid.
        // New NPC fights will have contractId: null.
      }
```

- [ ] **Step 2: Fix the TypeScript error in `fightResultApplier.ts`**

`applyFightResult` currently always calls `getFightContract(contractId)`. Guard it:

In `src/components/TopNav/fightResultApplier.ts`, change the contract lookup (step 4):

```ts
// Before:
  // 4. Mark contract completed
  const contract = await getFightContract(contractId);
  if (contract) {
    await putFightContract({ ...contract, status: 'completed' });
  }

// After:
  // 4. Mark contract completed (skip for NPC fights which have no contract)
  if (contractId !== null) {
    const contract = await getFightContract(contractId);
    if (contract) {
      await putFightContract({ ...contract, status: 'completed' });
    }
  }
```

Also update the `ApplyFightResultParams` interface in the same file:
```ts
// Before:
  contractId: number;

// After:
  contractId: number | null;
```

Also add a comment to the `Fight` interface in `src/db/db.ts` documenting the `-1` sentinel for cross-federation NPC fights:
```ts
  federationId: number; // -1 for cross-federation NPC fights (no single federation host)
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```
Expected: no errors related to `contractId`.

- [ ] **Step 4: Commit**

```bash
git add src/db/db.ts src/components/TopNav/fightResultApplier.ts
git commit -m "feat: make Fight.contractId nullable for NPC fights"
```

---

## Task 2: Add `nextFightDate` to `Boxer` type

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add the field to the `Boxer` interface**

In `src/db/db.ts`, add after `demotionBuffer: number;`:
```ts
  nextFightDate?: string; // ISO date — when this boxer is next scheduled to fight (NPC only)
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```
Expected: no errors. (Field is optional so no existing call sites break.)

- [ ] **Step 3: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: add nextFightDate field to Boxer type"
```

---

## Task 3: Set `nextFightDate` during world generation

**Files:**
- Modify: `src/db/worldGen.ts`

- [ ] **Step 1: Add `addDays` import**

At the top of `src/db/worldGen.ts`, add to the existing imports:
```ts
import { addDays } from '../lib/simTime';
```

- [ ] **Step 2: Set `nextFightDate` on federation boxers in `generateWorld`**

In `generateWorld()`, the boxer is built in this block (around line 632):
```ts
      const boxer: Omit<Boxer, 'id'> = {
        name: generateName(fedName),
        age,
        weightClass: 'welterweight',
        style,
        reputation,
        gymId: null,
        federationId: fedId,
        stats: generateStats(reputation, style),
        naturalTalents: generateNaturalTalents(style),
        injuries: [],
        titles: [],
        record: generateFightRecord(reputation, style, age),
        rankPoints: 0,
        demotionBuffer: RANK_CONFIG[reputation].bufferMax,
      };
```

Add `nextFightDate` as the last field:
```ts
      const boxer: Omit<Boxer, 'id'> = {
        name: generateName(fedName),
        age,
        weightClass: 'welterweight',
        style,
        reputation,
        gymId: null,
        federationId: fedId,
        stats: generateStats(reputation, style),
        naturalTalents: generateNaturalTalents(style),
        injuries: [],
        titles: [],
        record: generateFightRecord(reputation, style, age),
        rankPoints: 0,
        demotionBuffer: RANK_CONFIG[reputation].bufferMax,
        nextFightDate: addDays('2026-01-01', rand(0, 180)),
      };
```

- [ ] **Step 3: Set `nextFightDate` on free agents in `generateFreeAgents`**

In `generateFreeAgents()`, the `freeAgent` object (around line 415):
```ts
    const freeAgent: Omit<Boxer, 'id'> = {
      name: generateName(fedName),
      age,
      weightClass: 'welterweight',
      style,
      reputation,
      gymId: null,
      federationId: null,
      stats: generateStats(reputation, style),
      naturalTalents: generateNaturalTalents(style),
      injuries: [],
      titles: [],
      record: generateFightRecord(reputation, style, age),
      rankPoints: 0,
      demotionBuffer: RANK_CONFIG[reputation].bufferMax,
    };
```

Change to:
```ts
    const freeAgent: Omit<Boxer, 'id'> = {
      name: generateName(fedName),
      age,
      weightClass: 'welterweight',
      style,
      reputation,
      gymId: null,
      federationId: null,
      stats: generateStats(reputation, style),
      naturalTalents: generateNaturalTalents(style),
      injuries: [],
      titles: [],
      record: generateFightRecord(reputation, style, age),
      rankPoints: 0,
      demotionBuffer: RANK_CONFIG[reputation].bufferMax,
      nextFightDate: addDays('2026-01-01', rand(0, 180)),
    };
```

- [ ] **Step 4: Set `nextFightDate` on prospects in `generateProspects`**

In `generateProspects()`, the `prospect` object (around line 388):
```ts
    const prospect: Omit<Boxer, 'id'> = {
      name: generateName(fedName),
      age: rand(14, 17),
      weightClass: 'welterweight',
      style,
      reputation,
      gymId: null,
      federationId: null,
      stats: generateStats(reputation, style),
      naturalTalents: generateNaturalTalents(style),
      injuries: [],
      titles: [],
      record: generateAmateurRecord(style),
      rankPoints: 0,
      demotionBuffer: RANK_CONFIG[reputation].bufferMax,
    };
```

Change to:
```ts
    const prospect: Omit<Boxer, 'id'> = {
      name: generateName(fedName),
      age: rand(14, 17),
      weightClass: 'welterweight',
      style,
      reputation,
      gymId: null,
      federationId: null,
      stats: generateStats(reputation, style),
      naturalTalents: generateNaturalTalents(style),
      injuries: [],
      titles: [],
      record: generateAmateurRecord(style),
      rankPoints: 0,
      demotionBuffer: RANK_CONFIG[reputation].bufferMax,
      nextFightDate: addDays('2026-01-01', rand(0, 180)),
    };
```

- [ ] **Step 5: Run TypeScript check**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/worldGen.ts
git commit -m "feat: set nextFightDate on NPC boxers during world generation"
```

---

## Task 4: Write `simulateNpcFights` — core matching and simulation logic

**Files:**
- Create: `src/lib/npcFightSim.ts`
- Create: `src/lib/npcFightSim.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/npcFightSim.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  pickOpponent,
  shouldBeTitleFight,
  rollNextFightDate,
} from './npcFightSim';
import type { Boxer, BoxerStats, Title } from '../db/db';

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
    gymId: null,
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

function makeTitle(overrides: Partial<Title> = {}): Title {
  return {
    id: 1,
    federationId: 1,
    weightClass: 'welterweight',
    currentChampionId: null,
    reigns: [],
    ...overrides,
  };
}

describe('rollNextFightDate', () => {
  it('returns a date 90–180 days after the given date', () => {
    const base = '2026-01-01';
    for (let i = 0; i < 20; i++) {
      const result = rollNextFightDate(base);
      const [by, bm, bd] = base.split('-').map(Number);
      const [ry, rm, rd] = result.split('-').map(Number);
      const baseMs = new Date(by, bm - 1, bd).getTime();
      const resultMs = new Date(ry, rm - 1, rd).getTime();
      const days = Math.round((resultMs - baseMs) / 86_400_000);
      expect(days).toBeGreaterThanOrEqual(90);
      expect(days).toBeLessThanOrEqual(180);
    }
  });
});

describe('pickOpponent', () => {
  it('returns null when no candidates exist', () => {
    const boxer = makeBoxer(1);
    expect(pickOpponent(boxer, [], new Set())).toBeNull();
  });

  it('never picks a boxer already in matchedIds', () => {
    const boxer = makeBoxer(1);
    const candidate = makeBoxer(2);
    expect(pickOpponent(boxer, [candidate], new Set([2]))).toBeNull();
  });

  it('never picks the boxer itself', () => {
    const boxer = makeBoxer(1);
    expect(pickOpponent(boxer, [boxer], new Set())).toBeNull();
  });

  it('never picks a boxer of a different weight class', () => {
    const boxer = makeBoxer(1, { weightClass: 'welterweight' });
    const candidate = makeBoxer(2, { weightClass: 'heavyweight' });
    expect(pickOpponent(boxer, [candidate], new Set())).toBeNull();
  });

  it('picks same-reputation boxer by default', () => {
    const boxer = makeBoxer(1, { reputation: 'Unknown' });
    const sameRep = makeBoxer(2, { reputation: 'Unknown' });
    const higherRep = makeBoxer(3, { reputation: 'All-Time Great' });
    // Run many times to confirm sameRep is always preferred over a far-away rep
    const results = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const pick = pickOpponent(boxer, [sameRep, higherRep], new Set());
      if (pick) results.add(pick.id!);
    }
    expect(results.has(2)).toBe(true); // sameRep was chosen at least once
    expect(results.has(3)).toBe(false); // higherRep (gap > 1) never chosen
  });

  it('a boxer seeking rank (win rate < 40%) prefers +1 reputation tier', () => {
    // 1 win, 4 losses = 20% win rate → seeking rank
    const boxer = makeBoxer(1, {
      reputation: 'Local Star',
      record: [
        { result: 'win', opponentName: 'X', opponentId: null, method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
        { result: 'loss', opponentName: 'X', opponentId: null, method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
        { result: 'loss', opponentName: 'X', opponentId: null, method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
        { result: 'loss', opponentName: 'X', opponentId: null, method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
        { result: 'loss', opponentName: 'X', opponentId: null, method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
      ],
    });
    const higherTier = makeBoxer(2, { reputation: 'Rising Star' });
    const sameTier = makeBoxer(3, { reputation: 'Local Star' });

    const higherCount = Array.from({ length: 100 }, () =>
      pickOpponent(boxer, [higherTier, sameTier], new Set())?.id
    ).filter(id => id === 2).length;

    // Higher-tier should be picked majority of the time (weight 3 vs 1)
    expect(higherCount).toBeGreaterThan(50);
  });

  it('a boxer padding record (win rate >= 60%) sometimes picks -1 tier', () => {
    // 6 wins, 1 loss = ~86% win rate → padding record
    const makeRecord = (result: 'win' | 'loss') => ({
      result, opponentName: 'X', opponentId: null, method: 'KO' as const,
      finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01',
    });
    const boxer = makeBoxer(1, {
      reputation: 'Rising Star',
      record: [
        makeRecord('win'), makeRecord('win'), makeRecord('win'),
        makeRecord('win'), makeRecord('win'), makeRecord('win'),
        makeRecord('loss'),
      ],
    });
    const lowerTier = makeBoxer(2, { reputation: 'Local Star' });
    const sameTier = makeBoxer(3, { reputation: 'Rising Star' });

    const lowerCount = Array.from({ length: 100 }, () =>
      pickOpponent(boxer, [lowerTier, sameTier], new Set())?.id
    ).filter(id => id === 2).length;

    // Lower-tier should be picked sometimes (weight 1 out of total 3)
    expect(lowerCount).toBeGreaterThan(0);
    expect(lowerCount).toBeLessThan(60);
  });
});

describe('shouldBeTitleFight', () => {
  it('returns false when neither boxer holds the title', () => {
    const a = makeBoxer(1, { federationId: 1 });
    const b = makeBoxer(2, { federationId: 1 });
    const title = makeTitle({ federationId: 1, currentChampionId: 99, weightClass: 'welterweight' });
    expect(shouldBeTitleFight(a, b, [title])).toBe(false);
  });

  it('returns true when exactly one boxer holds the title and same federation', () => {
    const a = makeBoxer(1, { federationId: 1 });
    const b = makeBoxer(2, { federationId: 1 });
    const title = makeTitle({ federationId: 1, currentChampionId: 1, weightClass: 'welterweight' });
    expect(shouldBeTitleFight(a, b, [title])).toBe(true);
  });

  it('returns false when boxers are in different federations', () => {
    const a = makeBoxer(1, { federationId: 1 });
    const b = makeBoxer(2, { federationId: 2 });
    const title = makeTitle({ federationId: 1, currentChampionId: 1, weightClass: 'welterweight' });
    expect(shouldBeTitleFight(a, b, [title])).toBe(false);
  });

  it('returns false when no title exists for the weight class', () => {
    const a = makeBoxer(1, { federationId: 1 });
    const b = makeBoxer(2, { federationId: 1 });
    const title = makeTitle({ federationId: 1, currentChampionId: 1, weightClass: 'heavyweight' });
    expect(shouldBeTitleFight(a, b, [title])).toBe(false);
  });

  it('returns false when both boxers hold a title (edge case — each in different weight)', () => {
    const a = makeBoxer(1, { federationId: 1, weightClass: 'welterweight' });
    const b = makeBoxer(2, { federationId: 1, weightClass: 'welterweight' });
    // Two titles for same federation/weight, one for each (shouldn't happen in practice, but test the guard)
    const title1 = makeTitle({ id: 1, federationId: 1, currentChampionId: 1, weightClass: 'welterweight' });
    const title2 = makeTitle({ id: 2, federationId: 1, currentChampionId: 2, weightClass: 'welterweight' });
    // Both hold a title — should return false (only one champion per weight class)
    // In practice there's only one title per fed/weight, but if both ids appear as champion, return false
    expect(shouldBeTitleFight(a, b, [title1, title2])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/npcFightSim.test.ts
```
Expected: FAIL — `Cannot find module './npcFightSim'`

- [ ] **Step 3: Implement `src/lib/npcFightSim.ts`**

Create `src/lib/npcFightSim.ts`:

```ts
import { getAllBoxers, putBoxer } from '../db/boxerStore';
import { getAllFights, putFight, deleteFight } from '../db/fightStore';
import { getAllTitles, putTitle } from '../db/titleStore';
import { getFederation } from '../db/federationStore';
import { simulateFight } from './fightSim';
import { applyRankChange, REPUTATION_ORDER } from './rankSystem';
import { addDays } from './simTime';
import type { Boxer, Fight, FightRecord, Title, WeightClass } from '../db/db';

export function rollNextFightDate(fromDate: string): string {
  const days = Math.floor(Math.random() * 91) + 90; // 90–180
  return addDays(fromDate, days);
}

function winRate(boxer: Boxer): number {
  const proFights = boxer.record.filter(r => r.result === 'win' || r.result === 'loss');
  if (proFights.length === 0) return 0.5;
  return proFights.filter(r => r.result === 'win').length / proFights.length;
}

function repIndex(boxer: Boxer): number {
  return REPUTATION_ORDER.indexOf(boxer.reputation);
}

function scoreCandidate(boxer: Boxer, candidate: Boxer): number {
  const gap = repIndex(candidate) - repIndex(boxer); // positive = candidate is higher rep
  if (Math.abs(gap) > 1) return 0; // never match more than 1 tier apart

  const rate = winRate(boxer);

  if (rate < 0.40) {
    // Seeking rank: prefer +1 tier
    if (gap === 1)  return 3;
    if (gap === 0)  return 1;
    return 0;
  }

  if (rate >= 0.60) {
    // Padding record: prefer same tier, occasionally -1
    if (gap === 0)  return 2;
    if (gap === -1) return 1;
    return 0;
  }

  // Default: same tier strongly preferred, ±1 allowed
  if (gap === 0)  return 3;
  if (gap === 1 || gap === -1) return 1;
  return 0;
}

export function pickOpponent(
  boxer: Boxer,
  candidates: Boxer[],
  matchedIds: Set<number>,
): Boxer | null {
  const scored = candidates
    .filter(c =>
      c.id !== boxer.id &&
      c.id !== undefined &&
      !matchedIds.has(c.id!) &&
      c.weightClass === boxer.weightClass
    )
    .map(c => ({ boxer: c, score: scoreCandidate(boxer, c) }))
    .filter(({ score }) => score > 0);

  if (scored.length === 0) return null;

  const total = scored.reduce((s, { score }) => s + score, 0);
  let r = Math.random() * total;
  for (const { boxer: c, score } of scored) {
    r -= score;
    if (r <= 0) return c;
  }
  return scored[scored.length - 1].boxer;
}

export function shouldBeTitleFight(
  a: Boxer,
  b: Boxer,
  titles: Title[],
): boolean {
  // Must be same federation and non-null
  if (a.federationId === null || b.federationId === null) return false;
  if (a.federationId !== b.federationId) return false;

  const relevantTitles = titles.filter(
    t => t.federationId === a.federationId && t.weightClass === a.weightClass
  );

  let aIsChamp = false;
  let bIsChamp = false;
  for (const title of relevantTitles) {
    if (title.currentChampionId === a.id) aIsChamp = true;
    if (title.currentChampionId === b.id) bIsChamp = true;
  }

  // Title fight only if exactly one holds the title
  return aIsChamp !== bIsChamp;
}

function transferTitle(
  winnerId: number,
  loserId: number,
  federationId: number,
  weightClass: WeightClass,
  fightDate: string,
  titles: Title[],
): Title | null {
  const title = titles.find(
    t => t.federationId === federationId && t.weightClass === weightClass && t.currentChampionId === loserId
  );
  if (!title) return null;

  const updatedReigns = title.reigns.map(r =>
    r.dateLost === null ? { ...r, dateLost: fightDate } : r
  );
  updatedReigns.push({ boxerId: winnerId, dateWon: fightDate, dateLost: null, defenseCount: 0 });
  return { ...title, currentChampionId: winnerId, reigns: updatedReigns };
}

export async function simulateNpcFights(fromDate: string, toDate: string): Promise<void> {
  const [allBoxers, allTitles] = await Promise.all([
    getAllBoxers(),
    getAllTitles(),
  ]);

  // Only non-gym boxers participate
  const pool = allBoxers.filter(b => b.gymId === null && b.id !== undefined);

  // Collect boxers whose nextFightDate falls in (fromDate, toDate]
  const eligible = pool.filter(b =>
    b.nextFightDate !== undefined &&
    b.nextFightDate > fromDate &&
    b.nextFightDate <= toDate
  );

  const matchedIds = new Set<number>();
  const titlesMap = new Map<number, Title>(allTitles.map(t => [t.id!, t]));

  for (const boxer of eligible) {
    if (matchedIds.has(boxer.id!)) continue;

    const opponent = pickOpponent(boxer, pool, matchedIds);
    if (!opponent) {
      // No match found: re-roll 30 days out
      await putBoxer({ ...boxer, nextFightDate: addDays(boxer.nextFightDate!, 30) });
      continue;
    }

    matchedIds.add(boxer.id!);
    matchedIds.add(opponent.id!);

    const currentTitles = Array.from(titlesMap.values());
    const isTitleFight = shouldBeTitleFight(boxer, opponent, currentTitles);

    // Determine federationId for the fight (null if cross-federation)
    const fightFederationId =
      boxer.federationId !== null && boxer.federationId === opponent.federationId
        ? boxer.federationId
        : null;

    // Look up federation name for FightRecord
    let federationName = 'Independent';
    if (fightFederationId !== null) {
      const fed = await getFederation(fightFederationId);
      if (fed) federationName = fed.name;
    }

    const fightDate = boxer.nextFightDate!;

    const fightShell: Omit<Fight, 'id'> = {
      date: fightDate,
      federationId: fightFederationId ?? -1, // -1 stored when cross-federation
      weightClass: boxer.weightClass,
      boxerIds: [boxer.id!, opponent.id!],
      winnerId: null,
      method: 'Decision',
      finishingMove: null,
      round: null,
      time: null,
      isTitleFight,
      contractId: null,
    };

    const fightId = await putFight(fightShell);
    const fight: Fight = { ...fightShell, id: fightId };

    const simResult = simulateFight(boxer, opponent, fight, federationName);

    // Update fight record with sim results
    await putFight({
      ...fight,
      winnerId: simResult.winnerId,
      method: simResult.method,
      finishingMove: simResult.finishingMove,
      round: simResult.round,
      time: simResult.time,
    });

    // Apply rank changes and update boxer records
    const updatedWinner = applyRankChange(
      { ...( simResult.winnerId === boxer.id ? boxer : opponent), record: [...( simResult.winnerId === boxer.id ? boxer : opponent).record, simResult.winnerRecord] },
      simResult.winnerId === boxer.id ? opponent : boxer,
      'win',
      isTitleFight,
    );
    const updatedLoser = applyRankChange(
      { ...(simResult.loserId === boxer.id ? boxer : opponent), record: [...(simResult.loserId === boxer.id ? boxer : opponent).record, simResult.loserRecord] },
      simResult.loserId === boxer.id ? opponent : boxer,
      'loss',
      isTitleFight,
    );

    // Re-roll nextFightDate for both
    const winnerWithDate = { ...updatedWinner, nextFightDate: rollNextFightDate(fightDate) };
    const loserWithDate = { ...updatedLoser, nextFightDate: rollNextFightDate(fightDate) };

    await Promise.all([putBoxer(winnerWithDate), putBoxer(loserWithDate)]);

    // Title transfer
    if (isTitleFight && fightFederationId !== null) {
      const updated = transferTitle(
        simResult.winnerId,
        simResult.loserId,
        fightFederationId,
        boxer.weightClass,
        fightDate,
        currentTitles,
      );
      if (updated && updated.id !== undefined) {
        await putTitle(updated);
        titlesMap.set(updated.id, updated);
      }
    }
  }

  // Prune NPC fights older than 12 months
  const cutoff = addDays(toDate, -365);
  const allFights = await getAllFights();
  const stale = allFights.filter(f => f.contractId === null && f.date < cutoff);
  await Promise.all(stale.map(f => deleteFight(f.id!)));
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/npcFightSim.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/npcFightSim.ts src/lib/npcFightSim.test.ts
git commit -m "feat: implement simulateNpcFights with matching and title logic"
```

---

## Task 5: Wire `simulateNpcFights` into TopNav

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`

- [ ] **Step 1: Add import**

At the top of `src/components/TopNav/TopNav.tsx`, add:
```ts
import { simulateNpcFights } from '../../lib/npcFightSim';
```

- [ ] **Step 2: Call `simulateNpcFights` after `runTraining`**

In `handleSim`, find:
```ts
      await runTraining(currentDate, result.newDate, updated.id ?? 1);

      if (needsRecruitRefresh) {
        await refreshRecruitPool();
      }
```

Change to:
```ts
      await runTraining(currentDate, result.newDate, updated.id ?? 1);
      await simulateNpcFights(currentDate, result.newDate);

      if (needsRecruitRefresh) {
        await refreshRecruitPool();
      }
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/TopNav/TopNav.tsx
git commit -m "feat: call simulateNpcFights on each sim step"
```

---

## Task 6: Add Recent Results page

**Files:**
- Create: `src/pages/League/RecentResults.tsx`
- Create: `src/pages/League/RecentResults.module.css`
- Modify: `src/routes.tsx`
- Modify: `src/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Create CSS module**

Create `src/pages/League/RecentResults.module.css`:

```css
.page {
  padding: 1rem;
}

.empty {
  color: var(--text-muted, #888);
  font-style: italic;
}

.titleBadge {
  font-size: 0.75rem;
  background: var(--accent, #c0a020);
  color: #000;
  padding: 0 6px;
  border-radius: 3px;
  font-weight: bold;
}

.winner {
  font-weight: bold;
}
```

- [ ] **Step 2: Create `RecentResults.tsx`**

Create `src/pages/League/RecentResults.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getAllFights } from '../../db/fightStore';
import { getAllBoxers } from '../../db/boxerStore';
import { getAllFederations } from '../../db/federationStore';
import { getGym } from '../../db/gymStore';
import type { Fight, Boxer, Federation } from '../../db/db';
import styles from './RecentResults.module.css';

interface ResultRow {
  fight: Fight;
  boxer1: Boxer | undefined;
  boxer2: Boxer | undefined;
  federationName: string;
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function RecentResults() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [gym, allFights, allBoxers, allFeds] = await Promise.all([
        getGym(),
        getAllFights(),
        getAllBoxers(),
        getAllFederations(),
      ]);

      if (cancelled) return;

      const currentDate = gym?.currentDate ?? '2026-01-01';
      const [cy, cm, cd] = currentDate.split('-').map(Number);
      const cutoffMs = new Date(cy, cm - 1, cd).getTime() - 365 * 86_400_000;

      const boxerMap = new Map<number, Boxer>(
        allBoxers.filter(b => b.id !== undefined).map(b => [b.id!, b])
      );
      const fedMap = new Map<number, Federation>(
        allFeds.filter(f => f.id !== undefined).map(f => [f.id!, f])
      );

      const npcFights = allFights
        .filter(f => {
          if (f.contractId !== null) return false;
          const [fy, fm, fd] = f.date.split('-').map(Number);
          return new Date(fy, fm - 1, fd).getTime() >= cutoffMs;
        })
        .sort((a, b) => b.date.localeCompare(a.date));

      const built: ResultRow[] = npcFights.map(fight => ({
        fight,
        boxer1: fight.boxerIds[0] !== undefined ? boxerMap.get(fight.boxerIds[0]) : undefined,
        boxer2: fight.boxerIds[1] !== undefined ? boxerMap.get(fight.boxerIds[1]) : undefined,
        federationName:
          fight.federationId !== null && fight.federationId !== -1
            ? (fedMap.get(fight.federationId)?.name ?? 'Unknown Federation')
            : 'Cross-Federation',
      }));

      setRows(built);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Recent Results" subtitle="NPC fight results from the past year" />
        <p className={styles.empty}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Recent Results" subtitle="NPC fight results from the past year" />
      <div className={styles.page}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No results yet. Simulate time forward to see NPC fights.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Fighter A</th>
                <th>Fighter B</th>
                <th>Winner</th>
                <th>Method</th>
                <th>Weight Class</th>
                <th>Federation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ fight, boxer1, boxer2, federationName }) => {
                const winner = fight.winnerId === boxer1?.id ? boxer1
                             : fight.winnerId === boxer2?.id ? boxer2
                             : undefined;
                return (
                  <tr key={fight.id}>
                    <td>{formatDate(fight.date)}</td>
                    <td>
                      {boxer1
                        ? <Link to={`/player/${boxer1.id}`}>{boxer1.name}</Link>
                        : 'Unknown'}
                    </td>
                    <td>
                      {boxer2
                        ? <Link to={`/player/${boxer2.id}`}>{boxer2.name}</Link>
                        : 'Unknown'}
                    </td>
                    <td className={styles.winner}>
                      {winner
                        ? <Link to={`/player/${winner.id}`}>{winner.name}</Link>
                        : '—'}
                    </td>
                    <td>{fight.method}</td>
                    <td>{fight.weightClass}</td>
                    <td>{federationName}</td>
                    <td>
                      {fight.isTitleFight && (
                        <span className={styles.titleBadge}>Title Fight</span>
                      )}
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

- [ ] **Step 3: Add route**

In `src/routes.tsx`, add the import:
```ts
import RecentResults from './pages/League/RecentResults';
```

And add the route inside the `league` children array, after the `calendar` entry:
```ts
          { path: 'results', element: <RecentResults /> },
```

The full league children block should now be:
```ts
        children: [
          { index: true, element: <Navigate to="standings" replace /> },
          { path: 'standings', element: <Standings /> },
          { path: 'calendar', element: <Calendar /> },
          { path: 'results', element: <RecentResults /> },
          { path: 'schedule', element: <Schedule /> },
          { path: 'contracts/:id', element: <ContractNegotiation /> },
          { path: 'ppv/:fightId', element: <PpvSignup /> },
        ],
```

- [ ] **Step 4: Add sidebar link**

In `src/components/Sidebar/Sidebar.tsx`, update the `/league` config entry:
```ts
  '/league': [
    {
      label: 'League',
      links: [
        { to: '/league/standings', label: 'Standings' },
        { to: '/league/calendar', label: 'Calendar' },
        { to: '/league/results', label: 'Results' },
        { to: '/league/schedule', label: 'Schedule' },
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
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/League/RecentResults.tsx src/pages/League/RecentResults.module.css src/routes.tsx src/components/Sidebar/Sidebar.tsx
git commit -m "feat: add League > Results page showing NPC fight history"
```

---

## Task 7: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm run dev
```

- [ ] **Step 2: Reset the game**

Open the app (typically `http://localhost:5173`). If there is a "Reset Game" button or similar, reset to regenerate the world with `nextFightDate` set on all boxers.

- [ ] **Step 3: Simulate 30 days**

Click the "Sim 30 days" button in the TopNav. Verify:
- No console errors
- The game date advances

- [ ] **Step 4: Check League > Results**

Navigate to League > Results. Verify:
- NPC fights appear in the table
- Boxer names link correctly to `/player/:id`
- Federation names are populated (or "Cross-Federation" for cross-fed fights)
- Title fights show the badge

- [ ] **Step 5: Check a boxer profile**

Click a boxer name from the results table. Verify their fight record includes the simulated fight.

- [ ] **Step 6: Simulate several months and check title changes**

Simulate ~6 months. Go to League > Standings. Verify that at least one title has changed hands (check the reigning champion has changed from the initial world gen).
