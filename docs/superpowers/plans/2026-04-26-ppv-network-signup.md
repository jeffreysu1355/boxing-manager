# PPV Network Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement post-schedule, per-fight PPV network signup with federation-associated networks, rank-gated eligibility, and viewership-based payout preview.

**Architecture:** Update the `PpvNetwork` data model and seed networks per-federation in world gen; add a dedicated `/league/ppv/:fightId` page for network selection; surface a "Sign PPV Deal" entry point in the Calendar.

**Tech Stack:** React 18, TypeScript, React Router v7, IndexedDB via `idb`, CSS Modules, Vite.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/db/db.ts` | Modify | Update `PpvNetwork` interface; bump DB to v9; clear store on migration |
| `src/db/ppvNetworkStore.ts` | Modify | Add `getPpvNetworksByFederation()` |
| `src/db/worldGen.ts` | Modify | Add `generatePpvNetworks()` called from `generateWorld()` |
| `src/lib/ppvCalc.ts` | Create | Pure viewership + payout calculation functions (testable) |
| `src/lib/ppvCalc.test.ts` | Create | Tests for viewership and payout calculations |
| `src/pages/League/PpvSignup.tsx` | Create | New PPV signup page component |
| `src/pages/League/PpvSignup.module.css` | Create | Styles for PPV signup page |
| `src/pages/League/Calendar.tsx` | Modify | Add "Sign PPV Deal" button and PPV badge to fight rows |
| `src/routes.tsx` | Modify | Register `/league/ppv/:fightId` route |

---

## Task 1: Update PpvNetwork data model and DB migration

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Update the `PpvNetwork` interface**

In `src/db/db.ts`, replace the existing `PpvNetwork` interface (lines 202–211):

```ts
export interface PpvNetwork {
  id?: number;
  name: string;
  federationId: number;
  minBoxerRank: number;         // 0–9; at least one boxer must meet this
  baseViewership: number;
  titleFightMultiplier: number;
}
```

- [ ] **Step 2: Bump DB version and add migration step**

In `src/db/db.ts`, change the version from `8` to `9` in the `openDB` call:

```ts
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 9, {
```

Add the migration block after the existing `if (oldVersion < 8)` block:

```ts
if (oldVersion < 9) {
  // PpvNetwork schema changed (removed contractedBoxerId/contractStart/contractEnd,
  // added federationId/minBoxerRank). Clear and re-seed from worldGen.
  const store = transaction.objectStore('ppvNetworks');
  store.clear();
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors related to `PpvNetwork` fields like `contractedBoxerId`.

- [ ] **Step 4: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: update PpvNetwork model and bump DB to v9"
```

---

## Task 2: Add `getPpvNetworksByFederation` store helper

**Files:**
- Modify: `src/db/ppvNetworkStore.ts`

- [ ] **Step 1: Add the helper function**

Append to `src/db/ppvNetworkStore.ts`:

```ts
export async function getPpvNetworksByFederation(federationId: number): Promise<PpvNetwork[]> {
  const all = await getAllPpvNetworks();
  return all.filter(n => n.federationId === federationId);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/ppvNetworkStore.ts
git commit -m "feat: add getPpvNetworksByFederation helper"
```

---

## Task 3: Seed PPV networks in world generation

**Files:**
- Modify: `src/db/worldGen.ts`

- [ ] **Step 1: Add network name tables and tier definitions**

Add the following constants near the top of `src/db/worldGen.ts`, after the `FEDERATION_PRESTIGE` block:

```ts
const PPV_NETWORK_NAMES: Record<FederationName, string[]> = {
  'North America Boxing Federation': [
    'NABF Sports', 'NABF Fight Night', 'America Boxing Live',
    'North America Championship Boxing', 'Prime Sports PPV',
  ],
  'South America Boxing Federation': [
    'SABF Sports', 'SABF Fight Night', 'South America Boxing Live',
    'Copa Boxing Network', 'Latin Premium PPV',
  ],
  'African Boxing Federation': [
    'ABF Sports', 'ABF Fight Night', 'Africa Boxing Live',
    'Pan-Africa Boxing Network', 'African Championship PPV',
  ],
  'European Boxing Federation': [
    'EBF Sports', 'European Fight Night', 'Euro Boxing Live',
    'Continental Championship Boxing', 'European Premium PPV',
  ],
  'Asia Boxing Federation': [
    'AsBF Sports', 'AsBF Fight Night', 'Asia Boxing Live',
    'Pan-Asia Championship Boxing', 'Asia Premium PPV',
  ],
  'Oceania Boxing Federation': [
    'OBF Sports', 'OBF Fight Night', 'Pacific Boxing Live',
    'Oceania Championship Boxing', 'Pacific Premium PPV',
  ],
  'International Boxing Federation': [
    'IBF Sports', 'IBF Fight Night', 'World Boxing Live',
    'International Championship Boxing', 'World Premium PPV', 'IBF Elite Network',
  ],
};

interface PpvNetworkTier {
  minBoxerRank: number;
  baseViewershipMin: number;
  baseViewershipMax: number;
  titleFightMultiplierMin: number;
  titleFightMultiplierMax: number;
}

const STANDARD_PPV_TIERS: PpvNetworkTier[] = [
  { minBoxerRank: 0, baseViewershipMin: 50_000,    baseViewershipMax: 200_000,  titleFightMultiplierMin: 1.2, titleFightMultiplierMax: 1.3 },
  { minBoxerRank: 0, baseViewershipMin: 50_000,    baseViewershipMax: 200_000,  titleFightMultiplierMin: 1.2, titleFightMultiplierMax: 1.3 },
  { minBoxerRank: 3, baseViewershipMin: 300_000,   baseViewershipMax: 800_000,  titleFightMultiplierMin: 1.3, titleFightMultiplierMax: 1.5 },
  { minBoxerRank: 3, baseViewershipMin: 300_000,   baseViewershipMax: 800_000,  titleFightMultiplierMin: 1.3, titleFightMultiplierMax: 1.5 },
  { minBoxerRank: 5, baseViewershipMin: 1_000_000, baseViewershipMax: 3_000_000, titleFightMultiplierMin: 1.5, titleFightMultiplierMax: 1.6 },
  { minBoxerRank: 7, baseViewershipMin: 5_000_000, baseViewershipMax: 15_000_000, titleFightMultiplierMin: 1.6, titleFightMultiplierMax: 1.8 },
];

const IBF_EXTRA_TIER: PpvNetworkTier = {
  minBoxerRank: 8,
  baseViewershipMin: 20_000_000,
  baseViewershipMax: 50_000_000,
  titleFightMultiplierMin: 1.8,
  titleFightMultiplierMax: 2.0,
};
```

- [ ] **Step 2: Add `generatePpvNetworks` function**

Add this function to `src/db/worldGen.ts` after `generateCoaches`:

```ts
import { putPpvNetwork } from './ppvNetworkStore';

async function generatePpvNetworks(
  federationIds: Record<FederationName, number>
): Promise<void> {
  for (const fedName of FEDERATION_NAMES) {
    const fedId = federationIds[fedName];
    const names = PPV_NETWORK_NAMES[fedName];
    const tiers = fedName === 'International Boxing Federation'
      ? [...STANDARD_PPV_TIERS, IBF_EXTRA_TIER]
      : STANDARD_PPV_TIERS;

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const baseViewership = rand(tier.baseViewershipMin, tier.baseViewershipMax);
      const titleFightMultiplier = parseFloat(
        (tier.titleFightMultiplierMin + Math.random() * (tier.titleFightMultiplierMax - tier.titleFightMultiplierMin)).toFixed(2)
      );
      await putPpvNetwork({
        name: names[i] ?? `${fedName} Network ${i + 1}`,
        federationId: fedId,
        minBoxerRank: tier.minBoxerRank,
        baseViewership,
        titleFightMultiplier,
      });
    }
  }
}
```

- [ ] **Step 3: Call `generatePpvNetworks` from `generateWorld`**

In `generateWorld()`, after the `generateCoaches` call and gym seed (step 7), add:

```ts
  // 9. Seed PPV networks per federation
  await generatePpvNetworks(federationIds);
```

- [ ] **Step 4: Add the import at the top of worldGen.ts**

Add to the existing imports at the top of `src/db/worldGen.ts`:

```ts
import { putPpvNetwork } from './ppvNetworkStore';
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/worldGen.ts src/db/ppvNetworkStore.ts
git commit -m "feat: seed PPV networks per federation in world gen"
```

---

## Task 4: Pure viewership and payout calculation

**Files:**
- Create: `src/lib/ppvCalc.ts`
- Create: `src/lib/ppvCalc.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/ppvCalc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calcViewers, calcPpvPayout, PPV_REVENUE_PER_VIEWER } from './ppvCalc';

describe('calcViewers', () => {
  const network = {
    baseViewership: 1_000_000,
    titleFightMultiplier: 1.5,
    minBoxerRank: 0,
    federationId: 1,
  };

  it('applies 60% base', () => {
    const viewers = calcViewers({ network, gymBoxerRank: 0, opponentRank: 0, isTitleFight: false, isSameFederation: false });
    expect(viewers).toBe(600_000);
  });

  it('applies home federation bonus (+20%)', () => {
    const viewers = calcViewers({ network, gymBoxerRank: 0, opponentRank: 0, isTitleFight: false, isSameFederation: true });
    expect(viewers).toBe(720_000);
  });

  it('applies title fight multiplier', () => {
    const viewers = calcViewers({ network, gymBoxerRank: 0, opponentRank: 0, isTitleFight: true, isSameFederation: false });
    expect(viewers).toBe(900_000);
  });

  it('applies rank bonus for each boxer above minBoxerRank', () => {
    // gymBoxer 2 levels above, opponent 1 level above => 3 * 0.05 = +15%
    const viewers = calcViewers({ network: { ...network, minBoxerRank: 2 }, gymBoxerRank: 4, opponentRank: 3, isTitleFight: false, isSameFederation: false });
    expect(viewers).toBeCloseTo(600_000 * 1.15, 0);
  });

  it('caps rank bonus at +50%', () => {
    // excess = 5 + 5 = 10 => 10*0.05 = 0.5 (capped at 0.5)
    const viewers = calcViewers({ network: { ...network, minBoxerRank: 0 }, gymBoxerRank: 5, opponentRank: 5, isTitleFight: false, isSameFederation: false });
    expect(viewers).toBe(600_000 * 1.5);
  });

  it('combines all bonuses', () => {
    // base=600k, home=*1.2, rank=(2 excess)*0.05=+10%=*1.1, title=*1.5
    const viewers = calcViewers({ network: { ...network, minBoxerRank: 3 }, gymBoxerRank: 5, opponentRank: 3, isTitleFight: true, isSameFederation: true });
    expect(viewers).toBeCloseTo(600_000 * 1.2 * 1.1 * 1.5, 0);
  });
});

describe('calcPpvPayout', () => {
  it('computes payout correctly', () => {
    const payout = calcPpvPayout(1_000_000, 50);
    expect(payout).toBe(1_000_000 * 0.5 * PPV_REVENUE_PER_VIEWER);
  });

  it('returns 0 for 0 viewers', () => {
    expect(calcPpvPayout(0, 50)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/ppvCalc.test.ts
```

Expected: FAIL — `Cannot find module './ppvCalc'`

- [ ] **Step 3: Implement the calculation module**

Create `src/lib/ppvCalc.ts`:

```ts
export const PPV_REVENUE_PER_VIEWER = 0.50;

interface ViewerParams {
  network: {
    baseViewership: number;
    titleFightMultiplier: number;
    minBoxerRank: number;
    federationId: number;
  };
  gymBoxerRank: number;   // 0–9 reputation index
  opponentRank: number;   // 0–9 reputation index
  isTitleFight: boolean;
  isSameFederation: boolean;
}

export function calcViewers(params: ViewerParams): number {
  const { network, gymBoxerRank, opponentRank, isTitleFight, isSameFederation } = params;

  const base = network.baseViewership * 0.6;
  const homeFederationBonus = isSameFederation ? 1.2 : 1.0;

  const excessA = Math.max(0, gymBoxerRank - network.minBoxerRank);
  const excessB = Math.max(0, opponentRank - network.minBoxerRank);
  const rankBonus = Math.min(1.5, 1 + (excessA + excessB) * 0.05);

  const titleBonus = isTitleFight ? network.titleFightMultiplier : 1.0;

  return Math.round(base * homeFederationBonus * rankBonus * titleBonus);
}

export function calcPpvPayout(viewers: number, ppvSplitPercentage: number): number {
  return Math.round(viewers * (ppvSplitPercentage / 100) * PPV_REVENUE_PER_VIEWER);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/lib/ppvCalc.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ppvCalc.ts src/lib/ppvCalc.test.ts
git commit -m "feat: add PPV viewership and payout calculation"
```

---

## Task 5: PPV Signup page

**Files:**
- Create: `src/pages/League/PpvSignup.tsx`
- Create: `src/pages/League/PpvSignup.module.css`

- [ ] **Step 1: Create the CSS module**

Create `src/pages/League/PpvSignup.module.css`:

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

.fightSummary {
  font-size: 13px;
  color: var(--text-secondary);
}

.networkList {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.networkCard {
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: border-color 0.1s;
}

.networkCard:hover:not(.networkCardDisabled) {
  border-color: var(--text-secondary);
}

.networkCardSelected {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.05);
}

.networkCardDisabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.networkName {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.networkMeta {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 4px;
}

.networkIneligible {
  font-size: 12px;
  color: var(--danger);
  font-style: italic;
}

.networkPayout {
  font-size: 12px;
  color: var(--accent);
  margin-top: 4px;
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

.skipBtn {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.skipBtn:hover {
  border-color: var(--text-secondary);
}
```

- [ ] **Step 2: Create the page component**

Create `src/pages/League/PpvSignup.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import type { Fight, FightContract, Boxer, Federation, PpvNetwork } from '../../db/db';
import { getFight } from '../../db/fightStore';
import { getAllFightContracts, putFightContract } from '../../db/fightContractStore';
import { getBoxer } from '../../db/boxerStore';
import { getFederation } from '../../db/federationStore';
import { getPpvNetworksByFederation } from '../../db/ppvNetworkStore';
import { calcViewers, calcPpvPayout } from '../../lib/ppvCalc';
import styles from './PpvSignup.module.css';

const REPUTATION_INDEX: Record<string, number> = {
  'Unknown': 0, 'Local Star': 1, 'Rising Star': 2, 'Respectable Opponent': 3,
  'Contender': 4, 'Championship Caliber': 5, 'Nationally Ranked': 6,
  'World Class Fighter': 7, 'International Superstar': 8, 'All-Time Great': 9,
};

const RANK_LABELS: Record<number, string> = {
  0: 'Open', 1: 'Local Star+', 2: 'Rising Star+', 3: 'Respectable Opponent+',
  4: 'Contender+', 5: 'Championship Caliber+', 6: 'Nationally Ranked+',
  7: 'World Class Fighter+', 8: 'International Superstar+', 9: 'All-Time Great',
};

function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

interface PageData {
  fight: Fight;
  contract: FightContract;
  gymBoxer: Boxer;
  opponent: Boxer;
  federation: Federation;
  networks: PpvNetwork[];
}

export default function PpvSignup() {
  const { fightId } = useParams<{ fightId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<PageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedNetworkId, setSelectedNetworkId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const id = fightId ? parseInt(fightId, 10) : NaN;
      if (isNaN(id)) { setLoadError('Invalid fight ID.'); return; }

      const fight = await getFight(id);
      if (!fight || !fight.id) { setLoadError('Fight not found.'); return; }

      const [gymBoxer, opponent, federation] = await Promise.all([
        getBoxer(fight.boxerIds[0]),
        getBoxer(fight.boxerIds[1]),
        getFederation(fight.federationId),
      ]);

      if (!gymBoxer || !opponent) { setLoadError('Boxer data not found.'); return; }
      if (!federation) { setLoadError('Federation not found.'); return; }

      const contractList = await getAllFightContracts();
      const contract = contractList.find(c => c.fightId === id);
      if (!contract) { setLoadError('Contract not found.'); return; }

      const networks = await getPpvNetworksByFederation(fight.federationId);
      networks.sort((a, b) => a.minBoxerRank - b.minBoxerRank || a.baseViewership - b.baseViewership);

      if (cancelled) return;
      setData({ fight, contract, gymBoxer, opponent, federation, networks });
      if (contract.ppvNetworkId !== null) {
        setSelectedNetworkId(contract.ppvNetworkId);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [fightId]);

  async function handleConfirm() {
    if (!data || saving) return;
    setSaving(true);
    try {
      await putFightContract({ ...data.contract, ppvNetworkId: selectedNetworkId });
      navigate('/league/calendar');
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (!data || saving) return;
    setSaving(true);
    try {
      await putFightContract({ ...data.contract, ppvNetworkId: null });
      navigate('/league/calendar');
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <PageHeader title="PPV Network" subtitle="" />
        <p className={styles.error}>{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <PageHeader title="PPV Network" subtitle="" />
        <p className={styles.loading}>Loading...</p>
      </div>
    );
  }

  const { fight, contract, gymBoxer, opponent, federation, networks } = data;
  const gymRank = REPUTATION_INDEX[gymBoxer.reputation] ?? 0;
  const oppRank = REPUTATION_INDEX[opponent.reputation] ?? 0;
  const bestRank = Math.max(gymRank, oppRank);
  const bestRankLabel = gymRank >= oppRank ? gymBoxer.reputation : opponent.reputation;

  return (
    <div className={styles.page}>
      <PageHeader title="PPV Network" subtitle="Sign a PPV deal for your upcoming fight" />

      <p className={styles.fightSummary}>
        <strong>{gymBoxer.name}</strong> vs <strong>{opponent.name}</strong>
        {' · '}{federation.name}
        {' · '}{formatDate(fight.date)}
        {fight.isTitleFight && <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 600 }}>Title Fight</span>}
      </p>

      <div className={styles.networkList}>
        {networks.map(network => {
          if (network.id === undefined) return null;
          const eligible = bestRank >= network.minBoxerRank;
          const isSelected = selectedNetworkId === network.id;
          const isSameFederation = network.federationId === fight.federationId;

          const viewers = calcViewers({
            network,
            gymBoxerRank: gymRank,
            opponentRank: oppRank,
            isTitleFight: fight.isTitleFight,
            isSameFederation,
          });
          const payout = calcPpvPayout(viewers, contract.ppvSplitPercentage);

          const cardClass = [
            styles.networkCard,
            isSelected ? styles.networkCardSelected : '',
            !eligible ? styles.networkCardDisabled : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={network.id}
              className={cardClass}
              onClick={() => { if (eligible) setSelectedNetworkId(isSelected ? null : network.id!); }}
              role={eligible ? 'button' : undefined}
              tabIndex={eligible ? 0 : -1}
              onKeyDown={e => {
                if (eligible && (e.key === 'Enter' || e.key === ' ')) {
                  setSelectedNetworkId(isSelected ? null : network.id!);
                }
              }}
            >
              <div className={styles.networkName}>{network.name}</div>
              <div className={styles.networkMeta}>
                <span>Req: {RANK_LABELS[network.minBoxerRank] ?? 'Open'}</span>
                <span>Est. viewers: {formatViewers(viewers)}</span>
                {fight.isTitleFight && (
                  <span>Title bonus: ×{network.titleFightMultiplier.toFixed(1)}</span>
                )}
              </div>
              {eligible ? (
                <div className={styles.networkPayout}>
                  Est. PPV payout: ${payout.toLocaleString()} ({contract.ppvSplitPercentage}% split)
                </div>
              ) : (
                <div className={styles.networkIneligible}>
                  Requires {RANK_LABELS[network.minBoxerRank]} — best boxer is {bestRankLabel}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primaryBtn}
          onClick={handleConfirm}
          disabled={saving || selectedNetworkId === null}
        >
          {saving ? 'Saving...' : 'Confirm'}
        </button>
        <button
          className={styles.skipBtn}
          onClick={handleSkip}
          disabled={saving}
        >
          Skip PPV
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors. If `getFight` is not exported from `fightStore`, check `src/db/fightStore.ts` and add it:

```ts
export async function getFight(id: number): Promise<Fight | undefined> {
  const db = await getDB();
  return db.get('fights', id);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/League/PpvSignup.tsx src/pages/League/PpvSignup.module.css
git commit -m "feat: add PPV network signup page"
```

---

## Task 6: Register route

**Files:**
- Modify: `src/routes.tsx`

- [ ] **Step 1: Add the import and route**

In `src/routes.tsx`, add the import after the `ContractNegotiation` import:

```ts
import PpvSignup from './pages/League/PpvSignup';
```

In the `league` children array, add after the `contracts/:id` route:

```ts
{ path: 'ppv/:fightId', element: <PpvSignup /> },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes.tsx
git commit -m "feat: register /league/ppv/:fightId route"
```

---

## Task 7: Calendar entry point

**Files:**
- Modify: `src/pages/League/Calendar.tsx`

- [ ] **Step 1: Load contracts in Calendar**

In `src/pages/League/Calendar.tsx`, add the import for contract fetching:

```ts
import { getAllFightContracts } from '../../db/fightContractStore';
import type { FightContract, PpvNetwork } from '../../db/db';
import { getAllPpvNetworks } from '../../db/ppvNetworkStore';
```

Update the `Promise.all` in the `useEffect` to also fetch contracts and PPV networks:

```ts
Promise.all([
  getGym(),
  getAllBoxers(),
  getAllCalendarEvents(),
  getAllFights(),
  getAllFederations(),
  getAllFightContracts(),
  getAllPpvNetworks(),
]).then(([gym, allBoxers, allEvents, allFights, allFederations, allContracts, allNetworks]) => {
```

Add state variables after the existing state declarations (before `useEffect`):

```ts
const [contractMap, setContractMap] = useState<Map<number, FightContract>>(new Map());
const [networkMap, setNetworkMap] = useState<Map<number, PpvNetwork>>(new Map());
```

Inside the `.then` callback, after building `fMap`, add:

```ts
const cMap = new Map<number, FightContract>();
for (const c of allContracts) {
  if (c.fightId !== null) cMap.set(c.fightId, c);
}
setContractMap(cMap);

const nMap = new Map<number, PpvNetwork>();
for (const n of allNetworks) {
  if (n.id !== undefined) nMap.set(n.id, n);
}
setNetworkMap(nMap);
```

- [ ] **Step 2: Add "Sign PPV Deal" button and PPV badge to fight rows**

Also add the `useNavigate` import at the top if not already there:

```ts
import { Link, useNavigate } from 'react-router';
```

Add `const navigate = useNavigate();` at the top of the `Calendar` component function body.

In the table row JSX, replace the existing `<td>` that contains `{row.isTitleFight && ...}` with:

```tsx
<td>
  {row.isTitleFight && (
    <span className={styles.titleBadge}>Title Fight</span>
  )}
</td>
<td>
  {(() => {
    const contract = contractMap.get(row.eventId) ?? null;
    // contractMap is keyed by fightId; row.eventId is calendarEvent.id not fightId
    // We need to look up by fightId instead — see note below
    return null;
  })()}
</td>
```

**Note:** `row.eventId` in `CalendarRow` is `calendarEvent.id`, but `contractMap` is keyed by `fightId`. We need `fightId` on `CalendarRow`. Update the `CalendarRow` interface and `deriveRows` function:

Update `CalendarRow` interface:

```ts
export interface CalendarRow {
  eventId: number;
  fightId: number;       // add this
  date: string;
  gymBoxerId: number;
  opponentId: number | undefined;
  federationAbbr: string;
  isTitleFight: boolean;
}
```

Update `deriveRows` to include `fightId`:

```ts
rows.push({
  eventId: event.id,
  fightId: event.fightId,   // add this line
  date: event.date,
  gymBoxerId,
  opponentId,
  federationAbbr,
  isTitleFight: fight.isTitleFight,
});
```

Now update the table row JSX to use `row.fightId`. Replace the last two `<td>` cells of each row with:

```tsx
<td>
  {row.isTitleFight && (
    <span className={styles.titleBadge}>Title Fight</span>
  )}
</td>
<td>
  {(() => {
    const contract = contractMap.get(row.fightId);
    if (!contract) return null;
    if (contract.ppvNetworkId !== null) {
      const network = networkMap.get(contract.ppvNetworkId);
      return (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          PPV: {network?.name ?? 'Signed'}
        </span>
      );
    }
    return (
      <button
        style={{
          fontSize: 12,
          padding: '2px 8px',
          background: 'none',
          border: '1px solid var(--accent)',
          borderRadius: 3,
          color: 'var(--accent)',
          cursor: 'pointer',
        }}
        onClick={() => navigate(`/league/ppv/${row.fightId}`)}
      >
        Sign PPV Deal
      </button>
    );
  })()}
</td>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run existing Calendar tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/pages/League/Calendar.test.ts
```

Expected: all PASS. If `deriveRows` tests break because `CalendarRow` now requires `fightId`, update the test fixtures to include `fightId` in the row objects returned by `deriveRows`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/League/Calendar.tsx
git commit -m "feat: add Sign PPV Deal button and PPV badge to Calendar"
```

---

## Task 8: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm run dev
```

- [ ] **Step 2: Reset game state**

Open the browser dev tools console and run:

```js
indexedDB.deleteDatabase('boxing-manager')
```

Then hard-refresh the page. This forces world gen to re-run with the new DB version and seeds fresh PPV networks.

- [ ] **Step 3: Verify PPV networks seeded**

In the dev tools console:

```js
const db = await new Promise(r => indexedDB.open('boxing-manager', 9).onsuccess = e => r(e.target.result));
const tx = db.transaction('ppvNetworks', 'readonly');
const store = tx.objectStore('ppvNetworks');
store.getAll().onsuccess = e => console.log(e.target.result);
```

Expected: 37–38 networks (6 per federation × 6 federations + 7 for IBF).

- [ ] **Step 4: Schedule a fight and complete contract negotiation**

1. Go to League → Schedule, recruit a boxer if needed, pick an event and opponent, click Confirm Fight.
2. Go through ContractNegotiation until accepted.
3. Navigate to League → Calendar.
4. Verify "Sign PPV Deal" button appears on the scheduled fight row.

- [ ] **Step 5: Test the PPV signup page**

1. Click "Sign PPV Deal".
2. Verify the network list shows with correct rank requirements and estimated viewer counts.
3. Verify ineligible networks (rank too low) are grayed out and non-clickable.
4. Select an eligible network, verify payout preview appears.
5. Click Confirm — verify redirect to Calendar and "PPV: [Network Name]" badge appears.

- [ ] **Step 6: Test Skip PPV**

Repeat steps 4–5 but click "Skip PPV" instead. Verify no badge appears and button remains (since `ppvNetworkId` stays null).

Actually: "Skip PPV" sets `ppvNetworkId: null` explicitly, so the button will reappear. This is correct behavior — the player can come back and sign later.

- [ ] **Step 7: Commit any fixes found during testing**

```bash
git add -p
git commit -m "fix: <describe any issues found>"
```
