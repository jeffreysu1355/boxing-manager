# Championship History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Championship History page to the League tab showing all title reigns grouped by federation/weight class, and link player page title badges directly to each belt's section via hash anchors.

**Architecture:** A new page at `/league/championship-history` fetches all titles and federations, batch-fetches boxer names, and renders cards per title with reign tables. The player page title badge `<span>` is replaced with a `<Link>` to `/league/championship-history#title-{titleId}`. No new DB stores or data structures required.

**Tech Stack:** React 18, React Router v7, TypeScript, CSS Modules, IndexedDB via `idb`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/pages/League/ChampionshipHistory.tsx` | Page component — loads all titles, federations, boxer names; renders federation sections with per-title reign cards |
| Create | `src/pages/League/ChampionshipHistory.module.css` | Scoped styles for the page |
| Modify | `src/routes.tsx` | Register `/league/championship-history` child route |
| Modify | `src/components/Sidebar/Sidebar.tsx` | Add "Championship History" link to the League section |
| Modify | `src/pages/Player/PlayerPage.tsx` | Change title badge `<span>` to `<Link to="/league/championship-history#title-{titleId}">` |
| Modify | `src/pages/Player/PlayerPage.module.css` | Add `text-decoration: none` to `.titleBadge` so the link looks like the existing badge |

---

### Task 1: Create ChampionshipHistory CSS module

**Files:**
- Create: `src/pages/League/ChampionshipHistory.module.css`

- [ ] **Step 1: Create the CSS file**

Create `src/pages/League/ChampionshipHistory.module.css` with this exact content:

```css
.page {
  padding: 24px;
  max-width: 860px;
}

.loading {
  color: var(--text-secondary);
  font-size: 14px;
  padding: 24px;
}

.fedSection {
  margin-bottom: 36px;
}

.fedTitle {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.titleCard {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  margin-bottom: 16px;
  overflow: hidden;
}

.cardHeader {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  padding: 8px 14px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
}

.empty {
  padding: 12px 14px;
  color: var(--text-muted);
  font-style: italic;
  font-size: 12px;
}

.reignRow {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 80px 80px;
  padding: 7px 14px;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
  align-items: center;
}

.reignRow:last-child {
  border-bottom: none;
}

.reignHeader {
  composes: reignRow;
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  background: var(--bg-surface);
}

.reignCurrent {
  composes: reignRow;
  border-left: 3px solid var(--accent);
  padding-left: 11px;
}

.boxerLink {
  color: var(--accent);
  text-decoration: none;
}

.boxerLink:hover {
  text-decoration: underline;
}

.currentBadge {
  color: var(--accent);
  font-weight: 700;
}
```

- [ ] **Step 2: Verify file was created**

Run: `ls /Users/jefsu/Documents/workspace/boxing-manager/src/pages/League/ChampionshipHistory.module.css`
Expected: the file path is printed with no error.

- [ ] **Step 3: Commit**

```bash
git -C /Users/jefsu/Documents/workspace/boxing-manager add src/pages/League/ChampionshipHistory.module.css
git -C /Users/jefsu/Documents/workspace/boxing-manager commit -m "feat: add ChampionshipHistory CSS module"
```

---

### Task 2: Create ChampionshipHistory page component

**Files:**
- Create: `src/pages/League/ChampionshipHistory.tsx`

**Context:** Key types from `src/db/db.ts`:
- `Title`: `{ id?: number; federationId: number; weightClass: WeightClass; currentChampionId: number | null; reigns: TitleReign[] }`
- `TitleReign`: `{ boxerId: number; dateWon: string; dateLost: string | null; defenseCount: number }`
- `Federation`: `{ id?: number; name: FederationName; prestige: number }`
- `WeightClass`: `'flyweight' | 'lightweight' | 'welterweight' | 'middleweight' | 'heavyweight'`
- `Boxer`: `{ id?: number; name: string; ... }`

DB functions available:
- `getAllTitles()` from `../../db/titleStore`
- `getAllFederations()` from `../../db/federationStore`
- `getBoxer(id: number)` from `../../db/boxerStore`
- `getGym()` from `../../db/gymStore`

`FEDERATION_ABBR` is a `Record<FederationName, string>` from `../../constants/federations`.

`PageHeader` component: `import { PageHeader } from '../../components/PageHeader/PageHeader'` — takes `title` and `subtitle` string props.

- [ ] **Step 1: Create `ChampionshipHistory.tsx`**

Create `src/pages/League/ChampionshipHistory.tsx` with this exact content:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getAllTitles } from '../../db/titleStore';
import { getAllFederations } from '../../db/federationStore';
import { getBoxer } from '../../db/boxerStore';
import { getGym } from '../../db/gymStore';
import type { Title, Federation, Boxer, WeightClass } from '../../db/db';
import { FEDERATION_ABBR } from '../../constants/federations';
import styles from './ChampionshipHistory.module.css';

const WEIGHT_CLASS_ORDER: WeightClass[] = [
  'flyweight', 'lightweight', 'welterweight', 'middleweight', 'heavyweight',
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function diffDays(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

interface FedGroup {
  federation: Federation;
  titles: Title[];
}

export default function ChampionshipHistory() {
  const [fedGroups, setFedGroups] = useState<FedGroup[]>([]);
  const [boxerMap, setBoxerMap] = useState<Map<number, Boxer>>(new Map());
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [titles, federations, gym] = await Promise.all([
        getAllTitles(),
        getAllFederations(),
        getGym(),
      ]);

      // Collect all unique boxer IDs across all reigns
      const boxerIds = new Set<number>();
      for (const title of titles) {
        for (const reign of title.reigns) {
          boxerIds.add(reign.boxerId);
        }
      }

      const boxers = await Promise.all([...boxerIds].map(id => getBoxer(id)));
      const map = new Map<number, Boxer>();
      for (const b of boxers) {
        if (b && b.id !== undefined) map.set(b.id, b);
      }

      // Sort federations: prestige desc, IBF last
      federations.sort((a, b) => {
        if (a.name === 'International Boxing Federation') return 1;
        if (b.name === 'International Boxing Federation') return -1;
        return b.prestige - a.prestige;
      });

      // Group titles by federation, sorted by weight class order
      const groups: FedGroup[] = federations.map(fed => {
        const fedTitles = titles
          .filter(t => t.federationId === fed.id)
          .sort((a, b) =>
            WEIGHT_CLASS_ORDER.indexOf(a.weightClass) - WEIGHT_CLASS_ORDER.indexOf(b.weightClass)
          );
        return { federation: fed, titles: fedTitles };
      }).filter(g => g.titles.length > 0);

      if (cancelled) return;
      setFedGroups(groups);
      setBoxerMap(map);
      setToday(gym?.currentDate ?? '');
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Championship History" subtitle="All title reigns by federation" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Championship History" subtitle="All title reigns by federation" />
      <div className={styles.page}>
        {fedGroups.map(({ federation, titles }) => {
          const abbr = FEDERATION_ABBR[federation.name] ?? federation.name;
          return (
            <div key={federation.id} className={styles.fedSection}>
              <h2 className={styles.fedTitle}>{federation.name}</h2>
              {titles.map(title => {
                const cardTitle = `${abbr} ${capitalize(title.weightClass)} Championship`;
                // Reverse so newest reign is first
                const reigns = [...title.reigns].reverse();
                return (
                  <div
                    key={title.id}
                    id={`title-${title.id}`}
                    className={styles.titleCard}
                  >
                    <div className={styles.cardHeader}>{cardTitle}</div>
                    {reigns.length === 0 ? (
                      <p className={styles.empty}>No recorded reigns yet.</p>
                    ) : (
                      <>
                        <div className={styles.reignHeader}>
                          <span>Boxer</span>
                          <span>Date Won</span>
                          <span>Date Lost</span>
                          <span>Days</span>
                          <span>Defenses</span>
                        </div>
                        {reigns.map((reign, i) => {
                          const boxer = boxerMap.get(reign.boxerId);
                          const isCurrent = reign.dateLost === null;
                          const dateLostDisplay = isCurrent ? today : reign.dateLost!;
                          const days = diffDays(reign.dateWon, dateLostDisplay);
                          const rowClass = isCurrent ? styles.reignCurrent : styles.reignRow;
                          const boxerName = boxer?.name ?? 'Unknown Boxer';

                          return (
                            <div key={i} className={rowClass}>
                              <span>
                                {boxer?.id !== undefined ? (
                                  <Link to={`/player/${boxer.id}`} className={styles.boxerLink}>
                                    {boxerName}
                                  </Link>
                                ) : boxerName}
                              </span>
                              <span>{reign.dateWon}</span>
                              <span>
                                {isCurrent
                                  ? <span className={styles.currentBadge}>Current</span>
                                  : reign.dateLost}
                              </span>
                              <span>{days}</span>
                              <span>{reign.defenseCount}</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/jefsu/Documents/workspace/boxing-manager && npm run build 2>&1 | grep "ChampionshipHistory"`
Expected: no output (no errors from the new file). Pre-existing errors in other files are fine.

- [ ] **Step 3: Commit**

```bash
git -C /Users/jefsu/Documents/workspace/boxing-manager add src/pages/League/ChampionshipHistory.tsx
git -C /Users/jefsu/Documents/workspace/boxing-manager commit -m "feat: add ChampionshipHistory page component"
```

---

### Task 3: Register route and add sidebar link

**Files:**
- Modify: `src/routes.tsx`
- Modify: `src/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Read both files**

Read `src/routes.tsx` and `src/components/Sidebar/Sidebar.tsx` to confirm current content before editing.

- [ ] **Step 2: Add import and route to `routes.tsx`**

In `src/routes.tsx`, add the import after the existing `Standings` import line:

```tsx
import ChampionshipHistory from './pages/League/ChampionshipHistory';
```

Then add the route inside the `/league` children array, after `{ path: 'results', element: <RecentResults /> }`:

```tsx
{ path: 'championship-history', element: <ChampionshipHistory /> },
```

- [ ] **Step 3: Add sidebar link to `Sidebar.tsx`**

In `src/components/Sidebar/Sidebar.tsx`, add the new link to the `/league` section links array after `{ to: '/league/results', label: 'Results' }`:

```ts
{ to: '/league/championship-history', label: 'Championship History' },
```

The full updated `/league` section should look like:

```ts
'/league': [
  {
    label: 'League',
    links: [
      { to: '/league/standings', label: 'Standings' },
      { to: '/league/calendar', label: 'Calendar' },
      { to: '/league/results', label: 'Results' },
      { to: '/league/championship-history', label: 'Championship History' },
      { to: '/league/schedule', label: 'Schedule' },
    ],
  },
],
```

- [ ] **Step 4: Verify build compiles**

Run: `cd /Users/jefsu/Documents/workspace/boxing-manager && npm run build 2>&1 | grep -E "ChampionshipHistory|error TS2304" | head -10`
Expected: no output (no new errors).

- [ ] **Step 5: Commit**

```bash
git -C /Users/jefsu/Documents/workspace/boxing-manager add src/routes.tsx src/components/Sidebar/Sidebar.tsx
git -C /Users/jefsu/Documents/workspace/boxing-manager commit -m "feat: register championship-history route and sidebar link"
```

---

### Task 4: Update player page title badge to link to belt section

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`
- Modify: `src/pages/Player/PlayerPage.module.css`

**Context:** In `PlayerPage.tsx` around line 242–248, the active title badges are rendered:

```tsx
{activeTitles.map(t => {
  const info = titleFedMap.get(t.titleId);
  const label = info
    ? `${info.abbr} ${capitalize(info.weightClass)} Champion`
    : 'Champion';
  return <span key={t.titleId} className={styles.titleBadge}>{label}</span>;
})}
```

`titleFedMap` is a `Map<number, { abbr: string; weightClass: string }>` keyed by `titleId`. The `Link` component is already imported at the top of `PlayerPage.tsx` (`import { useParams, Link } from 'react-router'`).

- [ ] **Step 1: Read `PlayerPage.tsx` lines 240–256 and `PlayerPage.module.css` lines 46–55**

Confirm the exact current content of the title badge rendering and the `.titleBadge` CSS rule before editing.

- [ ] **Step 2: Replace `<span>` badge with `<Link>` in `PlayerPage.tsx`**

Replace the entire `activeTitles.map` block:

```tsx
{activeTitles.map(t => {
  const info = titleFedMap.get(t.titleId);
  const label = info
    ? `${info.abbr} ${capitalize(info.weightClass)} Champion`
    : 'Champion';
  return <span key={t.titleId} className={styles.titleBadge}>{label}</span>;
})}
```

With:

```tsx
{activeTitles.map(t => {
  const info = titleFedMap.get(t.titleId);
  const label = info
    ? `${info.abbr} ${capitalize(info.weightClass)} Champion`
    : 'Champion';
  return (
    <Link
      key={t.titleId}
      to={`/league/championship-history#title-${t.titleId}`}
      className={styles.titleBadge}
    >
      {label}
    </Link>
  );
})}
```

- [ ] **Step 3: Add `text-decoration: none` to `.titleBadge` in `PlayerPage.module.css`**

The current `.titleBadge` rule is:

```css
.titleBadge {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 2px;
  padding: 2px 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

Add `text-decoration: none;` and `display: inline-block;` to it so the link renders identically to the old span:

```css
.titleBadge {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 2px;
  padding: 2px 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-decoration: none;
  display: inline-block;
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/jefsu/Documents/workspace/boxing-manager && npm run build 2>&1 | grep "PlayerPage" | head -10`
Expected: no output (no new errors from PlayerPage).

- [ ] **Step 5: Commit**

```bash
git -C /Users/jefsu/Documents/workspace/boxing-manager add src/pages/Player/PlayerPage.tsx src/pages/Player/PlayerPage.module.css
git -C /Users/jefsu/Documents/workspace/boxing-manager commit -m "feat: link player title badge to championship history section"
```

---

## Self-Review

**Spec coverage:**
- ✅ Page at `/league/championship-history` — Task 2
- ✅ Federations sorted prestige desc, IBF last — Task 2 (`federations.sort`)
- ✅ Weight classes in fixed order — Task 2 (`WEIGHT_CLASS_ORDER`)
- ✅ Each title card has `id="title-{titleId}"` for anchor scrolling — Task 2
- ✅ Card header: `{abbr} {weightClass} Championship` — Task 2
- ✅ Empty state: "No recorded reigns yet." — Task 2
- ✅ Reign table columns: Boxer, Date Won, Date Lost, Days, Defenses — Task 2
- ✅ Newest reign first (reverse chronological) — Task 2 (`[...title.reigns].reverse()`)
- ✅ Current champion row highlighted with accent border — Task 1 (`.reignCurrent`)
- ✅ Days column uses `gym.currentDate` for ongoing reigns — Task 2 (`diffDays`)
- ✅ Missing boxer shows "Unknown Boxer" with no link — Task 2 (`boxer?.id !== undefined` guard)
- ✅ Boxer names link to `/player/:id` — Task 2
- ✅ Sidebar link added — Task 3
- ✅ Route registered — Task 3
- ✅ Player page badge becomes `<Link>` to `#title-{titleId}` — Task 4
- ✅ Badge CSS unchanged visually (`text-decoration: none`, `display: inline-block`) — Task 4

**Placeholder scan:** No TBDs, TODOs, or vague steps. All code blocks are complete.

**Type consistency:**
- `FedGroup` defined and used consistently across Task 2
- `diffDays(from, to)` defined and called with `(reign.dateWon, dateLostDisplay)` — correct
- `WEIGHT_CLASS_ORDER` typed as `WeightClass[]` — matches `Title.weightClass: WeightClass`
- `boxerMap` is `Map<number, Boxer>` keyed by `boxer.id` — `reign.boxerId` is `number` — correct lookup
- `titleFedMap` keyed by `titleId: number` in PlayerPage — `t.titleId` is `number` — correct
