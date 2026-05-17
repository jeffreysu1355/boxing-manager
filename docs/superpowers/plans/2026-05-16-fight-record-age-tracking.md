# Fight Record Age Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store each boxer's age and their opponent's age at fight time in `FightRecord`, and display both as columns in the Player page fight record table.

**Architecture:** Add two optional string fields to `FightRecord` (`ageAtFight`, `opponentAgeAtFight`). A new pure utility `calcAgeAtDate` computes "Xy Ym" from two ISO dates. All three fight-record construction sites (player fights ×2 in `FightPage.tsx`, NPC fights in `fightSim.ts`) call this utility and populate both fields. The Player page table gains two columns.

**Tech Stack:** TypeScript, React 18, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/lib/ageCalc.ts` | **Create** — pure `calcAgeAtDate` utility |
| `src/lib/ageCalc.test.ts` | **Create** — unit tests for `calcAgeAtDate` |
| `src/db/db.ts` | **Modify** — add `ageAtFight?` and `opponentAgeAtFight?` to `FightRecord` |
| `src/lib/fightSim.ts` | **Modify** — populate both age fields when building `winnerRecord`/`loserRecord` |
| `src/lib/fightSim.test.ts` | **Modify** — assert age fields are present on simulated fight records |
| `src/pages/Fight/FightPage.tsx` | **Modify** — populate both age fields at both record-construction sites (~line 190, ~line 287) |
| `src/pages/Player/PlayerPage.tsx` | **Modify** — add "Age" and "Opp. Age" columns to fight record table |

---

### Task 1: Create `calcAgeAtDate` with tests

**Files:**
- Create: `src/lib/ageCalc.ts`
- Create: `src/lib/ageCalc.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/ageCalc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calcAgeAtDate } from './ageCalc';

describe('calcAgeAtDate', () => {
  it('returns — when birthDate is undefined', () => {
    expect(calcAgeAtDate(undefined, '2026-05-16')).toBe('—');
  });

  it('returns correct years and months on exact birthday', () => {
    expect(calcAgeAtDate('1999-05-16', '2026-05-16')).toBe('27y 0m');
  });

  it('returns correct years and months mid-year', () => {
    // Born Jan 15 1999, fight date Aug 20 2026 → 27 years, 7 months
    expect(calcAgeAtDate('1999-01-15', '2026-08-20')).toBe('27y 7m');
  });

  it('does not count a month that has not yet started', () => {
    // Born Aug 20 1999, fight date Aug 19 2026 → 26 years, 11 months
    expect(calcAgeAtDate('1999-08-20', '2026-08-19')).toBe('26y 11m');
  });

  it('handles birthday month crossing year boundary', () => {
    // Born Nov 10 1999, fight date Feb 5 2026 → 26 years, 2 months
    expect(calcAgeAtDate('1999-11-10', '2026-02-05')).toBe('26y 2m');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/ageCalc.test.ts
```

Expected: FAIL — "Cannot find module './ageCalc'"

- [ ] **Step 3: Implement `calcAgeAtDate`**

Create `src/lib/ageCalc.ts`:

```ts
export function calcAgeAtDate(birthDate: string | undefined, fightDate: string): string {
  if (!birthDate) return '—';

  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [fy, fm, fd] = fightDate.split('-').map(Number);

  let years = fy - by;
  let months = fm - bm;

  if (fd < bd) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return `${years}y ${months}m`;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/ageCalc.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/ageCalc.ts src/lib/ageCalc.test.ts
git commit -m "feat: add calcAgeAtDate utility"
```

---

### Task 2: Add age fields to `FightRecord`

**Files:**
- Modify: `src/db/db.ts:86-97`

- [ ] **Step 1: Add the two optional fields to the interface**

In `src/db/db.ts`, update the `FightRecord` interface (currently ends at line 97):

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
  isTitleFight?: boolean;
  ageAtFight?: string;
  opponentAgeAtFight?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors (fields are optional — existing call sites are unaffected).

- [ ] **Step 3: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: add ageAtFight and opponentAgeAtFight to FightRecord"
```

---

### Task 3: Populate age fields in `fightSim.ts` (NPC fights)

**Files:**
- Modify: `src/lib/fightSim.ts:372-396`
- Modify: `src/lib/fightSim.test.ts`

`fightSim.ts` receives `winner: Boxer` and `loser: Boxer` — both have `birthDate?: string` — and `fight: Fight` with `fight.date: string`. The records are built at lines 372 and 385.

- [ ] **Step 1: Write a failing test asserting age fields are populated**

In `src/lib/fightSim.test.ts`, add to the existing `simulateFight` describe block (or add a new one after it):

```ts
describe('simulateFight age fields', () => {
  it('populates ageAtFight and opponentAgeAtFight when birthDates are present', () => {
    const boxer1 = makeFullBoxer(1, { birthDate: '1999-01-15' });
    const boxer2 = makeFullBoxer(2, { birthDate: '2000-06-20' });
    const fight = makeFight({ date: '2026-05-16' });

    const result = simulateFight(boxer1, boxer2, fight, 'Test Federation');

    // winner gets own age + opponent's age; loser gets own age + opponent's age
    const winner = result.winnerId === 1 ? boxer1 : boxer2;
    const loser  = result.loserId  === 1 ? boxer1 : boxer2;

    expect(result.winnerRecord.ageAtFight).toBe(
      winner.birthDate === '1999-01-15' ? '27y 4m' : '25y 10m'
    );
    expect(result.winnerRecord.opponentAgeAtFight).toBe(
      loser.birthDate === '1999-01-15' ? '27y 4m' : '25y 10m'
    );
    expect(result.loserRecord.ageAtFight).toBe(
      loser.birthDate === '1999-01-15' ? '27y 4m' : '25y 10m'
    );
    expect(result.loserRecord.opponentAgeAtFight).toBe(
      winner.birthDate === '1999-01-15' ? '27y 4m' : '25y 10m'
    );
  });

  it('returns — for age fields when birthDate is absent', () => {
    const boxer1 = makeFullBoxer(1); // no birthDate
    const boxer2 = makeFullBoxer(2); // no birthDate
    const fight = makeFight({ date: '2026-05-16' });

    const result = simulateFight(boxer1, boxer2, fight, 'Test Federation');

    expect(result.winnerRecord.ageAtFight).toBe('—');
    expect(result.winnerRecord.opponentAgeAtFight).toBe('—');
    expect(result.loserRecord.ageAtFight).toBe('—');
    expect(result.loserRecord.opponentAgeAtFight).toBe('—');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/lib/fightSim.test.ts
```

Expected: FAIL — age fields are `undefined`, not the expected strings.

- [ ] **Step 3: Import `calcAgeAtDate` and populate fields in `fightSim.ts`**

At the top of `src/lib/fightSim.ts`, add the import:

```ts
import { calcAgeAtDate } from './ageCalc';
```

Then update the `winnerRecord` and `loserRecord` objects (lines ~372 and ~385):

```ts
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
  isTitleFight: fight.isTitleFight,
  ageAtFight: calcAgeAtDate(winner.birthDate, fight.date),
  opponentAgeAtFight: calcAgeAtDate(loser.birthDate, fight.date),
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
  isTitleFight: fight.isTitleFight,
  ageAtFight: calcAgeAtDate(loser.birthDate, fight.date),
  opponentAgeAtFight: calcAgeAtDate(winner.birthDate, fight.date),
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/fightSim.test.ts
```

Expected: PASS — all tests including the new age ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fightSim.ts src/lib/fightSim.test.ts
git commit -m "feat: populate age fields in NPC fight records"
```

---

### Task 4: Populate age fields in `FightPage.tsx` (player fights)

**Files:**
- Modify: `src/pages/Fight/FightPage.tsx`

There are two record-construction sites in this file — one around line 190 (fight resolves during simulation playback) and one around line 287 (fight resolves when skipping to result). Both already have `winner`, `loser`, and `f.date` in scope.

- [ ] **Step 1: Import `calcAgeAtDate`**

At the top of `src/pages/Fight/FightPage.tsx`, add:

```ts
import { calcAgeAtDate } from '../../lib/ageCalc';
```

- [ ] **Step 2: Add age fields to both record-construction sites**

Find the first `winnerRecord` object (~line 190) and add the two age fields:

```ts
const winnerRecord = {
  result: 'win' as const,
  opponentName: loser.name,
  opponentId: loser.id!,
  method,
  finishingMove,
  round: round!,
  time: time!,
  federation: fed?.name ?? '',
  date: f.date,
  isTitleFight: f.isTitleFight,
  ageAtFight: calcAgeAtDate(winner.birthDate, f.date),
  opponentAgeAtFight: calcAgeAtDate(loser.birthDate, f.date),
};
const loserRecord = {
  result: 'loss' as const,
  opponentName: winner.name,
  opponentId: winner.id!,
  method,
  finishingMove,
  round: round!,
  time: time!,
  federation: fed?.name ?? '',
  date: f.date,
  isTitleFight: f.isTitleFight,
  ageAtFight: calcAgeAtDate(loser.birthDate, f.date),
  opponentAgeAtFight: calcAgeAtDate(winner.birthDate, f.date),
};
```

Then find the second `winnerRecord` object (~line 287) and apply the same two-field additions:

```ts
const winnerRecord = {
  result: 'win' as const,
  opponentName: loser.name,
  opponentId: loser.id!,
  method,
  finishingMove,
  round: round!,
  time: time!,
  federation: fed?.name ?? '',
  date: f.date,
  isTitleFight: f.isTitleFight,
  ageAtFight: calcAgeAtDate(winner.birthDate, f.date),
  opponentAgeAtFight: calcAgeAtDate(loser.birthDate, f.date),
};
const loserRecord = {
  result: 'loss' as const,
  opponentName: winner.name,
  opponentId: winner.id!,
  method,
  finishingMove,
  round: round!,
  time: time!,
  federation: fed?.name ?? '',
  date: f.date,
  isTitleFight: f.isTitleFight,
  ageAtFight: calcAgeAtDate(loser.birthDate, f.date),
  opponentAgeAtFight: calcAgeAtDate(winner.birthDate, f.date),
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Fight/FightPage.tsx
git commit -m "feat: populate age fields in player fight records"
```

---

### Task 5: Display age columns in Player page fight record table

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx:343-388`

- [ ] **Step 1: Add the two column headers**

In `src/pages/Player/PlayerPage.tsx`, find the `<thead>` of the fight record table (~line 344) and add "Age" and "Opp. Age" after "Date":

```tsx
<thead>
  <tr>
    <th>Result</th>
    <th>Opponent</th>
    <th>Method</th>
    <th>Round</th>
    <th>Time</th>
    <th>Federation</th>
    <th>Date</th>
    <th>Age</th>
    <th>Opp. Age</th>
    <th></th>
  </tr>
</thead>
```

- [ ] **Step 2: Add the two data cells in each row**

In the `<tbody>` rows (~line 357), add the two cells after the date cell:

```tsx
<td>{formatFightDate(fight.date)}</td>
<td>{fight.ageAtFight ?? '—'}</td>
<td>{fight.opponentAgeAtFight ?? '—'}</td>
<td>
  {fight.isTitleFight && (
    <span className={styles.titleBadge}>Title Fight</span>
  )}
</td>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Player/PlayerPage.tsx
git commit -m "feat: display age and opponent age columns in fight record table"
```

---

## Self-Review

**Spec coverage:**
- ✅ `ageAtFight` and `opponentAgeAtFight` added to `FightRecord`
- ✅ `calcAgeAtDate` utility returns "Xy Ym" or "—"
- ✅ Player fights (both sites in `FightPage.tsx`) populated
- ✅ NPC fights (`fightSim.ts`) populated
- ✅ Display: two columns in Player page fight record table
- ✅ Existing records show "—" (optional fields, no migration needed)

**Placeholder scan:** None found.

**Type consistency:** `calcAgeAtDate` is defined in Task 1 and imported identically in Tasks 3 and 4. `ageAtFight` and `opponentAgeAtFight` are defined in Task 2 and used in Tasks 3, 4, and 5. All consistent.
