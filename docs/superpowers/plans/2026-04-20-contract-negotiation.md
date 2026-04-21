# Contract Negotiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a contract negotiation flow between fight scheduling and fight creation, where the player offers a guaranteed payout and PPV split and an opponent AI counter-offers/accepts/rejects probabilistically.

**Architecture:** Schedule page creates a `pending` FightContract and navigates to `/league/contracts/:id`. The negotiation page (up to 3 rounds) handles the AI response and, on acceptance, creates the Fight and CalendarEvents. Unsigned contracts are deleted on cancel, reject, or round exhaustion.

**Tech Stack:** React 18, TypeScript, Vite, IndexedDB via `idb`, Vitest for unit tests, CSS Modules.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/db/db.ts` | Modify | Add `counterOfferPpvSplit`, `roundsUsed` to `FightContract`; schema v5→v6 |
| `src/pages/League/ContractNegotiation.tsx` | Create | Negotiation page + `evaluateOffer` + `snapToIncrement` + `snapTo5` |
| `src/pages/League/ContractNegotiation.module.css` | Create | Scoped styles for negotiation page |
| `src/pages/League/ContractNegotiation.test.ts` | Create | Unit tests for `evaluateOffer`, `snapToIncrement`, `snapTo5` |
| `src/pages/League/Schedule.tsx` | Modify | Strip `handleConfirm` to contract-create + navigate; fix `bookedBoxerIds` |
| `src/routes.tsx` | Modify | Add `/league/contracts/:id` route |

---

### Task 1: Update `FightContract` type and DB schema

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add two fields to `FightContract` interface**

In `src/db/db.ts`, find the `FightContract` interface and add the two new fields after `counterOfferPayout`:

```typescript
export interface FightContract {
  id?: number;
  boxerId: number;
  opponentId: number;
  federationId: number;
  weightClass: WeightClass;
  guaranteedPayout: number;
  ppvSplitPercentage: number;
  ppvNetworkId: number | null;
  isTitleFight: boolean;
  status: ContractStatus;
  counterOfferPayout: number | null;
  counterOfferPpvSplit: number | null;  // opponent's counter PPV split; null = not changed
  roundsUsed: number;                   // 0..3, incremented each time player submits
  scheduledDate: string | null;
  fightId: number | null;
}
```

- [ ] **Step 2: Bump DB version and add migration block**

In `src/db/db.ts`, change the `openDB` version from `5` to `6`:

```typescript
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 6, {
```

Then add a new migration block at the end of the `upgrade` function (after the `oldVersion < 5` block):

```typescript
      if (oldVersion < 6) {
        // counterOfferPpvSplit and roundsUsed added to fightContracts
        // idb returns undefined for missing fields on existing records;
        // runtime code treats undefined as null / 0 respectively
      }
```

(No structural changes needed — idb handles missing fields gracefully on existing records.)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors. If you see errors about `counterOfferPpvSplit` or `roundsUsed` missing on existing call sites, you will fix those in Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: add counterOfferPpvSplit and roundsUsed to FightContract; bump DB to v6"
```

---

### Task 2: Write failing tests for AI pure functions

**Files:**
- Create: `src/pages/League/ContractNegotiation.test.ts`

The functions under test (`evaluateOffer`, `snapToIncrement`, `snapTo5`) don't exist yet — these tests will fail until Task 3.

- [ ] **Step 1: Create the test file**

Create `src/pages/League/ContractNegotiation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { evaluateOffer, snapToIncrement, snapTo5 } from './ContractNegotiation';

// --- snapToIncrement ---

describe('snapToIncrement', () => {
  it('snaps $500 up to $1,000', () => {
    expect(snapToIncrement(500)).toBe(1000);
  });

  it('keeps exact $1,000', () => {
    expect(snapToIncrement(1000)).toBe(1000);
  });

  it('snaps $5,500 up to $6,000', () => {
    expect(snapToIncrement(5500)).toBe(6000);
  });

  it('snaps $10,001 up to $20,000', () => {
    expect(snapToIncrement(10001)).toBe(20000);
  });

  it('keeps exact $50,000', () => {
    expect(snapToIncrement(50000)).toBe(50000);
  });

  it('snaps $100,001 up to $200,000', () => {
    expect(snapToIncrement(100001)).toBe(200000);
  });

  it('keeps exact $500,000', () => {
    expect(snapToIncrement(500000)).toBe(500000);
  });

  it('caps at $1,000,000', () => {
    expect(snapToIncrement(1100000)).toBe(1000000);
  });
});

// --- snapTo5 ---

describe('snapTo5', () => {
  it('snaps 3 up to 5', () => {
    expect(snapTo5(3)).toBe(5);
  });

  it('keeps exact 50', () => {
    expect(snapTo5(50)).toBe(50);
  });

  it('snaps 51 up to 55', () => {
    expect(snapTo5(51)).toBe(55);
  });

  it('clamps 0 to 0', () => {
    expect(snapTo5(0)).toBe(0);
  });

  it('clamps 98 up to 100', () => {
    expect(snapTo5(98)).toBe(100);
  });

  it('clamps 105 to 100', () => {
    expect(snapTo5(105)).toBe(100);
  });
});

// --- evaluateOffer ---

describe('evaluateOffer', () => {
  // repGap = 0, fairPayout = 10_000 * (0.5 + (0+9)/18*2.5) = 10_000 * (0.5+1.25) = 17_500
  // fairPpvSplit = clamp(50 + 0*3, 10, 90) = 50
  // offerScore = (payout/17500) + (ppvSplit/50)

  it('accepts a very generous offer (offerScore >= 1.8)', () => {
    // payout=20000, split=70 => 20000/17500 + 70/50 = 1.143 + 1.4 = 2.543
    const result = evaluateOffer({
      playerPayout: 20000,
      playerPpvSplit: 70,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.99,
    });
    expect(result.outcome).toBe('accept');
  });

  it('always accepts when offerScore >= 1.8, regardless of random', () => {
    const result = evaluateOffer({
      playerPayout: 20000,
      playerPpvSplit: 70,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('accept');
  });

  it('accepts an 80% chance offer when random < 0.8 (offerScore 1.2–1.8)', () => {
    // payout=14000, split=50 => 14000/17500 + 50/50 = 0.8 + 1.0 = 1.8 -- that's 100% accept threshold
    // Use payout=12000, split=50 => 12000/17500 + 1.0 = 0.686 + 1.0 = 1.686 (in 1.2–1.8 band)
    const result = evaluateOffer({
      playerPayout: 12000,
      playerPpvSplit: 50,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5, // < 0.8, so accept
    });
    expect(result.outcome).toBe('accept');
  });

  it('counters an 80% chance offer when random >= 0.8 (offerScore 1.2–1.8)', () => {
    const result = evaluateOffer({
      playerPayout: 12000,
      playerPpvSplit: 50,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.85,
    });
    expect(result.outcome).toBe('counter');
  });

  it('counters a moderate offer (offerScore 0.8–1.2) when random < 0.9', () => {
    // payout=8000, split=40 => 8000/17500 + 40/50 = 0.457 + 0.8 = 1.257 -- that's 1.2 band, use lower values
    // payout=6000, split=35 => 6000/17500 + 35/50 = 0.343 + 0.7 = 1.043 (in 0.8–1.2 band)
    const result = evaluateOffer({
      playerPayout: 6000,
      playerPpvSplit: 35,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('counter');
  });

  it('rejects a moderate offer when random >= 0.9 (offerScore 0.8–1.2)', () => {
    const result = evaluateOffer({
      playerPayout: 6000,
      playerPpvSplit: 35,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.95,
    });
    expect(result.outcome).toBe('reject');
  });

  it('rejects a very low offer (offerScore < 0.8) when random >= 0.3', () => {
    // payout=1000, split=10 => 1000/17500 + 10/50 = 0.057 + 0.2 = 0.257
    const result = evaluateOffer({
      playerPayout: 1000,
      playerPpvSplit: 10,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('reject');
  });

  it('can counter a very low offer when random < 0.3', () => {
    const result = evaluateOffer({
      playerPayout: 1000,
      playerPpvSplit: 10,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.1,
    });
    expect(result.outcome).toBe('counter');
  });

  it('round 3 modifier increases reject probability — counters a 0.8–1.2 band offer', () => {
    // With roundsUsed=2, reject goes from 10% to 30%. random=0.75 should now reject (>= 0.70 threshold in round 3)
    // Band 0.8–1.2: base counter=90%, reject=10%. Round 3: reject=30%, counter=70%.
    // random=0.75 >= 0.70 (counter threshold) so rejects
    const result = evaluateOffer({
      playerPayout: 6000,
      playerPpvSplit: 35,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 2,
      random: 0.75,
    });
    expect(result.outcome).toBe('reject');
  });

  it('counter includes payout adjustment when playerPayout < fairPayout', () => {
    // fairPayout=17500, offer payout=6000 → midpoint = 6000 + (17500-6000)/2 = 11750 → snap up
    const result = evaluateOffer({
      playerPayout: 6000,
      playerPpvSplit: 50,  // at fair ppv, no ppv counter
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5, // counters
    });
    expect(result.outcome).toBe('counter');
    if (result.outcome === 'counter') {
      expect(result.payout).not.toBeNull();
      expect(result.payout).toBeGreaterThan(6000);
      expect(result.ppvSplit).toBeNull(); // at fair value, no PPV adjustment
    }
  });

  it('counter includes ppvSplit adjustment when playerPpvSplit < fairPpvSplit', () => {
    // fairPpvSplit=50, offer split=30 → midpoint = 30 + (50-30)/2 = 40 → snap to 40
    const result = evaluateOffer({
      playerPayout: 17500, // at fair payout, no payout counter
      playerPpvSplit: 30,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.85, // forces counter (score near 1.8 but ppv lowers it)
    });
    // payout/17500 + 30/50 = 1.0 + 0.6 = 1.6 (80/20 band), random=0.85 → counter
    expect(result.outcome).toBe('counter');
    if (result.outcome === 'counter') {
      expect(result.ppvSplit).not.toBeNull();
      expect(result.ppvSplit).toBeGreaterThan(30);
      expect(result.payout).toBeNull(); // at fair payout, no payout adjustment
    }
  });

  it('handles negative rep gap (gym boxer more famous)', () => {
    // gymRepIndex=8, oppRepIndex=2 → repGap=-6
    // fairPayout = 10000 * (0.5 + (-6+9)/18*2.5) = 10000*(0.5+0.4167) = 9167
    // fairPpvSplit = clamp(50 + (-6)*3, 10, 90) = clamp(32, 10, 90) = 32
    const result = evaluateOffer({
      playerPayout: 5000,
      playerPpvSplit: 20,
      gymBoxerRepIndex: 8,
      opponentRepIndex: 2,
      roundsUsed: 0,
      random: 0.99,
    });
    // score = 5000/9167 + 20/32 = 0.545 + 0.625 = 1.17 (0.8–1.2 band), random=0.99 → reject
    expect(result.outcome).toBe('reject');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail with import error**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/pages/League/ContractNegotiation.test.ts 2>&1 | head -20
```

Expected: error like `Cannot find module './ContractNegotiation'` or similar. (Not a test failure — an import error. That's correct — the module doesn't exist yet.)

---

### Task 3: Implement `evaluateOffer`, `snapToIncrement`, `snapTo5`

**Files:**
- Create: `src/pages/League/ContractNegotiation.tsx` (pure functions only, no React yet)

- [ ] **Step 1: Create `ContractNegotiation.tsx` with pure functions only**

Create `src/pages/League/ContractNegotiation.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { FightContract, Boxer, Federation, FederationEvent } from '../../db/db';
import { getFightContract, putFightContract, deleteFightContract } from '../../db/fightContractStore';
import { getBoxer } from '../../db/boxerStore';
import { getFederation } from '../../db/federationStore';
import { putFight } from '../../db/fightStore';
import { putCalendarEvent } from '../../db/calendarEventStore';
import { updateFederationEventFights, getFederationEventsByFederation } from '../../db/federationEventStore';
import styles from './ContractNegotiation.module.css';

// --- Types ---

export type AiDecision =
  | { outcome: 'accept' }
  | { outcome: 'counter'; payout: number | null; ppvSplit: number | null }
  | { outcome: 'reject' };

// --- Pure helpers ---

/**
 * Snaps n up to the nearest valid payout increment.
 * Valid increments: $1k–$10k by $1k, $10k–$100k by $10k, $100k–$1M by $100k.
 * Caps at $1,000,000.
 */
export function snapToIncrement(n: number): number {
  if (n <= 0) return 1000;
  if (n > 1_000_000) return 1_000_000;
  if (n <= 10_000) return Math.ceil(n / 1_000) * 1_000;
  if (n <= 100_000) return Math.ceil(n / 10_000) * 10_000;
  return Math.ceil(n / 100_000) * 100_000;
}

/**
 * Snaps n up to the nearest multiple of 5, clamped 0–100.
 */
export function snapTo5(n: number): number {
  const snapped = Math.ceil(n / 5) * 5;
  return Math.min(100, Math.max(0, snapped));
}

/**
 * Evaluates a player's contract offer and returns the AI's decision.
 */
export function evaluateOffer(params: {
  playerPayout: number;
  playerPpvSplit: number;
  gymBoxerRepIndex: number;
  opponentRepIndex: number;
  roundsUsed: number;
  random?: number;
}): AiDecision {
  const { playerPayout, playerPpvSplit, gymBoxerRepIndex, opponentRepIndex, roundsUsed } = params;
  const rand = params.random ?? Math.random();

  const repGap = opponentRepIndex - gymBoxerRepIndex; // -9..+9
  const fairPayout = 10_000 * (0.5 + ((repGap + 9) / 18) * 2.5);
  const fairPpvSplit = Math.min(90, Math.max(10, 50 + repGap * 3));

  const offerScore = (playerPayout / fairPayout) + (playerPpvSplit / fairPpvSplit);

  // Base probabilities per band
  let pAccept: number;
  let pCounter: number;
  // pReject = 1 - pAccept - pCounter

  if (offerScore >= 1.8) {
    pAccept = 1.0; pCounter = 0;
  } else if (offerScore >= 1.2) {
    pAccept = 0.8; pCounter = 0.2;
  } else if (offerScore >= 0.8) {
    pAccept = 0; pCounter = 0.9;
  } else {
    pAccept = 0; pCounter = 0.3;
  }

  // Round 3 modifier: +20% to reject, proportionally reduce others
  if (roundsUsed === 2) {
    const pReject = 1 - pAccept - pCounter;
    const extraReject = Math.min(0.2, pAccept + pCounter); // can't exceed what's available
    const scale = (pAccept + pCounter) > 0 ? (pAccept + pCounter - extraReject) / (pAccept + pCounter) : 0;
    pAccept = pAccept * scale;
    pCounter = pCounter * scale;
    void pReject; // pReject implicitly = 1 - pAccept - pCounter now
  }

  // Determine outcome
  let outcome: 'accept' | 'counter' | 'reject';
  if (rand < pAccept) {
    outcome = 'accept';
  } else if (rand < pAccept + pCounter) {
    outcome = 'counter';
  } else {
    outcome = 'reject';
  }

  if (outcome === 'accept') return { outcome: 'accept' };
  if (outcome === 'reject') return { outcome: 'reject' };

  // Counter: adjust fields below fair value toward midpoint
  const counterPayout = playerPayout < fairPayout
    ? snapToIncrement(playerPayout + (fairPayout - playerPayout) / 2)
    : null;
  const counterPpvSplit = playerPpvSplit < fairPpvSplit
    ? snapTo5(playerPpvSplit + (fairPpvSplit - playerPpvSplit) / 2)
    : null;

  return { outcome: 'counter', payout: counterPayout, ppvSplit: counterPpvSplit };
}

// --- Payout options ---

export function buildPayoutOptions(): number[] {
  const options: number[] = [];
  for (let v = 1_000; v <= 10_000; v += 1_000) options.push(v);
  for (let v = 20_000; v <= 100_000; v += 10_000) options.push(v);
  for (let v = 200_000; v <= 1_000_000; v += 100_000) options.push(v);
  return options;
}

// --- Component placeholder (filled in Task 5) ---

export default function ContractNegotiation() {
  return <div>Contract Negotiation — coming soon</div>;
}
```

- [ ] **Step 2: Create the CSS module (empty for now)**

Create `src/pages/League/ContractNegotiation.module.css`:

```css
/* Styles added in Task 6 */
```

- [ ] **Step 3: Run failing tests — they should now pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/pages/League/ContractNegotiation.test.ts 2>&1
```

Expected: all tests pass. If any fail, fix the implementation before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/pages/League/ContractNegotiation.tsx src/pages/League/ContractNegotiation.module.css src/pages/League/ContractNegotiation.test.ts
git commit -m "feat: add evaluateOffer, snapToIncrement, snapTo5 with tests"
```

---

### Task 4: Update `Schedule.tsx` — strip `handleConfirm` and fix `bookedBoxerIds`

**Files:**
- Modify: `src/pages/League/Schedule.tsx`

- [ ] **Step 1: Remove fight/calendar/federation writes from `handleConfirm`**

Replace the entire `handleConfirm` function in `src/pages/League/Schedule.tsx` with this lean version:

```typescript
async function handleConfirm() {
  if (!canConfirm || !selectedGymBoxer || !selectedEvent || !selectedOpponent) return;
  if (selectedGymBoxer.id === undefined) return;
  if (selectedOpponent.id === undefined) return;

  const gymBoxerId = selectedGymBoxer.id;
  const opponentId = selectedOpponent.id;

  setConfirming(true);
  try {
    const contractId = await putFightContract({
      boxerId: gymBoxerId,
      opponentId,
      federationId: selectedEvent.federationId,
      weightClass: selectedGymBoxer.weightClass,
      guaranteedPayout: 0,
      ppvSplitPercentage: 50,
      ppvNetworkId: null,
      isTitleFight,
      status: 'pending',
      counterOfferPayout: null,
      counterOfferPpvSplit: null,
      roundsUsed: 0,
      scheduledDate: selectedEvent.date,
      fightId: null,
    });
    navigate(`/league/contracts/${contractId}`);
  } finally {
    setConfirming(false);
  }
}
```

- [ ] **Step 2: Add `pending`/`countered` contract loading and fix `bookedBoxerIds`**

In the `load()` function inside `useEffect`, add contract fetching. Import `getFightContractsByStatus` at the top of the file (it's already exported from `fightContractStore.ts`):

At the top of `Schedule.tsx`, add the import:
```typescript
import { putFightContract, getFightContractsByStatus } from '../../db/fightContractStore';
```

Then inside `load()`, add the following after the `Promise.all` call (after the `if (cancelled) return;` check and the auto-generate events block, before `setData`):

```typescript
      // Also mark boxers with pending/countered contracts as booked
      const [pendingContracts, counteredContracts] = await Promise.all([
        getFightContractsByStatus('pending'),
        getFightContractsByStatus('countered'),
      ]);
      if (cancelled) return;
      const inFlightBoxerIds = new Set<number>();
      for (const c of [...pendingContracts, ...counteredContracts]) {
        inFlightBoxerIds.add(c.boxerId);
      }
```

Then find the `bookedBoxerIds` population block (after `setData`) and extend it to also include `inFlightBoxerIds`. The cleanest approach is to pass `inFlightBoxerIds` into `setData` by expanding the `ScheduleData` type. Add the field to `ScheduleData`:

```typescript
interface ScheduleData {
  gym: Awaited<ReturnType<typeof getGym>>;
  boxers: Boxer[];
  calendarEvents: CalendarEvent[];
  federationEvents: FederationEvent[];
  federations: Federation[];
  fights: Awaited<ReturnType<typeof getAllFights>>;
  titles: Title[];
  inFlightBoxerIds: Set<number>;
}
```

Pass `inFlightBoxerIds` in the `setData` call:

```typescript
setData({ gym, boxers, calendarEvents, federationEvents: updatedFederationEvents, federations, fights, titles, inFlightBoxerIds });
```

Then destructure it at the top of the render section:

```typescript
const { gym, boxers, calendarEvents, federationEvents, federations, fights, titles, inFlightBoxerIds } = data;
```

And in the `bookedBoxerIds` population loop, also add in-flight boxers:

```typescript
  for (const bid of inFlightBoxerIds) {
    bookedBoxerIds.add(bid);
  }
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/League/Schedule.tsx
git commit -m "feat: simplify Schedule handleConfirm to create pending contract; fix bookedBoxerIds for in-flight contracts"
```

---

### Task 5: Add `/league/contracts/:id` route

**Files:**
- Modify: `src/routes.tsx`

- [ ] **Step 1: Add the route import and route entry**

In `src/routes.tsx`, add the import:

```typescript
import ContractNegotiation from './pages/League/ContractNegotiation';
```

Then add the route inside the `league` children array, after the `schedule` route:

```typescript
{ path: 'contracts/:id', element: <ContractNegotiation /> },
```

The league children block will look like:

```typescript
      {
        path: 'league',
        element: <LeagueLayout />,
        children: [
          { index: true, element: <Navigate to="standings" replace /> },
          { path: 'standings', element: <Standings /> },
          { path: 'calendar', element: <Calendar /> },
          { path: 'schedule', element: <Schedule /> },
          { path: 'contracts/:id', element: <ContractNegotiation /> },
        ],
      },
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes.tsx
git commit -m "feat: add /league/contracts/:id route"
```

---

### Task 6: Implement `ContractNegotiation` page component and CSS

**Files:**
- Modify: `src/pages/League/ContractNegotiation.tsx`
- Modify: `src/pages/League/ContractNegotiation.module.css`

- [ ] **Step 1: Replace the placeholder component with the full implementation**

Replace the `ContractNegotiation` default export in `src/pages/League/ContractNegotiation.tsx` with:

```typescript
// --- Reputation index map (same as Schedule.tsx) ---

import type { ReputationLevel } from '../../db/db';

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

// --- Component ---

interface PageData {
  contract: FightContract;
  gymBoxer: Boxer;
  opponent: Boxer;
  federation: Federation | undefined;
}

export default function ContractNegotiation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<PageData | null>(null);
  const [offerPayout, setOfferPayout] = useState<number>(1_000);
  const [offerPpvSplit, setOfferPpvSplit] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const payoutOptions = buildPayoutOptions();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const contractId = id ? parseInt(id, 10) : NaN;
      if (isNaN(contractId)) {
        setLoadError('Invalid contract ID.');
        return;
      }
      const contract = await getFightContract(contractId);
      if (!contract || contract.status === 'accepted' || contract.status === 'completed') {
        if (!cancelled) navigate('/league/calendar', { replace: true });
        return;
      }
      const [gymBoxer, opponent, federation] = await Promise.all([
        getBoxer(contract.boxerId),
        getBoxer(contract.opponentId),
        contract.federationId != null ? getFederation(contract.federationId) : Promise.resolve(undefined),
      ]);
      if (cancelled) return;
      if (!gymBoxer || !opponent) {
        setLoadError('Boxer data not found.');
        return;
      }

      // Pre-fill form from counter offer (if countered) or defaults
      if (contract.status === 'countered') {
        setOfferPayout(contract.counterOfferPayout ?? contract.guaranteedPayout ?? 1_000);
        setOfferPpvSplit(contract.counterOfferPpvSplit ?? contract.ppvSplitPercentage ?? 50);
      }

      setData({ contract, gymBoxer, opponent, federation });
    }
    load();
    return () => { cancelled = true; };
  }, [id, navigate]);

  async function handleCancel() {
    if (!data?.contract?.id) { navigate('/league/schedule'); return; }
    await deleteFightContract(data.contract.id);
    navigate(`/league/schedule?boxerId=${data.contract.boxerId}`);
  }

  async function handleSubmit() {
    if (!data || submitting) return;
    const { contract, gymBoxer, opponent } = data;
    if (contract.id === undefined) return;

    setSubmitting(true);
    try {
      const newRoundsUsed = (contract.roundsUsed ?? 0) + 1;
      const decision = evaluateOffer({
        playerPayout: offerPayout,
        playerPpvSplit: offerPpvSplit,
        gymBoxerRepIndex: REPUTATION_INDEX[gymBoxer.reputation],
        opponentRepIndex: REPUTATION_INDEX[opponent.reputation],
        roundsUsed: newRoundsUsed - 1, // pass pre-increment value as spec says roundsUsed is 0..2
      });

      if (decision.outcome === 'accept') {
        // Create fight
        const fightId = await putFight({
          date: contract.scheduledDate!,
          federationId: contract.federationId,
          weightClass: contract.weightClass,
          boxerIds: [contract.boxerId, contract.opponentId],
          winnerId: null,
          method: 'Decision',
          finishingMove: null,
          round: null,
          time: null,
          isTitleFight: contract.isTitleFight,
          contractId: contract.id,
        });
        // Update contract
        await putFightContract({
          ...contract,
          status: 'accepted',
          guaranteedPayout: offerPayout,
          ppvSplitPercentage: offerPpvSplit,
          fightId,
          roundsUsed: newRoundsUsed,
        });
        // Calendar events
        await putCalendarEvent({ type: 'fight', date: contract.scheduledDate!, boxerIds: [contract.boxerId], fightId });
        await putCalendarEvent({ type: 'fight', date: contract.scheduledDate!, boxerIds: [contract.opponentId], fightId });
        // Federation event
        const fedEvents = await getFederationEventsByFederation(contract.federationId);
        const matchingEvent = fedEvents.find(e => e.date === contract.scheduledDate);
        if (matchingEvent?.id !== undefined) {
          await updateFederationEventFights(matchingEvent.id, fightId);
        }
        navigate('/league/calendar');

      } else if (decision.outcome === 'counter' && newRoundsUsed < 3) {
        // Store counter offer
        await putFightContract({
          ...contract,
          status: 'countered',
          roundsUsed: newRoundsUsed,
          counterOfferPayout: decision.payout,
          counterOfferPpvSplit: decision.ppvSplit,
        });
        // Pre-fill form with counter values
        setOfferPayout(decision.payout ?? offerPayout);
        setOfferPpvSplit(decision.ppvSplit ?? offerPpvSplit);
        // Update local state
        setData(prev => prev ? {
          ...prev,
          contract: {
            ...prev.contract,
            status: 'countered',
            roundsUsed: newRoundsUsed,
            counterOfferPayout: decision.payout,
            counterOfferPpvSplit: decision.ppvSplit,
          },
        } : prev);

      } else {
        // Reject or round exhaustion
        await deleteFightContract(contract.id);
        navigate(`/league/schedule?boxerId=${contract.boxerId}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <PageHeader title="Contract Negotiation" subtitle="" />
        <p className={styles.error}>{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <PageHeader title="Contract Negotiation" subtitle="" />
        <p className={styles.loading}>Loading...</p>
      </div>
    );
  }

  const { contract, gymBoxer, opponent, federation } = data;
  const roundsUsed = contract.roundsUsed ?? 0;
  const submitLabel = roundsUsed === 0 ? 'Submit Offer' : roundsUsed === 1 ? 'Counter' : 'Final Offer';

  const subtitle = [
    gymBoxer.name,
    'vs',
    opponent.name,
    federation ? `· ${federation.name}` : '',
    contract.scheduledDate ? `· ${contract.scheduledDate}` : '',
    `· ${contract.weightClass}`,
  ].filter(Boolean).join(' ');

  const counterPayoutDisplay = contract.counterOfferPayout ?? contract.guaranteedPayout;
  const counterPpvDisplay = contract.counterOfferPpvSplit ?? contract.ppvSplitPercentage;

  return (
    <div className={styles.page}>
      <PageHeader title="Contract Negotiation" subtitle={subtitle} />

      {contract.status === 'pending' && (
        <div className={styles.statusBox}>
          Make your opening offer.
        </div>
      )}
      {contract.status === 'countered' && (
        <div className={styles.statusBox}>
          <strong>Opponent counters:</strong> ${counterPayoutDisplay?.toLocaleString()} guaranteed / {counterPpvDisplay}% PPV split.{' '}
          Round {roundsUsed + 1} of 3.
        </div>
      )}

      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="payout">Guaranteed Payout</label>
          <select
            id="payout"
            value={offerPayout}
            onChange={e => setOfferPayout(Number(e.target.value))}
          >
            {payoutOptions.map(v => (
              <option key={v} value={v}>${v.toLocaleString()}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="ppvSplit">Your PPV Split %</label>
          <input
            id="ppvSplit"
            type="number"
            min={0}
            max={100}
            step={5}
            value={offerPpvSplit}
            onChange={e => setOfferPpvSplit(Math.min(100, Math.max(0, Number(e.target.value))))}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primaryBtn}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : submitLabel}
        </button>
        <button
          className={styles.cancelBtn}
          onClick={handleCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

Note: the `REPUTATION_INDEX` map and the `import type { ReputationLevel }` need to be at the top of the file. The full file structure should be: imports → types → pure helpers → `REPUTATION_INDEX` → `buildPayoutOptions` → `PageData` interface → `ContractNegotiation` component.

- [ ] **Step 2: Replace the CSS module with full styles**

Replace `src/pages/League/ContractNegotiation.module.css` entirely:

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.loading,
.error {
  font-size: 13px;
  color: var(--text-secondary);
  font-style: italic;
}

.error {
  color: var(--danger);
}

.statusBox {
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.02);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 340px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.field select,
.field input {
  padding: 6px 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-primary);
  font-size: 13px;
}

.field select:focus,
.field input:focus {
  outline: none;
  border-color: var(--accent);
}

.actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.primaryBtn {
  padding: 6px 18px;
  background: var(--accent);
  color: #000;
  border: none;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.primaryBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cancelBtn {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.cancelBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cancelBtn:hover:not(:disabled) {
  border-color: var(--text-secondary);
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/League/ContractNegotiation.tsx src/pages/League/ContractNegotiation.module.css
git commit -m "feat: implement ContractNegotiation page with full negotiation flow"
```

---

### Task 7: Smoke test and final verification

- [ ] **Step 1: Start the dev server and manually verify the flow**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm run dev
```

Manually verify:
1. Go to Roster → click "Schedule Fight" for a boxer
2. Select an event and opponent → click "Confirm Fight"
3. You are taken to `/league/contracts/:id` (not calendar)
4. Page shows boxer vs opponent subtitle, event date, payout dropdown, PPV split input
5. Submit a low offer → should see opponent counter (or reject)
6. If countered, form pre-fills with counter values; status area shows "Round 2 of 3"
7. After 3 rounds or rejection, you are returned to `/league/schedule?boxerId=<id>`
8. Accept flow: submit a generous offer ($20k+, 70% split) → navigated to `/league/calendar`, fight appears
9. On Roster, the boxer shows as "Fight scheduled" (via calendar event)
10. Cancel from negotiation page → contract deleted, back to schedule with boxer pre-selected

- [ ] **Step 2: Run full test suite one final time**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run 2>&1
```

Expected: all tests pass.

- [ ] **Step 3: Final commit if any fixes were needed, then done**

```bash
git add -p
git commit -m "fix: <describe any fixes from smoke test>"
```
