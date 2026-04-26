# World Gen Cross-Reference Fights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When world gen creates fight history for boxers in the same federation and weight class, fights between real boxers appear on both boxers' records with correct mirrored results and a link to the opponent's player page.

**Architecture:** Add `opponentId: number | null` to `FightRecord`. After all boxers in a federation are inserted during world gen, run a `crossReferenceFights` pass that replaces ~40% of fictional fights with real boxer matchups, writing mirrored entries on both boxers. `PlayerPage` uses `opponentId` directly instead of the existing fragile name-based lookup.

**Tech Stack:** TypeScript, React, IndexedDB via `idb`, Vitest for tests, `fake-indexeddb` for test isolation.

---

## File Map

- **Modify:** `src/db/db.ts` — add `opponentId: number | null` to `FightRecord`
- **Modify:** `src/db/worldGen.ts` — add `crossReferenceFights` function; call it after each federation's boxers are inserted; set `opponentId: null` in `generateFightRecord` and `generateAmateurRecord`
- **Modify:** `src/db/worldGen.test.ts` — add tests for `crossReferenceFights`
- **Modify:** `src/pages/Player/PlayerPage.tsx` — use `opponentId` directly; remove `opponentIndex` name-based lookup

---

## Task 1: Add `opponentId` to `FightRecord`

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add `opponentId` to the `FightRecord` interface**

In `src/db/db.ts`, find the `FightRecord` interface (around line 86) and add `opponentId`:

```ts
export interface FightRecord {
  result: 'win' | 'loss' | 'draw';
  opponentName: string;
  opponentId: number | null;
  method: string;
  finishingMove: string | null;
  round: number;
  time: string;
  federation: string;
  date: string;
}
```

- [ ] **Step 2: Run TypeScript build to find any type errors**

```bash
npm run build 2>&1 | head -40
```

Expected: errors only in `worldGen.ts` where `FightRecord` objects are constructed without `opponentId` (those get fixed in Task 2). No errors in other files — existing records without the field will return `undefined` from IndexedDB, which render code already handles.

- [ ] **Step 3: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: add opponentId to FightRecord interface"
```

---

## Task 2: Set `opponentId: null` in existing record generators

**Files:**
- Modify: `src/db/worldGen.ts`

- [ ] **Step 1: Add `opponentId: null` to `generateFightRecord`**

In `src/db/worldGen.ts`, find the `records.push({...})` call inside `generateFightRecord` (around line 180) and add `opponentId: null`:

```ts
records.push({
  result: isWin ? 'win' : 'loss',
  opponentName: generateName(federation),
  opponentId: null,
  method,
  finishingMove: isDecision ? null : pick(FINISH_MOVES[style]),
  round,
  time: isDecision ? '3:00' : time,
  federation,
  date: dateStr,
});
```

- [ ] **Step 2: Add `opponentId: null` to `generateAmateurRecord`**

In `src/db/worldGen.ts`, find the `records.push({...})` call inside `generateAmateurRecord` (around line 296) and add `opponentId: null`:

```ts
records.push({
  result: isWin ? 'win' : 'loss',
  opponentName: generateName('North America Boxing Federation'),
  opponentId: null,
  method,
  finishingMove: isDecision ? null : pick(FINISH_MOVES[style]),
  round,
  time: isDecision ? '3:00' : `${mins}:${secs}`,
  federation: 'Amateur',
  date: dateStr,
});
```

- [ ] **Step 3: Run build to confirm no type errors**

```bash
npm run build 2>&1 | head -20
```

Expected: clean build (no TypeScript errors).

- [ ] **Step 4: Run tests to confirm nothing broke**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/db/worldGen.ts
git commit -m "feat: set opponentId null in generateFightRecord and generateAmateurRecord"
```

---

## Task 3: Implement and test `crossReferenceFights`

**Files:**
- Modify: `src/db/worldGen.ts`
- Modify: `src/db/worldGen.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/db/worldGen.test.ts` (import `crossReferenceFights` and the stores needed):

```ts
import { crossReferenceFights } from './worldGen';
import { getAllBoxers, putBoxer } from './boxerStore';
import type { Boxer } from './db';

// Helper: minimal boxer
function makeBoxer(overrides: Partial<Omit<Boxer, 'id'>>): Omit<Boxer, 'id'> {
  return {
    name: 'Test Boxer',
    age: 25,
    weightClass: 'welterweight',
    style: 'slugger',
    reputation: 'Unknown',
    gymId: null,
    federationId: 1,
    stats: {
      jab: 5, cross: 5, leadHook: 5, rearHook: 5, uppercut: 5,
      headMovement: 5, bodyMovement: 5, guard: 5, positioning: 5,
      timing: 5, adaptability: 5, discipline: 5,
      speed: 5, power: 5, endurance: 5, recovery: 5, toughness: 5,
    },
    naturalTalents: [],
    injuries: [],
    titles: [],
    record: [],
    ...overrides,
  };
}

describe('crossReferenceFights', () => {
  it('adds a mirror fight on the opponent when a real match is made', async () => {
    // Insert two boxers with no fights yet
    const idA = await putBoxer(makeBoxer({ name: 'Boxer A', federationId: 1, weightClass: 'welterweight', record: [] }));
    const idB = await putBoxer(makeBoxer({ name: 'Boxer B', federationId: 1, weightClass: 'welterweight', record: [] }));

    // Give boxer A one fictional fight
    const boxers = await getAllBoxers();
    const boxerA = boxers.find(b => b.id === idA)!;
    boxerA.record = [{
      result: 'win',
      opponentName: 'Fictional Guy',
      opponentId: null,
      method: 'KO',
      finishingMove: 'Rear Hook',
      round: 3,
      time: '1:45',
      federation: 'North America Boxing Federation',
      date: 'January 1 2025',
    }];
    await putBoxer(boxerA);

    // Run cross-reference with 100% replacement probability for determinism
    await crossReferenceFights(1, [idA, idB], 1.0);

    const updated = await getAllBoxers();
    const a = updated.find(b => b.id === idA)!;
    const b = updated.find(b => b.id === idB)!;

    // Boxer A's fight should now reference boxer B
    expect(a.record[0].opponentId).toBe(idB);
    expect(a.record[0].opponentName).toBe('Boxer B');

    // Boxer B should have a mirrored fight
    expect(b.record).toHaveLength(1);
    expect(b.record[0].result).toBe('loss');
    expect(b.record[0].opponentId).toBe(idA);
    expect(b.record[0].opponentName).toBe('Boxer A');
    expect(b.record[0].method).toBe('KO');
    expect(b.record[0].round).toBe(3);
  });

  it('does not pair the same two boxers twice', async () => {
    const idA = await putBoxer(makeBoxer({ name: 'Boxer A', federationId: 1, weightClass: 'welterweight', record: [] }));
    const idB = await putBoxer(makeBoxer({ name: 'Boxer B', federationId: 1, weightClass: 'welterweight', record: [] }));

    // Give boxer A two fictional fights
    const boxers = await getAllBoxers();
    const boxerA = boxers.find(b => b.id === idA)!;
    const fight = {
      result: 'win' as const,
      opponentName: 'Fictional',
      opponentId: null,
      method: 'Decision',
      finishingMove: null,
      round: 12,
      time: '3:00',
      federation: 'North America Boxing Federation',
      date: 'February 1 2025',
    };
    boxerA.record = [fight, { ...fight, date: 'March 1 2025' }];
    await putBoxer(boxerA);

    await crossReferenceFights(1, [idA, idB], 1.0);

    const updated = await getAllBoxers();
    const b = updated.find(b => b.id === idB)!;

    // Boxer B should only appear once on boxer A's record
    const pairedCount = updated.find(b => b.id === idA)!.record.filter(r => r.opponentId === idB).length;
    expect(pairedCount).toBe(1);
    // Boxer B gets exactly one mirror fight
    expect(b.record).toHaveLength(1);
  });

  it('skips fights with no eligible opponent', async () => {
    // Only one boxer in federation — no one to pair with
    const idA = await putBoxer(makeBoxer({ name: 'Boxer A', federationId: 1, weightClass: 'welterweight', record: [] }));
    const boxers = await getAllBoxers();
    const boxerA = boxers.find(b => b.id === idA)!;
    boxerA.record = [{
      result: 'win',
      opponentName: 'Fictional',
      opponentId: null,
      method: 'KO',
      finishingMove: 'Jab',
      round: 1,
      time: '0:30',
      federation: 'North America Boxing Federation',
      date: 'January 1 2025',
    }];
    await putBoxer(boxerA);

    await crossReferenceFights(1, [idA], 1.0);

    const updated = await getAllBoxers();
    const a = updated.find(b => b.id === idA)!;
    // Fight unchanged — still fictional
    expect(a.record[0].opponentId).toBeNull();
  });

  it('mirrors draw results correctly', async () => {
    const idA = await putBoxer(makeBoxer({ name: 'Boxer A', federationId: 1, weightClass: 'welterweight', record: [] }));
    const idB = await putBoxer(makeBoxer({ name: 'Boxer B', federationId: 1, weightClass: 'welterweight', record: [] }));

    const boxers = await getAllBoxers();
    const boxerA = boxers.find(b => b.id === idA)!;
    boxerA.record = [{
      result: 'draw',
      opponentName: 'Fictional',
      opponentId: null,
      method: 'Draw',
      finishingMove: null,
      round: 12,
      time: '3:00',
      federation: 'North America Boxing Federation',
      date: 'April 1 2025',
    }];
    await putBoxer(boxerA);

    await crossReferenceFights(1, [idA, idB], 1.0);

    const updated = await getAllBoxers();
    const b = updated.find(b => b.id === idB)!;
    expect(b.record[0].result).toBe('draw');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- worldGen
```

Expected: FAIL with "crossReferenceFights is not exported from './worldGen'"

- [ ] **Step 3: Implement `crossReferenceFights` in `worldGen.ts`**

Add this function before `generateWorld` in `src/db/worldGen.ts`. It also needs `getBoxer` imported — check the existing import at line 2 (`import { getBoxer, putBoxer } from './boxerStore';`) which is already there.

```ts
export async function crossReferenceFights(
  federationId: number,
  boxerIds: number[],
  probability = 0.4,
): Promise<void> {
  // Fetch all boxers in this federation pass
  const boxers = await Promise.all(boxerIds.map(id => getBoxer(id)));
  const realBoxers = boxers.filter((b): b is Boxer => b !== undefined);

  // Track which pairs have already been linked: "minId-maxId"
  const paired = new Set<string>();

  for (const boxerA of realBoxers) {
    if (boxerA.id === undefined) continue;
    let aModified = false;

    for (let i = 0; i < boxerA.record.length; i++) {
      const fight = boxerA.record[i];
      if (fight.opponentId !== null) continue;          // already linked
      if (Math.random() >= probability) continue;       // skip by chance

      // Eligible opponents: same federation, same weight class, not self, not already paired
      const eligible = realBoxers.filter(b => {
        if (b.id === undefined || b.id === boxerA.id) return false;
        if (b.federationId !== federationId) return false;
        if (b.weightClass !== boxerA.weightClass) return false;
        const key = [Math.min(boxerA.id!, b.id), Math.max(boxerA.id!, b.id)].join('-');
        return !paired.has(key);
      });

      if (eligible.length === 0) continue;

      const boxerB = eligible[Math.floor(Math.random() * eligible.length)];
      const pairKey = [Math.min(boxerA.id!, boxerB.id!), Math.max(boxerA.id!, boxerB.id!)].join('-');
      paired.add(pairKey);

      // Update boxer A's fight entry
      boxerA.record[i] = {
        ...fight,
        opponentName: boxerB.name,
        opponentId: boxerB.id!,
      };
      aModified = true;

      // Mirror result: win <-> loss, draw stays draw
      const mirrorResult: FightRecord['result'] =
        fight.result === 'win' ? 'loss' :
        fight.result === 'loss' ? 'win' :
        'draw';

      // Push mirror entry onto boxer B
      boxerB.record.push({
        ...fight,
        result: mirrorResult,
        opponentName: boxerA.name,
        opponentId: boxerA.id!,
      });
      await putBoxer(boxerB);
    }

    if (aModified) await putBoxer(boxerA);
  }
}
```

Also add `FightRecord` to the import from `./db` at the top of `worldGen.ts` if it isn't already there (check current imports — `FightRecord` is already imported on line 15).

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- worldGen
```

Expected: all tests in `worldGen.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add src/db/worldGen.ts src/db/worldGen.test.ts
git commit -m "feat: implement crossReferenceFights for world gen boxer history"
```

---

## Task 4: Call `crossReferenceFights` in `generateWorld`

**Files:**
- Modify: `src/db/worldGen.ts`

- [ ] **Step 1: Call `crossReferenceFights` after each federation's boxers are inserted**

In `generateWorld`, find the end of the per-federation loop (after the `// 4. Update champion's boxer record with title` block, before the closing `}`). Add the call:

```ts
    // 5. Cross-reference fights between real boxers in this federation
    await crossReferenceFights(fedId, boxerIds);
```

The full per-federation loop ending should look like:

```ts
    // 4. Update champion's boxer record with title
    if (championId !== null) {
      const champ = await getBoxer(championId);
      if (champ) {
        champ.titles.push({ titleId, dateWon: '2025-01-15', dateLost: null });
        await putBoxer(champ);
      }
    }

    // 5. Cross-reference fights between real boxers in this federation
    await crossReferenceFights(fedId, boxerIds);
  }
```

- [ ] **Step 2: Run build to confirm no type errors**

```bash
npm run build 2>&1 | head -20
```

Expected: clean build.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/db/worldGen.ts
git commit -m "feat: call crossReferenceFights after each federation is generated"
```

---

## Task 5: Use `opponentId` directly in `PlayerPage.tsx`

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`

- [ ] **Step 1: Remove the `opponentIndex` name-based lookup and use `opponentId` directly**

The current code (lines 73, 82–85, 204–206) builds a `Map<string, number>` by boxer name to link opponents. Replace this with direct `opponentId` usage.

Remove the `opponentIndex` state and the `getAllBoxers` call. The updated `useEffect` and fight record render should be:

```ts
// Remove this state:
// const [opponentIndex, setOpponentIndex] = useState<Map<string, number>>(new Map());

// Replace the useEffect with:
useEffect(() => {
  if (!id) { setBoxer(null); setCoach(null); return; }
  let cancelled = false;
  Promise.all([getBoxer(Number(id)), getAllCoaches()]).then(([b, coaches]) => {
    if (cancelled) return;
    setBoxer(b ?? null);
    const assignedCoach = coaches.find(c => c.assignedBoxerId === Number(id)) ?? null;
    setCoach(assignedCoach);
  });
  return () => { cancelled = true; };
}, [id]);
```

And update the opponent cell in the fight record table:

```tsx
<td>
  {fight.opponentId != null
    ? <Link to={`/player/${fight.opponentId}`}>{fight.opponentName}</Link>
    : fight.opponentName}
</td>
```

Also remove `getAllBoxers` from the import since it's no longer used:

```ts
import { getBoxer } from '../../db/boxerStore';
```

- [ ] **Step 2: Run build to confirm no type errors**

```bash
npm run build 2>&1 | head -20
```

Expected: clean build.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Player/PlayerPage.tsx
git commit -m "feat: use opponentId for opponent links in PlayerPage fight record"
```
