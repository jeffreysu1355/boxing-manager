# Finances Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Finances page showing gym level + balance with a functional inline gym upgrade flow, and initialize the gym record during world generation.

**Architecture:** Three independent changes — add gym creation to `generateWorld()`, build `Finances.tsx` as a self-contained React component that reads/writes via `gymStore`, and add scoped CSS. No new DB schema changes needed; `gym` store and `saveGym`/`getGym` already exist.

**Tech Stack:** React 18, TypeScript, CSS Modules, IndexedDB via `idb` (existing `gymStore.ts`)

---

### Task 1: Add gym creation to `generateWorld()`

**Files:**
- Modify: `src/db/worldGen.ts`
- Modify: `src/db/gymStore.ts` (verify `saveGym` signature — no changes likely needed)

- [ ] **Step 1: Read current `generateWorld()` end section**

Open `src/db/worldGen.ts` and confirm the imports at the top — specifically that `saveGym` is NOT yet imported.

- [ ] **Step 2: Add `saveGym` import**

At the top of `src/db/worldGen.ts`, add to the existing imports:

```typescript
import { saveGym } from './gymStore';
```

- [ ] **Step 3: Add gym creation at end of `generateWorld()`**

After the `await generateFreeAgents();` line at the bottom of `generateWorld()`, add:

```typescript
  // 6. Create player gym
  await saveGym({
    name: 'My Gym',
    level: 1,
    balance: 500_000_000,
    rosterIds: [],
    coachIds: [],
  });
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
node_modules/.bin/tsc -b
```

Expected: no output (clean compile).

- [ ] **Step 5: Commit**

```bash
git add src/db/worldGen.ts
git commit -m "feat: initialize gym record in generateWorld"
```

---

### Task 2: Create `Finances.module.css`

**Files:**
- Create: `src/pages/Gym/Finances.module.css`

- [ ] **Step 1: Create the CSS module**

Create `src/pages/Gym/Finances.module.css` with the following content:

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 480px;
}

.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gymName {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.levelBadge {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-left: 8px;
}

.balance {
  font-size: 28px;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.balanceLabel {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.upgradeBlock {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upgradeLabel {
  font-size: 13px;
  color: var(--text-secondary);
}

.upgradeBtn {
  display: inline-block;
  font-size: 13px;
  padding: 6px 14px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  align-self: flex-start;
}

.upgradeBtn:disabled {
  background: var(--bg-surface);
  color: var(--text-muted);
  cursor: not-allowed;
}

.confirmBlock {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.confirmText {
  font-size: 13px;
  color: var(--text-primary);
}

.confirmActions {
  display: flex;
  gap: 8px;
}

.confirmBtn {
  font-size: 13px;
  padding: 5px 14px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.cancelBtn {
  font-size: 13px;
  padding: 5px 14px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
}

.maxLevel {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  font-style: italic;
}

.loading {
  color: var(--text-secondary);
  font-style: italic;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Gym/Finances.module.css
git commit -m "feat: add Finances.module.css"
```

---

### Task 3: Implement `Finances.tsx`

**Files:**
- Modify: `src/pages/Gym/Finances.tsx`

The upgrade cost table (indexed by current level, 1-based):

```typescript
const UPGRADE_COSTS: Record<number, number> = {
  1: 10_000,
  2: 25_000,
  3: 75_000,
  4: 200_000,
  5: 500_000,
  6: 1_500_000,
  7: 5_000_000,
  8: 15_000_000,
  9: 78_000_000,
};
```

`formatMoney` helper (same pattern as Recruiting.tsx):

```typescript
function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}
```

- [ ] **Step 1: Replace `Finances.tsx` with full implementation**

Replace the entire contents of `src/pages/Gym/Finances.tsx` with:

```typescript
import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym, saveGym } from '../../db/gymStore';
import type { Gym } from '../../db/db';
import styles from './Finances.module.css';

const UPGRADE_COSTS: Record<number, number> = {
  1: 10_000,
  2: 25_000,
  3: 75_000,
  4: 200_000,
  5: 500_000,
  6: 1_500_000,
  7: 5_000_000,
  8: 15_000_000,
  9: 78_000_000,
};

function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

export default function Finances() {
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGym().then(g => {
      if (!cancelled) {
        setGym(g ?? null);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function handleConfirmUpgrade() {
    if (!gym) return;
    const cost = UPGRADE_COSTS[gym.level];
    if (cost === undefined || gym.balance < cost) return;

    const updated: Gym = { ...gym, level: gym.level + 1, balance: gym.balance - cost };
    await saveGym(updated);
    setGym(updated);
    setConfirming(false);
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Finances" subtitle="Gym level and financial overview" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  if (!gym) {
    return (
      <div>
        <PageHeader title="Finances" subtitle="Gym level and financial overview" />
        <p className={styles.loading}>No gym data found. Try resetting the game.</p>
      </div>
    );
  }

  const upgradeCost = UPGRADE_COSTS[gym.level];
  const canAfford = upgradeCost !== undefined && gym.balance >= upgradeCost;
  const shortfall = upgradeCost !== undefined ? upgradeCost - gym.balance : 0;

  return (
    <div>
      <PageHeader title="Finances" subtitle="Gym level and financial overview" />
      <div className={styles.page}>
        <div className={styles.card}>
          <div>
            <span className={styles.gymName}>{gym.name}</span>
            <span className={styles.levelBadge}>Level {gym.level} / 10</span>
          </div>

          <div>
            <div className={styles.balanceLabel}>Balance</div>
            <div className={styles.balance}>{formatMoney(gym.balance)}</div>
          </div>

          <div className={styles.upgradeBlock}>
            {gym.level >= 10 ? (
              <span className={styles.maxLevel}>Max Level</span>
            ) : confirming ? (
              <div className={styles.confirmBlock}>
                <p className={styles.confirmText}>
                  Upgrade to Level {gym.level + 1} for {formatMoney(upgradeCost!)}? This cannot be undone.
                </p>
                <div className={styles.confirmActions}>
                  <button className={styles.confirmBtn} onClick={handleConfirmUpgrade}>
                    Confirm
                  </button>
                  <button className={styles.cancelBtn} onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className={styles.upgradeLabel}>
                  Upgrade to Level {gym.level + 1} — {formatMoney(upgradeCost!)}
                </span>
                <button
                  className={styles.upgradeBtn}
                  disabled={!canAfford}
                  title={!canAfford ? `Requires ${formatMoney(upgradeCost!)} — you are ${formatMoney(shortfall)} short` : undefined}
                  onClick={() => setConfirming(true)}
                >
                  Upgrade
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
node_modules/.bin/tsc -b
```

Expected: no output (clean compile).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Gym/Finances.tsx
git commit -m "feat: implement Finances page with gym upgrade flow"
```
