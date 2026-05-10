# Fight Payouts & Transaction History

**Date:** 2026-05-09

## Problem

Post-fight payouts (guaranteed contract payout + PPV revenue) are never applied to the gym balance. Coach salaries, recruiting bonuses, and gym upgrades already adjust the balance but leave no audit trail. The Finances page shows only current balance with no history.

## Solution

1. Add a `GymTransaction` IndexedDB store to record every money event
2. Replace all direct `saveGym` balance mutations with a `logTransaction` helper that atomically updates balance + writes the record
3. Apply fight payouts (guaranteed + PPV with ±20% variance) inside `applyFightResult`
4. Show a transaction history list on the Finances page below the upgrade card

---

## Data Layer

### `GymTransaction` type (add to `db.ts`)

```ts
export interface GymTransaction {
  id?: number;
  date: string;           // ISO date, e.g. '2026-04-14'
  description: string;    // human-readable label
  amount: number;         // positive = income, negative = expense
  balanceAfter: number;   // gym balance after this transaction
  category: 'fight_payout' | 'ppv_payout' | 'coach_salary' | 'gym_upgrade' | 'recruit_bonus';
}
```

### IndexedDB schema (version bump in `db.ts`)

New `transactions` object store:
- key: auto-increment `id`
- index: `date` (non-unique) — for chronological queries

### `src/db/transactionStore.ts` (new file)

```ts
export async function logTransaction(
  tx: Omit<GymTransaction, 'id' | 'balanceAfter'>
): Promise<number>
```

Implementation:
1. Fetch current gym via `getGym()`
2. Compute `balanceAfter = gym.balance + tx.amount`
3. Save updated gym: `saveGym({ ...gym, balance: balanceAfter })`
4. Write transaction record with `balanceAfter` to the `transactions` store
5. Return new balance

```ts
export async function getAllTransactions(): Promise<GymTransaction[]>
```

Returns all records sorted by `date` descending (newest first), then by `id` descending for same-day ordering.

---

## Payout Logic

### Fight payouts — `fightResultApplier.ts`

In step 4 (after marking contract completed), when `contractId !== null`:

1. Contract already fetched — read `guaranteedPayout`, `ppvNetworkId`, `ppvSplitPercentage`
2. Boxer names are already fetched (winner/loser) — use them for descriptions
3. If `guaranteedPayout > 0`:
   - `logTransaction({ date: fightDate, description: 'Fight payout: [gymBoxerName] vs [opponentName]', amount: guaranteedPayout, category: 'fight_payout' })`
4. If `ppvNetworkId !== null`:
   - Fetch network from `ppvNetworkStore`
   - Compute viewers via `calcViewers(...)` then apply variance: `viewers * (0.8 + Math.random() * 0.4)` (range: 0.8×–1.2× = ±20%)
   - Compute payout via `calcPpvPayout(actualViewers, ppvSplitPercentage)`
   - `logTransaction({ date: fightDate, description: 'PPV payout: [gymBoxerName] vs [opponentName] ([networkName])', amount: ppvPayout, category: 'ppv_payout' })`

**Identifying the gym boxer:** `fight.boxerIds[0]` is the gym boxer by construction (set in contract flow). Use `winner`/`loser` already fetched — check which one is the gym boxer by matching `fight.boxerIds[0]`.

**Reputation ranks for `calcViewers`:** use `REPUTATION_INDEX` already defined in `Schedule.tsx` — extract it to a shared location `src/lib/reputationIndex.ts` so `fightResultApplier.ts` can import it without circular deps.

### Coach salaries — `coachSalaries.ts`

Currently: one `saveGym` call deducting total salary.

Replace with: one `logTransaction` call per coach:
```
description: 'Coach salary: [coachName]'
amount: -monthlySalary
category: 'coach_salary'
date: current game date (already available as param)
```

Remove the manual `saveGym` call — `logTransaction` handles balance update.

### Gym upgrades — `Finances.tsx`

In `handleConfirmUpgrade`, replace:
```ts
await saveGym(updated); // where updated has balance - cost
```
With:
```ts
await logTransaction({
  date: gym.currentDate,
  description: `Gym upgrade to Level ${gym.level + 1}`,
  amount: -cost,
  category: 'gym_upgrade',
});
```
Then re-fetch gym to update local state.

### Recruiting bonuses — `Recruiting.tsx`

In the sign boxer handler, replace the `saveGym` balance deduction with:
```ts
await logTransaction({
  date: gym.currentDate,
  description: `Signing bonus: ${boxer.name}`,
  amount: -bonus,
  category: 'recruit_bonus',
});
```
Still need to `saveGym` for the `rosterIds` update (logTransaction only touches balance). Or: add boxer to roster in the same `saveGym` inside `logTransaction` — no, keep them separate. `logTransaction` updates balance only; a separate `saveGym` updates rosterIds.

---

## Finances UI — `Finances.tsx` + `Finances.module.css`

Layout (top to bottom):
1. Existing balance + upgrade card (unchanged)
2. **Transaction History** section below

### Transaction history section

```
Transaction History
──────────────────────────────────────────────────────
Apr 14, 2026  Fight payout: Tyson vs. Frazier        +$5,000    $25,000
Apr 14, 2026  PPV payout: Tyson vs. Frazier (NABF)   +$1,200    $26,200
Apr 1, 2026   Coach salary: Coach Smith                 -$500    $20,000
──────────────────────────────────────────────────────
```

- Newest first (sorted by date desc, then id desc)
- Amount: green `+$X,XXX` for positive, red `-$X,XXX` for negative
- Balance after: right-aligned, muted color
- Empty state: "No transactions yet."
- No pagination — all in one scrollable list

---

## Scope

Files created:
- `src/db/transactionStore.ts`
- `src/lib/reputationIndex.ts` (extracted from `Schedule.tsx`)

Files modified:
- `src/db/db.ts` — add `GymTransaction` type, `transactions` store, version bump
- `src/components/TopNav/fightResultApplier.ts` — apply payouts
- `src/lib/coachSalaries.ts` — per-coach logTransaction
- `src/pages/Gym/Finances.tsx` — upgrade uses logTransaction, add history UI
- `src/pages/Gym/Finances.module.css` — styles for history section
- `src/pages/Players/Recruiting.tsx` — signing bonus uses logTransaction
- `src/pages/League/Schedule.tsx` — import reputationIndex from shared location

---

## Out of Scope

- Paginating transaction history
- Filtering/searching transactions
- Exporting transaction history
