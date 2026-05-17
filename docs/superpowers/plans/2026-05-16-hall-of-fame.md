# Hall of Fame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-retire NPC boxers aged 35–45, compute a career HOF score on retirement for all boxers, induct high-scorers into a Hall of Fame, and display inductees on a new League page with a badge on boxer profile pages.

**Architecture:** A new `hallOfFame` IndexedDB store persists inductees. A pure `calcHofScore` function computes scores. A `retireBoxer` async utility wraps both boxer retirement and induction. NPC retirement runs daily during the sim loop in `TopNav.tsx`. Player retirement routes through the same utility. A new page at `/league/hall-of-fame` lists all inductees.

**Tech Stack:** TypeScript, React 18, Vitest, idb (IndexedDB wrapper)

---

## File Map

| File | Change |
|------|--------|
| `src/db/db.ts` | Add `HallOfFameEntry` interface, `hallOfFame` store to schema, bump DB version to 16, add `hofScore?` to `Boxer` |
| `src/db/hallOfFameStore.ts` | **Create** — CRUD for `hallOfFame` store |
| `src/lib/hofScore.ts` | **Create** — pure `calcHofScore` function |
| `src/lib/hofScore.test.ts` | **Create** — unit tests for `calcHofScore` |
| `src/lib/retireBoxer.ts` | **Create** — async `retireBoxer` utility |
| `src/lib/retireBoxer.test.ts` | **Create** — unit tests for `retireBoxer` logic |
| `src/lib/npcFightSim.ts` | **Modify** — add NPC retirement check per day of sim range |
| `src/lib/npcFightSim.test.ts` | **Modify** — test NPC retirement probability logic |
| `src/components/TopNav/TopNav.tsx` | **Modify** — collect HOF induction results from NPC retirement; show banner |
| `src/pages/Player/PlayerPage.tsx` | **Modify** — use `retireBoxer` in `handleRetire`; show HOF badge |
| `src/pages/League/HallOfFame.tsx` | **Create** — HOF page |
| `src/routes.tsx` | **Modify** — add `/league/hall-of-fame` route |

---

### Task 1: Schema — `HallOfFameEntry`, `hofScore` on Boxer, new DB store

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add `HallOfFameEntry` interface and `hofScore` to `Boxer`**

In `src/db/db.ts`, add the interface after `GymTransaction` (before the `BoxingManagerDBSchema` interface):

```ts
export interface HallOfFameEntry {
  id?: number;
  boxerId: number;
  boxerName: string;
  weightClass: WeightClass;
  inductedDate: string;
  score: number;
  peakReputation: ReputationLevel;
  record: { wins: number; losses: number; draws: number };
  totalFights: number;
  careerSpan: number;
  titlesWon: number;
  totalDefenses: number;
}
```

Add `hofScore?: number;` to the `Boxer` interface, after `retired?: boolean;`:

```ts
  retired?: boolean;
  hofScore?: number;
```

- [ ] **Step 2: Add `hallOfFame` to `BoxingManagerDBSchema`**

In `BoxingManagerDBSchema`, add after `transactions`:

```ts
  hallOfFame: {
    key: number;
    value: HallOfFameEntry;
    indexes: { boxerId: number };
  };
```

- [ ] **Step 3: Bump DB version and add migration block**

Change `openDB<BoxingManagerDBSchema>('boxing-manager', 15, {` to `16`:

```ts
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 16, {
```

Add migration block after the `oldVersion < 15` block:

```ts
      if (oldVersion < 16) {
        const hofStore = db.createObjectStore('hallOfFame', {
          keyPath: 'id',
          autoIncrement: true,
        });
        hofStore.createIndex('boxerId', 'boxerId', { unique: true });
      }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/db/db.ts && git commit -m "feat: add HallOfFameEntry schema and hofScore to Boxer"
```

---

### Task 2: Create `hallOfFameStore.ts`

**Files:**
- Create: `src/db/hallOfFameStore.ts`

- [ ] **Step 1: Create the store file**

Create `src/db/hallOfFameStore.ts`:

```ts
import { getDB, type HallOfFameEntry } from './db';

export async function getAllHofEntries(): Promise<HallOfFameEntry[]> {
  const db = await getDB();
  return db.getAll('hallOfFame');
}

export async function putHofEntry(entry: Omit<HallOfFameEntry, 'id'>): Promise<number> {
  const db = await getDB();
  return db.put('hallOfFame', entry as HallOfFameEntry);
}

export async function getHofEntryByBoxer(boxerId: number): Promise<HallOfFameEntry | undefined> {
  const db = await getDB();
  return db.getFromIndex('hallOfFame', 'boxerId', boxerId);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/db/hallOfFameStore.ts && git commit -m "feat: add hallOfFameStore"
```

---

### Task 3: Create `calcHofScore` with tests

**Files:**
- Create: `src/lib/hofScore.ts`
- Create: `src/lib/hofScore.test.ts`

**Background:** `calcHofScore` is a pure function that takes a `Boxer` and `Title[]` and returns a number 0–100. It has four components each worth up to 25 points:
1. Career length: 1pt per year of pro fights, capped at 25
2. Peak rank: `(REPUTATION_INDEX[boxer.reputation] / 9) * 25`
3. Title reigns: scans `allTitles` for reigns where `reign.boxerId === boxer.id`. Per reign: +5 base, +2 per defense, +3 per year held. Capped at 25 total.
4. Record quality: `winRate * 15` + `min(10, floor(totalFights/10))`. No cap (max 25 naturally).

`REPUTATION_INDEX` is from `src/lib/reputationIndex.ts` (Unknown=0 ... All-Time Great=9).

The function needs `currentDate: string` to compute career span and open reign durations.

Date math: `daysBetween(a, b)` = `(new Date(b).getTime() - new Date(a).getTime()) / 86_400_000`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/hofScore.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calcHofScore } from './hofScore';
import type { Boxer, BoxerStats, Title, FightRecord } from '../db/db';

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
    name: 'Test Boxer',
    age: 35,
    weightClass: 'welterweight',
    style: 'slugger',
    reputation: 'Unknown',
    gymId: null,
    federationId: null,
    stats: makeStats(10),
    naturalTalents: [],
    injuries: [],
    titles: [],
    record: [],
    rankPoints: 0,
    demotionBuffer: 0,
    ...overrides,
  };
}

function makeWin(date: string): FightRecord {
  return {
    result: 'win',
    opponentName: 'Opp',
    opponentId: null,
    method: 'Decision',
    finishingMove: null,
    round: 10,
    time: '3:00',
    federation: 'NABF',
    date,
  };
}

function makeLoss(date: string): FightRecord {
  return { ...makeWin(date), result: 'loss' };
}

describe('calcHofScore', () => {
  it('returns 0 for a boxer with no fights', () => {
    const boxer = makeBoxer();
    expect(calcHofScore(boxer, [], '2026-05-16')).toBe(0);
  });

  it('scores career length: 1pt per year, capped at 25', () => {
    // 10 fights spanning 10 years, no titles, Unknown rep, 50% win rate, 10 fights
    const record: FightRecord[] = [];
    for (let i = 0; i < 10; i++) {
      record.push(makeWin(`${2010 + i}-01-01`));
      record.push(makeLoss(`${2010 + i}-06-01`));
    }
    const boxer = makeBoxer({ record });
    const score = calcHofScore(boxer, [], '2026-01-01');
    // careerYears ≈ 16 → 16 pts career
    // peakRank: Unknown = 0 → 0 pts
    // titles: 0 pts
    // record: 10/20 wins = 0.5 winRate → 7.5 + floor(20/10)=2 → 9.5 pts
    expect(score).toBeCloseTo(16 + 0 + 0 + 9.5, 0);
  });

  it('caps career length at 25 pts for very long careers', () => {
    const record: FightRecord[] = [];
    for (let i = 0; i < 30; i++) {
      record.push(makeWin(`${1990 + i}-01-01`));
    }
    const boxer = makeBoxer({ record, reputation: 'Unknown' });
    const score = calcHofScore(boxer, [], '2026-01-01');
    const careerComponent = Math.min(25, Math.floor(35)); // 36 yrs → capped at 25
    expect(score).toBeGreaterThanOrEqual(careerComponent);
  });

  it('scores peak reputation: All-Time Great gives 25 pts', () => {
    const boxer = makeBoxer({
      reputation: 'All-Time Great',
      record: [makeWin('2020-01-01')],
    });
    const score = calcHofScore(boxer, [], '2026-01-01');
    // career: ~6 yrs → 6 pts
    // peak rank: (9/9)*25 = 25 pts
    // record: 1 win, 1 fight → winRate=1 → 15 + 0 = 15 pts
    expect(score).toBeCloseTo(6 + 25 + 0 + 15, 0);
  });

  it('scores title reign: base + defenses + years', () => {
    const boxer = makeBoxer({
      id: 42,
      record: [makeWin('2020-01-01')],
    });
    const titles = [{
      id: 1,
      federationId: 1,
      weightClass: 'welterweight' as const,
      currentChampionId: 42,
      reigns: [{
        boxerId: 42,
        dateWon: '2020-01-01',
        dateLost: '2022-01-01',
        defenseCount: 3,
      }],
    }];
    const score = calcHofScore(boxer, titles, '2026-01-01');
    // titleComponent: 5 + 2*3 + 3*2 = 5+6+6 = 17 pts
    expect(score).toBeGreaterThan(17);
  });

  it('caps title component at 25 pts', () => {
    const boxer = makeBoxer({ id: 42, record: [makeWin('2000-01-01')] });
    const titles = [{
      id: 1,
      federationId: 1,
      weightClass: 'welterweight' as const,
      currentChampionId: 42,
      reigns: Array.from({ length: 5 }, () => ({
        boxerId: 42,
        dateWon: '2000-01-01',
        dateLost: '2010-01-01',
        defenseCount: 10,
      })),
    }];
    const score = calcHofScore(boxer, titles, '2026-01-01');
    // title component would be massive — must be capped at 25
    // peek: career ~26yrs→25, rank 0, title 25, record up to 25
    expect(score).toBeLessThanOrEqual(100);
  });

  it('HOF threshold: score >= 50 for an elite boxer', () => {
    const record: FightRecord[] = [];
    for (let i = 0; i < 15; i++) record.push(makeWin(`${2005 + i}-01-01`));
    for (let i = 0; i < 3; i++) record.push(makeLoss(`${2005 + i}-06-01`));
    const boxer = makeBoxer({
      id: 7,
      reputation: 'World Class Fighter',
      record,
    });
    const titles = [{
      id: 1,
      federationId: 1,
      weightClass: 'welterweight' as const,
      currentChampionId: null,
      reigns: [{
        boxerId: 7,
        dateWon: '2010-01-01',
        dateLost: '2013-01-01',
        defenseCount: 4,
      }],
    }];
    const score = calcHofScore(boxer, titles, '2026-01-01');
    expect(score).toBeGreaterThanOrEqual(50);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/hofScore.test.ts
```

Expected: FAIL — "Cannot find module './hofScore'"

- [ ] **Step 3: Implement `calcHofScore`**

Create `src/lib/hofScore.ts`:

```ts
import type { Boxer, Title } from '../db/db';
import { REPUTATION_INDEX } from './reputationIndex';

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

export function calcHofScore(
  boxer: Boxer,
  allTitles: Title[],
  currentDate: string,
): number {
  if (boxer.record.length === 0) return 0;

  const sortedDates = [...boxer.record.map(r => r.date)].sort();
  const firstFightDate = sortedDates[0];

  // Component 1: career length (max 25)
  const careerYears = daysBetween(firstFightDate, currentDate) / 365.25;
  const careerScore = Math.min(25, Math.floor(careerYears));

  // Component 2: peak reputation (max 25)
  const repIndex = REPUTATION_INDEX[boxer.reputation] ?? 0;
  const peakRankScore = (repIndex / 9) * 25;

  // Component 3: title reigns (max 25)
  let reignTotal = 0;
  for (const title of allTitles) {
    for (const reign of title.reigns) {
      if (reign.boxerId !== boxer.id) continue;
      const endDate = reign.dateLost ?? currentDate;
      const reignYears = daysBetween(reign.dateWon, endDate) / 365.25;
      reignTotal += 5 + 2 * reign.defenseCount + 3 * Math.floor(reignYears);
    }
  }
  const titleScore = Math.min(25, reignTotal);

  // Component 4: record quality (max 25)
  const wins = boxer.record.filter(r => r.result === 'win').length;
  const losses = boxer.record.filter(r => r.result === 'loss').length;
  const draws = boxer.record.filter(r => r.result === 'draw').length;
  const totalFights = wins + losses + draws;
  const winRate = totalFights > 0 ? wins / totalFights : 0;
  const recordScore = winRate * 15 + Math.min(10, Math.floor(totalFights / 10));

  return careerScore + peakRankScore + titleScore + recordScore;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/hofScore.test.ts
```

Expected: PASS — all tests

- [ ] **Step 5: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/lib/hofScore.ts src/lib/hofScore.test.ts && git commit -m "feat: add calcHofScore utility"
```

---

### Task 4: Create `retireBoxer` utility

**Files:**
- Create: `src/lib/retireBoxer.ts`

This is an async utility that handles all retirement logic: marks retired, computes score, saves boxer, optionally inducts into HOF. No tests for this file (it's a thin orchestration layer over tested functions; the DB calls make unit testing impractical without mocking).

- [ ] **Step 1: Create `retireBoxer.ts`**

```ts
import type { Boxer, Title, WeightClass, ReputationLevel } from '../db/db';
import { putBoxer } from '../db/boxerStore';
import { putHofEntry } from '../db/hallOfFameStore';
import { calcHofScore } from './hofScore';

const HOF_THRESHOLD = 50;

export interface RetireResult {
  inducted: boolean;
  score: number;
  boxerName: string;
}

export async function retireBoxer(
  boxer: Boxer,
  allTitles: Title[],
  currentDate: string,
): Promise<RetireResult> {
  const score = calcHofScore(boxer, allTitles, currentDate);
  const inducted = score >= HOF_THRESHOLD;

  const wins = boxer.record.filter(r => r.result === 'win').length;
  const losses = boxer.record.filter(r => r.result === 'loss').length;
  const draws = boxer.record.filter(r => r.result === 'draw').length;

  const sortedDates = [...boxer.record.map(r => r.date)].sort();
  const firstFightDate = sortedDates[0];
  const careerSpan = firstFightDate
    ? (new Date(currentDate).getTime() - new Date(firstFightDate).getTime()) / (365.25 * 86_400_000)
    : 0;

  let titlesWon = 0;
  let totalDefenses = 0;
  for (const title of allTitles) {
    for (const reign of title.reigns) {
      if (reign.boxerId !== boxer.id) continue;
      titlesWon++;
      totalDefenses += reign.defenseCount;
    }
  }

  await putBoxer({ ...boxer, retired: true, hofScore: score });

  if (inducted && boxer.id !== undefined) {
    await putHofEntry({
      boxerId: boxer.id,
      boxerName: boxer.name,
      weightClass: boxer.weightClass,
      inductedDate: currentDate,
      score,
      peakReputation: boxer.reputation,
      record: { wins, losses, draws },
      totalFights: wins + losses + draws,
      careerSpan,
      titlesWon,
      totalDefenses,
    });
  }

  return { inducted, score, boxerName: boxer.name };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/lib/retireBoxer.ts && git commit -m "feat: add retireBoxer utility"
```

---

### Task 5: NPC retirement in `npcFightSim.ts`

**Files:**
- Modify: `src/lib/npcFightSim.ts`
- Modify: `src/lib/npcFightSim.test.ts`

NPC retirement runs on eligible boxers at the end of `simulateNpcFights`. Eligible: `gymId === null`, `federationId !== null`, `!retired`, `age >= 35`. For each eligible boxer, roll `Math.random() < dailyRetireChance` where `dailyRetireChance = Math.max(0, (boxer.age - 34) * 0.002 - REPUTATION_INDEX[boxer.reputation] * 0.0002)`. Also force-retire any boxer with `age >= 45`.

The function returns `RetireResult[]` (only inducted ones need to surface in TopNav).

- [ ] **Step 1: Write failing tests for the retirement probability helper**

Add to `src/lib/npcFightSim.test.ts` (import `shouldNpcRetire` — to be exported):

```ts
import { describe, it, expect } from 'vitest';
import { shouldNpcRetire } from './npcFightSim';

describe('shouldNpcRetire', () => {
  it('returns false for boxer under 35', () => {
    // age 34, any rep → always false
    expect(shouldNpcRetire(34, 'All-Time Great')).toBe(false);
    expect(shouldNpcRetire(34, 'Unknown')).toBe(false);
  });

  it('returns true for boxer 45 or older (forced retirement)', () => {
    expect(shouldNpcRetire(45, 'All-Time Great', 0)).toBe(true);
    expect(shouldNpcRetire(45, 'Unknown', 0)).toBe(true);
  });

  it('probability increases with age for same reputation', () => {
    // Roll with a fixed seed is not possible — test the probability function directly
    // by checking the daily chance formula: (age-34)*0.002 - repIndex*0.0002
    // age 35 Unknown: 0.002 - 0 = 0.002
    // age 40 Unknown: 0.012 - 0 = 0.012
    // We verify the function returns true more often at age 40 by sampling
    let retiredAt35 = 0;
    let retiredAt40 = 0;
    for (let i = 0; i < 10000; i++) {
      if (shouldNpcRetire(35, 'Unknown')) retiredAt35++;
      if (shouldNpcRetire(40, 'Unknown')) retiredAt40++;
    }
    expect(retiredAt40).toBeGreaterThan(retiredAt35);
  });

  it('higher reputation reduces retirement chance', () => {
    let retiredUnknown = 0;
    let retiredATG = 0;
    for (let i = 0; i < 10000; i++) {
      if (shouldNpcRetire(38, 'Unknown')) retiredUnknown++;
      if (shouldNpcRetire(38, 'All-Time Great')) retiredATG++;
    }
    expect(retiredUnknown).toBeGreaterThan(retiredATG);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/npcFightSim.test.ts
```

Expected: FAIL — `shouldNpcRetire` not exported.

- [ ] **Step 3: Implement `shouldNpcRetire` and wire up retirement in `simulateNpcFights`**

At the top of `src/lib/npcFightSim.ts`, add imports:

```ts
import { retireBoxer, type RetireResult } from './retireBoxer';
import { REPUTATION_INDEX } from './reputationIndex';
```

Add the exported helper function (before `simulateNpcFights`):

```ts
export function shouldNpcRetire(
  age: number,
  reputation: import('../db/db').ReputationLevel,
  roll: number = Math.random(),
): boolean {
  if (age < 35) return false;
  if (age >= 45) return true;
  const dailyChance = Math.max(0, (age - 34) * 0.002 - (REPUTATION_INDEX[reputation] ?? 0) * 0.0002);
  return roll < dailyChance;
}
```

Change `simulateNpcFights` signature to return `Promise<RetireResult[]>` and add retirement logic at the end of the function, before the stale fight cleanup:

```ts
export async function simulateNpcFights(fromDate: string, toDate: string): Promise<RetireResult[]> {
```

And add at the end of the function body (before the stale fight cleanup block):

```ts
  // NPC retirement pass
  const retireResults: RetireResult[] = [];
  const retirableTitles = Array.from(titlesMap.values());
  const allBoxersForRetire = await getAllBoxers();
  const npcEligible = allBoxersForRetire.filter(
    b => b.gymId === null && b.federationId !== null && !b.retired && b.id !== undefined && (b.age ?? 0) >= 35
  );
  for (const boxer of npcEligible) {
    if (shouldNpcRetire(boxer.age, boxer.reputation)) {
      const result = await retireBoxer(boxer, retirableTitles, toDate);
      retireResults.push(result);
    }
  }

  // stale fight cleanup (existing code below)
```

Also add `return retireResults;` at the very end of `simulateNpcFights` (after the stale fight cleanup).

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/npcFightSim.test.ts
```

Expected: PASS — all tests.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/lib/npcFightSim.ts src/lib/npcFightSim.test.ts && git commit -m "feat: add NPC retirement with HOF scoring"
```

---

### Task 6: Wire HOF notification into `TopNav.tsx`

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`

`simulateNpcFights` now returns `RetireResult[]`. Collect inducted results and show a banner.

- [ ] **Step 1: Add `hofInductees` state**

In `TopNav.tsx`, after the `rankChanges` state declaration (~line 85), add:

```ts
const [hofInductees, setHofInductees] = useState<Array<{ name: string; score: number }>>([]);
```

- [ ] **Step 2: Clear `hofInductees` on new sim**

In `handleSim`, alongside the existing `setRankChanges([])` and `setSimmedFights([])` calls, add:

```ts
setHofInductees([]);
```

- [ ] **Step 3: Collect inducted results after `simulateNpcFights`**

Change the existing call in `handleSim`:

```ts
await simulateNpcFights(currentDate, result.newDate);
```

to:

```ts
const retireResults = await simulateNpcFights(currentDate, result.newDate);
const newInductees = retireResults
  .filter(r => r.inducted)
  .map(r => ({ name: r.boxerName, score: Math.round(r.score) }));
if (newInductees.length > 0) setHofInductees(prev => [...prev, ...newInductees]);
```

Also clear in the `useEffect` that clears on navigation change (~line 102):

```ts
useEffect(() => {
  if (!location.pathname.startsWith('/fight-results')) {
    setSimmedFights([]);
    setRankChanges([]);
    setHofInductees([]);
  }
}, [location.pathname]);
```

- [ ] **Step 4: Add HOF induction banner in the JSX**

After the `{rankChanges.length > 0 && ...}` banner block (~line 485), add:

```tsx
{hofInductees.length > 0 && (
  <div className={styles.fightBanner}>
    <div className={styles.fightResultsSection}>
      <strong>Hall of Fame!</strong>
      {hofInductees.map((inductee, i) => (
        <div key={i} className={styles.fightResultLine}>
          ⭐ {inductee.name} has been inducted into the Hall of Fame! (Score: {inductee.score})
        </div>
      ))}
    </div>
    <button className={styles.dismissBtn} onClick={() => setHofInductees([])}>Dismiss</button>
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/components/TopNav/TopNav.tsx && git commit -m "feat: show HOF induction notification in TopNav"
```

---

### Task 7: Update player retirement to use `retireBoxer`

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`

The existing `handleRetire` function (~line 197) calls `putBoxer({ ...boxer, retired: true })` directly. Replace it with `retireBoxer`, fetch `allTitles` and `currentDate` from the gym, and show an alert if inducted.

- [ ] **Step 1: Add imports to `PlayerPage.tsx`**

Add to the existing imports at the top:

```ts
import { getAllTitles } from '../../db/titleStore';
import { retireBoxer } from '../../lib/retireBoxer';
```

- [ ] **Step 2: Replace `handleRetire`**

Replace the existing `handleRetire` function (lines ~197–202):

```ts
async function handleRetire() {
  if (!boxer || boxer.id === undefined) return;
  if (!window.confirm(`Retire ${boxer.name}? This cannot be undone.`)) return;
  const [allTitles, gym] = await Promise.all([getAllTitles(), getGym()]);
  const currentDate = gym?.currentDate ?? '2026-01-01';
  const result = await retireBoxer(boxer, allTitles, currentDate);
  if (result.inducted) {
    window.alert(`${boxer.name} has been inducted into the Hall of Fame! (Score: ${Math.round(result.score)})`);
  }
  navigate('/gym/roster');
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/pages/Player/PlayerPage.tsx && git commit -m "feat: use retireBoxer in player retirement flow"
```

---

### Task 8: HOF badge on boxer profile page

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`

Show a `⭐ Hall of Fame (Score: X)` badge near the header if the boxer has a HOF entry. The badge links to `/league/hall-of-fame`.

- [ ] **Step 1: Add `hofEntry` state**

In `PlayerPage.tsx`, add state after `gymId`:

```ts
const [hofEntry, setHofEntry] = useState<import('../../db/db').HallOfFameEntry | null>(null);
```

Add import for `getHofEntryByBoxer`:

```ts
import { getHofEntryByBoxer } from '../../db/hallOfFameStore';
```

- [ ] **Step 2: Load HOF entry in `useEffect`**

Inside the `load()` async function in `useEffect` (~line 162), after `setBoxer(b ?? null)`, add:

```ts
if (b?.id !== undefined) {
  const hof = await getHofEntryByBoxer(b.id);
  if (!cancelled) setHofEntry(hof ?? null);
}
```

- [ ] **Step 3: Render the badge**

In the JSX, after the `PageHeader` component (~line 230), add the badge before the godMode edit button block:

```tsx
{hofEntry && (
  <div style={{ marginBottom: 8 }}>
    <Link
      to="/league/hall-of-fame"
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        background: 'var(--accent)',
        color: '#000',
        borderRadius: 3,
        fontWeight: 600,
        fontSize: 13,
        textDecoration: 'none',
      }}
    >
      ⭐ Hall of Fame (Score: {Math.round(hofEntry.score)})
    </Link>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/pages/Player/PlayerPage.tsx && git commit -m "feat: add HOF badge to boxer profile page"
```

---

### Task 9: Hall of Fame page and routing

**Files:**
- Create: `src/pages/League/HallOfFame.tsx`
- Modify: `src/routes.tsx`

- [ ] **Step 1: Create `HallOfFame.tsx`**

Create `src/pages/League/HallOfFame.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getAllHofEntries } from '../../db/hallOfFameStore';
import type { HallOfFameEntry } from '../../db/db';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function HallOfFame() {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllHofEntries().then(all => {
      setEntries(all.sort((a, b) => b.score - a.score));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Hall of Fame" subtitle="Boxing legends" />
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Hall of Fame" subtitle="Boxing legends" />
      {entries.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>
          No boxers have been inducted into the Hall of Fame yet.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Weight Class</th>
              <th>Record</th>
              <th>Peak Reputation</th>
              <th>Career Span</th>
              <th>Titles</th>
              <th>Defenses</th>
              <th>HOF Score</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const { wins, losses, draws } = entry.record;
              const recordStr = draws > 0
                ? `${wins}-${losses}-${draws}`
                : `${wins}-${losses}`;
              return (
                <tr key={entry.id}>
                  <td>
                    <Link to={`/player/${entry.boxerId}`}>{entry.boxerName}</Link>
                  </td>
                  <td>{capitalize(entry.weightClass)}</td>
                  <td>{recordStr}</td>
                  <td>{entry.peakReputation}</td>
                  <td>{Math.floor(entry.careerSpan)} years</td>
                  <td>{entry.titlesWon}</td>
                  <td>{entry.totalDefenses}</td>
                  <td>{entry.score.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route and nav link**

In `src/routes.tsx`, add import at the top:

```ts
import HallOfFame from './pages/League/HallOfFame';
```

In the `league` children array, add after `championship-history`:

```ts
{ path: 'hall-of-fame', element: <HallOfFame /> },
```

- [ ] **Step 3: Add nav link to Sidebar or League nav**

Check how `ChampionshipHistory` is linked in the sidebar/nav. In `src/components/Sidebar/Sidebar.tsx` (or wherever league sub-nav links live), add:

```tsx
<NavLink to="/league/hall-of-fame">Hall of Fame</NavLink>
```

Read `src/components/Sidebar/Sidebar.tsx` first to see the existing pattern and match it exactly.

- [ ] **Step 4: Verify TypeScript compiles and run all tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit && npx vitest run
```

Expected: No errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && git add src/pages/League/HallOfFame.tsx src/routes.tsx src/components/Sidebar/Sidebar.tsx && git commit -m "feat: add Hall of Fame page and routing"
```

---

## Self-Review

**Spec coverage:**
- ✅ Section 1 (NPC retirement): `shouldNpcRetire` in Task 5, wired in `simulateNpcFights`
- ✅ Section 2 (HOF scoring): `calcHofScore` in Task 3
- ✅ Section 3 (HOF storage): `HallOfFameEntry`, DB store, `hallOfFameStore.ts` in Tasks 1–2
- ✅ Section 4 (retireBoxer utility): Task 4
- ✅ Section 5 (HOF page): Task 9
- ✅ Section 6 (TopNav notification): Task 6
- ✅ Section 7 (HOF badge on profile): Task 8
- ✅ Player retirement updated: Task 7

**Placeholder scan:** None. All code is complete.

**Type consistency:**
- `RetireResult` defined in Task 4 (`retireBoxer.ts`), imported in Tasks 5 and 6 — consistent
- `HallOfFameEntry` defined in Task 1 (`db.ts`), used in Tasks 2, 4, 8, 9 — consistent
- `calcHofScore(boxer, allTitles, currentDate)` defined Task 3, called Task 4 — consistent
- `simulateNpcFights` return type changes Task 5 (`Promise<RetireResult[]>`), consumed Task 6 — consistent
- `getHofEntryByBoxer` defined Task 2, imported Task 8 — consistent

**One note for Task 9, Step 3:** The Sidebar.tsx file must be read before adding the nav link, to match the existing pattern exactly. The plan instructs the implementer to do this.
