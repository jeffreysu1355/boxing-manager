# Fight Payouts & Transaction History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply post-fight payouts (guaranteed + PPV with ±20% variance) to the gym balance, record all money events (fight payouts, coach salaries, gym upgrades, recruiting bonuses) as transactions, and display a transaction history list on the Finances page.

**Architecture:** A new `transactions` IndexedDB store holds `GymTransaction` records. A `logTransaction` helper atomically updates `gym.balance` and writes the record — all balance mutations across the codebase replace their `saveGym` calls with `logTransaction`. A shared `reputationIndex.ts` utility is extracted so `fightResultApplier.ts` can compute PPV viewer counts without importing from page components.

**Tech Stack:** React 18, TypeScript, IndexedDB via `idb`, CSS Modules

---

### Task 1: Extract `REPUTATION_INDEX` to a shared lib file

`REPUTATION_INDEX` is currently copy-pasted in 6+ files. `fightResultApplier.ts` will need it to compute PPV viewers. Extract it to a canonical location before wiring up the payout logic.

**Files:**
- Create: `src/lib/reputationIndex.ts`
- Modify: `src/pages/League/Schedule.tsx` (import from shared lib, remove local copy)

- [ ] **Step 1: Create `src/lib/reputationIndex.ts`**

```ts
import type { ReputationLevel } from '../db/db';

export const REPUTATION_INDEX: Record<ReputationLevel, number> = {
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
```

- [ ] **Step 2: Update `src/pages/League/Schedule.tsx` to import from the shared lib**

Find and remove the local `REPUTATION_INDEX` constant (lines 24–35):
```ts
const REPUTATION_INDEX: Record<ReputationLevel, number> = {
  'Unknown': 0,
  ...
  'All-Time Great': 9,
};
```

Add import at the top of the file (after existing imports):
```ts
import { REPUTATION_INDEX } from '../../lib/reputationIndex';
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | grep -E "reputationIndex|Schedule" | head -10`
Expected: no new errors referencing `reputationIndex.ts` or `Schedule.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/lib/reputationIndex.ts src/pages/League/Schedule.tsx
git commit -m "refactor: extract REPUTATION_INDEX to shared lib"
```

---

### Task 2: Add `GymTransaction` type and `transactions` store to IndexedDB

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add the `GymTransaction` interface to `db.ts`**

After the `FederationEvent` interface (around line 254), add:

```ts
export type TransactionCategory =
  | 'fight_payout'
  | 'ppv_payout'
  | 'coach_salary'
  | 'gym_upgrade'
  | 'recruit_bonus';

export interface GymTransaction {
  id?: number;
  date: string;
  description: string;
  amount: number;
  balanceAfter: number;
  category: TransactionCategory;
}
```

- [ ] **Step 2: Add `transactions` to `BoxingManagerDBSchema`**

Inside `interface BoxingManagerDBSchema extends DBSchema`, after the `federationEvents` entry, add:

```ts
transactions: {
  key: number;
  value: GymTransaction;
  indexes: { date: string };
};
```

- [ ] **Step 3: Bump DB version from 13 to 14 and add upgrade block**

Change:
```ts
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 13, {
```
To:
```ts
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 14, {
```

After the `if (oldVersion < 13)` block (around line 435), add:

```ts
if (oldVersion < 14) {
  const txStore = db.createObjectStore('transactions', {
    keyPath: 'id',
    autoIncrement: true,
  });
  txStore.createIndex('date', 'date');
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | grep "db.ts" | head -10`
Expected: no errors on `db.ts`

- [ ] **Step 5: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: add GymTransaction type and transactions IndexedDB store"
```

---

### Task 3: Create `transactionStore.ts` with `logTransaction` and `getAllTransactions`

**Files:**
- Create: `src/db/transactionStore.ts`

- [ ] **Step 1: Create `src/db/transactionStore.ts`**

```ts
import { getDB, type GymTransaction } from './db';
import { getGym, saveGym } from './gymStore';

export async function logTransaction(
  tx: Omit<GymTransaction, 'id' | 'balanceAfter'>,
): Promise<number> {
  const gym = await getGym();
  if (!gym) throw new Error('Gym not found');
  const balanceAfter = gym.balance + tx.amount;
  await saveGym({ ...gym, balance: balanceAfter });
  const db = await getDB();
  return db.add('transactions', { ...tx, balanceAfter } as GymTransaction);
}

export async function getAllTransactions(): Promise<GymTransaction[]> {
  const db = await getDB();
  const all = await db.getAll('transactions');
  return all.sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | grep "transactionStore" | head -10`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/db/transactionStore.ts
git commit -m "feat: add transactionStore with logTransaction and getAllTransactions"
```

---

### Task 4: Wire fight payouts into `applyFightResult`

**Files:**
- Modify: `src/components/TopNav/fightResultApplier.ts`

**Context:** `fightResultApplier.ts` already fetches the contract in step 4 (when `contractId !== null`). The gym boxer is always `fight.boxerIds[0]` by construction. The winner and loser are already fetched as `winner` and `loser` at the top of the function.

- [ ] **Step 1: Add imports to `fightResultApplier.ts`**

Add at the top of the file:
```ts
import { getPpvNetwork } from '../../db/ppvNetworkStore';
import { calcViewers, calcPpvPayout } from '../../lib/ppvCalc';
import { REPUTATION_INDEX } from '../../lib/reputationIndex';
import { logTransaction } from '../../db/transactionStore';
```

- [ ] **Step 2: Add `gymBoxerFirstId` to `ApplyFightResultParams`**

The interface needs the first boxer ID so we know which is the gym boxer. Add to the interface:

```ts
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
  contractId: number | null;
  gymBoxerFirstId: number; // fight.boxerIds[0] — always the gym boxer
}
```

- [ ] **Step 3: Destructure `gymBoxerFirstId` in `applyFightResult`**

In the function body, add `gymBoxerFirstId` to the destructuring:
```ts
const {
  fightId, winnerId, loserId, method, finishingMove, round, time,
  winnerRecord, loserRecord, isTitleFight, federationId, weightClass,
  fightDate, contractId, gymBoxerFirstId,
} = params;
```

- [ ] **Step 4: Replace step 4 (contract completion) with payout logic**

Find the current step 4 block:
```ts
// 4. Mark contract completed (skip for NPC fights which have no contract)
if (contractId !== null) {
  const contract = await getFightContract(contractId);
  if (contract) {
    await putFightContract({ ...contract, status: 'completed' });
  }
}
```

Replace with:
```ts
// 4. Mark contract completed and apply payouts
if (contractId !== null) {
  const contract = await getFightContract(contractId);
  if (contract) {
    await putFightContract({ ...contract, status: 'completed' });

    // Identify gym boxer name and opponent name for descriptions
    const gymBoxer = winner?.id === gymBoxerFirstId ? winner : loser;
    const opponent = winner?.id === gymBoxerFirstId ? loser : winner;
    const gymBoxerName = gymBoxer?.name ?? 'Gym Boxer';
    const opponentName = opponent?.name ?? 'Opponent';

    // Guaranteed payout
    if (contract.guaranteedPayout > 0) {
      await logTransaction({
        date: fightDate,
        description: `Fight payout: ${gymBoxerName} vs ${opponentName}`,
        amount: contract.guaranteedPayout,
        category: 'fight_payout',
      });
    }

    // PPV payout with ±20% variance
    if (contract.ppvNetworkId !== null) {
      const network = await getPpvNetwork(contract.ppvNetworkId);
      if (network) {
        const gymBoxerRank = REPUTATION_INDEX[gymBoxer?.reputation ?? 'Unknown'] ?? 0;
        const opponentRank = REPUTATION_INDEX[opponent?.reputation ?? 'Unknown'] ?? 0;
        const baseViewers = calcViewers({
          network,
          gymBoxerRank,
          opponentRank,
          isTitleFight,
          isSameFederation: network.federationId === federationId,
        });
        const actualViewers = Math.round(baseViewers * (0.8 + Math.random() * 0.4));
        const ppvPayout = calcPpvPayout(actualViewers, contract.ppvSplitPercentage);
        if (ppvPayout > 0) {
          await logTransaction({
            date: fightDate,
            description: `PPV payout: ${gymBoxerName} vs ${opponentName} (${network.name})`,
            amount: ppvPayout,
            category: 'ppv_payout',
          });
        }
      }
    }
  }
}
```

- [ ] **Step 5: Pass `gymBoxerFirstId` from the call site in `TopNav.tsx`**

Find the `applyFightResult` call in `src/components/TopNav/TopNav.tsx` (around line 263). Add `gymBoxerFirstId: fight.boxerIds[0]` to the params object:

```ts
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
  gymBoxerFirstId: fight.boxerIds[0],
});
```

- [ ] **Step 6: Verify build**

Run: `npm run build 2>&1 | grep -E "fightResultApplier|TopNav" | head -10`
Expected: no new errors

- [ ] **Step 7: Commit**

```bash
git add src/components/TopNav/fightResultApplier.ts src/components/TopNav/TopNav.tsx
git commit -m "feat: apply fight and PPV payouts in applyFightResult"
```

---

### Task 5: Replace coach salary `saveGym` with per-coach `logTransaction`

**Files:**
- Modify: `src/lib/coachSalaries.ts`

**Context:** `runCoachSalaries` currently deducts a lump total from the gym balance with one `saveGym` call. Replace with one `logTransaction` per coach per month elapsed, using the `toDate` as the transaction date.

- [ ] **Step 1: Update imports in `coachSalaries.ts`**

Replace:
```ts
import { getGym, saveGym } from '../db/gymStore';
```
With:
```ts
import { logTransaction } from '../db/transactionStore';
```

Remove `getGym` and `saveGym` from imports (they are no longer used here — `logTransaction` calls `getGym`/`saveGym` internally).

- [ ] **Step 2: Rewrite `runCoachSalaries`**

Replace the entire function body:

```ts
export async function runCoachSalaries(
  fromDate: string,
  toDate: string,
  gymId: number,
): Promise<void> {
  const months = countMonthsElapsed(fromDate, toDate);
  if (months === 0) return;

  const allCoaches = await getAllCoaches();
  const gymCoaches = allCoaches.filter(c => c.gymId === gymId);
  if (gymCoaches.length === 0) return;

  for (let m = 0; m < months; m++) {
    for (const coach of gymCoaches) {
      if (coach.monthlySalary <= 0) continue;
      await logTransaction({
        date: toDate,
        description: `Coach salary: ${coach.name}`,
        amount: -coach.monthlySalary,
        category: 'coach_salary',
      });
    }
  }
}
```

- [ ] **Step 3: Remove now-unused `getGym`/`saveGym` import and fix unused `Coach` type import if needed**

Verify `src/lib/coachSalaries.ts` imports are now:
```ts
import { getAllCoaches } from '../db/coachStore';
import type { Coach } from '../db/db';
import { logTransaction } from '../db/transactionStore';
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | grep "coachSalaries" | head -10`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/coachSalaries.ts
git commit -m "feat: log per-coach salary transactions instead of lump saveGym"
```

---

### Task 6: Replace gym upgrade `saveGym` with `logTransaction` in `Finances.tsx`

**Files:**
- Modify: `src/pages/Gym/Finances.tsx`

**Context:** `handleConfirmUpgrade` currently builds an `updated` gym with `balance - cost` and calls `saveGym(updated)`. Replace the balance mutation with `logTransaction`; then re-fetch gym to get the new state (including updated balance).

- [ ] **Step 1: Add `logTransaction` import**

Add to imports at the top of `Finances.tsx`:
```ts
import { logTransaction } from '../../db/transactionStore';
```

- [ ] **Step 2: Rewrite `handleConfirmUpgrade`**

Replace the entire function:
```ts
async function handleConfirmUpgrade() {
  if (!gym) return;
  const cost = UPGRADE_COSTS[gym.level];
  if (cost === undefined || gym.balance < cost) return;

  await logTransaction({
    date: gym.currentDate,
    description: `Gym upgrade to Level ${gym.level + 1}`,
    amount: -cost,
    category: 'gym_upgrade',
  });

  // logTransaction updated balance; now bump the level and re-fetch
  const fresh = await getGym();
  if (fresh) setGym({ ...fresh, level: fresh.level + 1 });
  await saveGym({ ...gym, level: gym.level + 1 });
  setGym(prev => prev ? { ...prev, level: prev.level + 1 } : prev);
  setConfirming(false);
}
```

Wait — `logTransaction` only updates balance, not level. We still need `saveGym` for the level bump. Correct implementation:

```ts
async function handleConfirmUpgrade() {
  if (!gym) return;
  const cost = UPGRADE_COSTS[gym.level];
  if (cost === undefined || gym.balance < cost) return;

  await logTransaction({
    date: gym.currentDate,
    description: `Gym upgrade to Level ${gym.level + 1}`,
    amount: -cost,
    category: 'gym_upgrade',
  });
  // logTransaction already updated gym.balance in DB; now bump the level
  const fresh = await getGym();
  if (!fresh) return;
  await saveGym({ ...fresh, level: gym.level + 1 });
  setGym({ ...fresh, level: gym.level + 1 });
  setConfirming(false);
}
```

- [ ] **Step 3: Add `getGym` to imports** (it's already imported — verify it stays)

Ensure `Finances.tsx` imports include:
```ts
import { getGym, saveGym } from '../../db/gymStore';
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | grep "Finances" | head -10`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/Gym/Finances.tsx
git commit -m "feat: log gym upgrade transaction instead of direct saveGym"
```

---

### Task 7: Replace recruiting bonus `saveGym` with `logTransaction` in `Recruiting.tsx`

**Files:**
- Modify: `src/pages/Players/Recruiting.tsx`

**Context:** `handleRecruit` builds `updatedGym` with `balance - bonus` and calls `saveGym(updatedGym)`. Replace the balance mutation with `logTransaction`; keep a separate `saveGym` for the `rosterIds` update.

- [ ] **Step 1: Add `logTransaction` import**

Add to imports at top of `Recruiting.tsx`:
```ts
import { logTransaction } from '../../db/transactionStore';
```

- [ ] **Step 2: Rewrite `handleRecruit`**

Replace the entire function:
```ts
async function handleRecruit(boxer: Boxer) {
  if (!gym || !boxer.id) return;
  const bonus = SIGNING_BONUS[boxer.reputation];
  if (gym.balance < bonus) return;

  // Log the signing bonus transaction (this updates gym.balance in DB)
  await logTransaction({
    date: gym.currentDate,
    description: `Signing bonus: ${boxer.name}`,
    amount: -bonus,
    category: 'recruit_bonus',
  });

  // Fetch fresh gym (balance already updated by logTransaction) and add boxer to roster
  const fresh = await getGym();
  if (!fresh) return;
  const updatedGym: Gym = { ...fresh, rosterIds: [...fresh.rosterIds, boxer.id] };
  const updatedBoxer: Boxer = { ...boxer, gymId: gym.id ?? 1 };
  await Promise.all([saveGym(updatedGym), putBoxer(updatedBoxer)]);

  setGym(updatedGym);
  setProspects(prev => prev.filter(b => b.id !== boxer.id));
  setFreeAgents(prev => prev.filter(b => b.id !== boxer.id));
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | grep "Recruiting" | head -10`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/Players/Recruiting.tsx
git commit -m "feat: log recruiting bonus transaction instead of direct saveGym"
```

---

### Task 8: Add transaction history UI to `Finances.tsx` and `Finances.module.css`

**Files:**
- Modify: `src/pages/Gym/Finances.tsx`
- Modify: `src/pages/Gym/Finances.module.css`

- [ ] **Step 1: Add `getAllTransactions` import and state to `Finances.tsx`**

Add import:
```ts
import { getAllTransactions } from '../../db/transactionStore';
import type { GymTransaction } from '../../db/db';
```

Add state inside the `Finances` component (after existing state):
```ts
const [transactions, setTransactions] = useState<GymTransaction[]>([]);
```

- [ ] **Step 2: Load transactions in the `useEffect`**

In the existing `useEffect`, change the `getGym().then(...)` block to also load transactions:

```ts
useEffect(() => {
  let cancelled = false;
  Promise.all([getGym(), getAllTransactions()]).then(([g, txs]) => {
    if (!cancelled) {
      setGym(g ?? null);
      setTransactions(txs);
      setLoading(false);
    }
  });
  return () => { cancelled = true; };
}, []);
```

- [ ] **Step 3: Add `formatDate` and `formatAmount` helpers**

After the existing `formatMoney` function, add:
```ts
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatAmount(amount: number): string {
  const sign = amount >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(amount).toLocaleString('en-US')}`;
}
```

- [ ] **Step 4: Add transaction history section to the JSX**

In the return block, after the closing `</div>` of the existing card (just before the outer closing `</div>`), add:

```tsx
<div className={styles.historySection}>
  <div className={styles.historySectionTitle}>Transaction History</div>
  {transactions.length === 0 ? (
    <p className={styles.empty}>No transactions yet.</p>
  ) : (
    <div className={styles.historyList}>
      {transactions.map(tx => (
        <div key={tx.id} className={styles.historyRow}>
          <span className={styles.historyDate}>{formatDate(tx.date)}</span>
          <span className={styles.historyDesc}>{tx.description}</span>
          <span className={`${styles.historyAmount} ${tx.amount >= 0 ? styles.historyIncome : styles.historyExpense}`}>
            {formatAmount(tx.amount)}
          </span>
          <span className={styles.historyBalance}>{formatMoney(tx.balanceAfter)}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 5: Add CSS to `Finances.module.css`**

Append to the end of `src/pages/Gym/Finances.module.css`:

```css
.historySection {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.historySectionTitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.historyList {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.historyRow {
  display: grid;
  grid-template-columns: 110px 1fr 90px 90px;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  gap: 8px;
}

.historyRow:last-child {
  border-bottom: none;
}

.historyDate {
  color: var(--text-muted);
  white-space: nowrap;
}

.historyDesc {
  color: var(--text-primary);
}

.historyAmount {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.historyIncome {
  color: var(--success);
}

.historyExpense {
  color: var(--danger);
}

.historyBalance {
  text-align: right;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.empty {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build 2>&1 | grep -E "Finances|error TS" | head -20`
Expected: no TypeScript errors on Finances files

- [ ] **Step 7: Commit**

```bash
git add src/pages/Gym/Finances.tsx src/pages/Gym/Finances.module.css
git commit -m "feat: add transaction history UI to Finances page"
```

---

### Task 9: Manual smoke test

- [ ] **Step 1: Restart the game world**

Run `npm run dev`, open the app, go to Tools → God Mode, click Restart to wipe and regenerate (starting balance: $20,000).

- [ ] **Step 2: Verify Finances page shows $20,000 and empty history**

Navigate to Gym → Finances. Confirm balance shows `$20,000` and "No transactions yet."

- [ ] **Step 3: Verify gym upgrade logs a transaction**

If you have enough balance for a Level 1→2 upgrade ($10,000), click Upgrade → Confirm.
Expected: balance drops to $10,000 and a transaction row "Gym upgrade to Level 2" for -$10,000 appears.

- [ ] **Step 4: Verify recruiting bonus logs a transaction**

Go to Players → Recruiting. Sign a prospect.
Expected: a "Signing bonus: [name]" transaction appears on the Finances page.

- [ ] **Step 5: Verify fight payouts**

Advance time (TopNav) until a scheduled fight resolves.
Expected: one or two new transactions appear — "Fight payout: ..." and optionally "PPV payout: ..." if a PPV network was signed.

- [ ] **Step 6: Verify coach salary transactions**

If you have hired a coach, advance time by one full month.
Expected: one "Coach salary: [name]" transaction per coach per month elapsed.

- [ ] **Step 7: Stop dev server** (`Ctrl+C`)
