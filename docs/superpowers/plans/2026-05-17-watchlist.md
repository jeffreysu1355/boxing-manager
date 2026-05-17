# Watchlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-gym watchlist that lets the user flag any boxer (gym member or not) for easy tracking, accessible via a new Watchlist page under Players.

**Architecture:** `watchlistIds` is stored as an optional field on the existing `Gym` object in IndexedDB — no new store, no DB version bump. Two helpers in `gymStore.ts` handle add/remove. A shared `WatchlistFlag` component renders the flag button in any context. The Watchlist page at `/players/watchlist` mirrors the Roster table layout.

**Tech Stack:** React 18 + TypeScript, IndexedDB via `idb`, CSS Modules, React Router v7

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `src/db/db.ts` | Add `watchlistIds?: number[]` to `Gym` interface |
| Modify | `src/db/gymStore.ts` | Add `addToWatchlist` / `removeFromWatchlist` helpers |
| Create | `src/components/WatchlistFlag/WatchlistFlag.tsx` | Reusable flag button component |
| Create | `src/components/WatchlistFlag/WatchlistFlag.module.css` | Flag button styles |
| Create | `src/pages/Players/Watchlist.tsx` | Watchlist page |
| Create | `src/pages/Players/Watchlist.module.css` | Watchlist page styles |
| Modify | `src/pages/Player/PlayerPage.tsx` | Add flag button to boxer header |
| Modify | `src/components/Sidebar/Sidebar.tsx` | Add Watchlist link under Players |
| Modify | `src/routes.tsx` | Register `/players/watchlist` route |

---

## Task 1: Add `watchlistIds` to `Gym` type and gymStore helpers

**Files:**
- Modify: `src/db/db.ts`
- Modify: `src/db/gymStore.ts`

- [ ] **Step 1: Add field to `Gym` interface in `src/db/db.ts`**

Find the `Gym` interface (around line 178) and add the optional field:

```ts
export interface Gym {
  id?: number;
  name: string;
  level: number;
  balance: number;
  rosterIds: number[];
  currentDate: string;
  recruitRefreshDate?: string;
  godModeEnabled?: boolean;
  watchlistIds?: number[];  // add this line
}
```

- [ ] **Step 2: Add helpers to `src/db/gymStore.ts`**

Append these two functions to the file:

```ts
export async function addToWatchlist(boxerId: number): Promise<void> {
  const gym = await getGym();
  if (!gym) return;
  const ids = gym.watchlistIds ?? [];
  if (ids.includes(boxerId)) return;
  await saveGym({ ...gym, watchlistIds: [...ids, boxerId] });
}

export async function removeFromWatchlist(boxerId: number): Promise<void> {
  const gym = await getGym();
  if (!gym) return;
  const ids = gym.watchlistIds ?? [];
  await saveGym({ ...gym, watchlistIds: ids.filter(id => id !== boxerId) });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/db.ts src/db/gymStore.ts
git commit -m "feat: add watchlistIds to Gym type and gymStore helpers"
```

---

## Task 2: Create `WatchlistFlag` component

**Files:**
- Create: `src/components/WatchlistFlag/WatchlistFlag.tsx`
- Create: `src/components/WatchlistFlag/WatchlistFlag.module.css`

- [ ] **Step 1: Create the CSS module at `src/components/WatchlistFlag/WatchlistFlag.module.css`**

```css
.flag {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 14px;
  line-height: 1;
  opacity: 0.35;
  transition: opacity 0.1s, color 0.1s;
  color: var(--text-secondary);
}

.flag:hover {
  opacity: 0.7;
}

.flagActive {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 14px;
  line-height: 1;
  opacity: 1;
  transition: opacity 0.1s, color 0.1s;
}

.flagActive:hover {
  opacity: 0.7;
}

.flagGreen {
  color: var(--success);
}

.flagRed {
  color: var(--danger);
}
```

- [ ] **Step 2: Create the component at `src/components/WatchlistFlag/WatchlistFlag.tsx`**

```tsx
import styles from './WatchlistFlag.module.css';

interface WatchlistFlagProps {
  isWatchlisted: boolean;
  isOwnGym: boolean;
  onToggle: () => void;
}

export function WatchlistFlag({ isWatchlisted, isOwnGym, onToggle }: WatchlistFlagProps) {
  if (!isWatchlisted) {
    return (
      <button
        type="button"
        className={styles.flag}
        title="Add to watchlist"
        onClick={onToggle}
      >
        🏴
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.flagActive} ${isOwnGym ? styles.flagGreen : styles.flagRed}`}
      title="Remove from watchlist"
      onClick={onToggle}
    >
      🏴
    </button>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/WatchlistFlag/WatchlistFlag.tsx src/components/WatchlistFlag/WatchlistFlag.module.css
git commit -m "feat: add WatchlistFlag component"
```

---

## Task 3: Add flag to `PlayerPage`

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`

- [ ] **Step 1: Import new helpers and component**

At the top of `src/pages/Player/PlayerPage.tsx`, add these imports after the existing gymStore import:

```ts
import { getGym, addToWatchlist, removeFromWatchlist } from '../../db/gymStore';
import { WatchlistFlag } from '../../components/WatchlistFlag/WatchlistFlag';
```

Note: `getGym` is already imported — only add `addToWatchlist` and `removeFromWatchlist` to the existing import and add the `WatchlistFlag` import as a new line.

- [ ] **Step 2: Add watchlist state**

Inside the `PlayerPage` component, after the existing `const [gymId, setGymId] = useState<number | null>(null);` line, add:

```ts
const [watchlistIds, setWatchlistIds] = useState<number[]>([]);
```

- [ ] **Step 3: Load watchlistIds on mount**

Inside the `load` function in the `useEffect`, the gym is already fetched:
```ts
const [b, coaches, gym] = await Promise.all([getBoxer(Number(id)), getAllCoaches(), getGym()]);
```

After `setGymId(gym?.id ?? null);` add:

```ts
setWatchlistIds(gym?.watchlistIds ?? []);
```

- [ ] **Step 4: Add toggle handler**

After `handleRetire`, add:

```ts
async function handleToggleWatchlist() {
  if (!boxer || boxer.id === undefined) return;
  const id = boxer.id;
  if (watchlistIds.includes(id)) {
    await removeFromWatchlist(id);
    setWatchlistIds(prev => prev.filter(x => x !== id));
  } else {
    await addToWatchlist(id);
    setWatchlistIds(prev => [...prev, id]);
  }
}
```

- [ ] **Step 5: Render the flag button in the boxer header**

Find the JSX block that renders `{boxer.gymId === gymId && gymId !== null && !boxer.retired && (` (the Retire Boxer button block, around line 281). Directly above that block, insert the flag:

```tsx
{boxer.id !== undefined && (
  <div style={{ marginBottom: 8 }}>
    <WatchlistFlag
      isWatchlisted={watchlistIds.includes(boxer.id)}
      isOwnGym={boxer.gymId === gymId && gymId !== null}
      onToggle={handleToggleWatchlist}
    />
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Player/PlayerPage.tsx
git commit -m "feat: add watchlist flag to PlayerPage"
```

---

## Task 4: Create Watchlist page

**Files:**
- Create: `src/pages/Players/Watchlist.tsx`
- Create: `src/pages/Players/Watchlist.module.css`

- [ ] **Step 1: Create CSS module at `src/pages/Players/Watchlist.module.css`**

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.empty {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}

.loading {
  color: var(--text-secondary);
  font-style: italic;
}

.flagCell {
  width: 28px;
  text-align: center;
}
```

- [ ] **Step 2: Create `src/pages/Players/Watchlist.tsx`**

The Watchlist page loads the gym's `watchlistIds`, fetches those boxers, and renders them in the same style as the Roster table. It reuses `getBoxerStatus`, `getNextFight`, `calcRecord`, `styleLabel`, `capitalize` helpers exported from `Roster.tsx`.

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { WatchlistFlag } from '../../components/WatchlistFlag/WatchlistFlag';
import { getGym, removeFromWatchlist } from '../../db/gymStore';
import { getAllBoxers } from '../../db/boxerStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllFights } from '../../db/fightStore';
import { getAllFederations } from '../../db/federationStore';
import {
  getBoxerStatus,
  getNextFight,
  calcRecord,
  capitalize,
} from '../Gym/Roster';
import { RANK_CONFIG } from '../../lib/rankSystem';
import type { Boxer, CalendarEvent, Fight, Federation } from '../../db/db';
import styles from './Watchlist.module.css';
import rosterStyles from '../Gym/Roster.module.css';

function RankMiniBar({ boxer }: { boxer: Boxer }) {
  const config = RANK_CONFIG[boxer.reputation];
  const rankPoints = boxer.rankPoints ?? 0;
  const demotionBuffer = boxer.demotionBuffer ?? config.bufferMax;
  const progressPct = config.promotionThreshold === Infinity
    ? 100
    : Math.min(100, (rankPoints / config.promotionThreshold) * 100);
  const bufferPct = Math.min(100, (demotionBuffer / config.bufferMax) * 100);
  const tooltip = config.promotionThreshold === Infinity
    ? `${boxer.reputation} · Buffer: ${demotionBuffer} / ${config.bufferMax}`
    : `${rankPoints} / ${config.promotionThreshold} pts to next rank · Buffer: ${demotionBuffer} / ${config.bufferMax}`;

  return (
    <div className={rosterStyles.rankCell} title={tooltip}>
      <span className={rosterStyles.rankLabel}>{boxer.reputation}</span>
      <div className={rosterStyles.rankBarTrack}>
        <div className={rosterStyles.rankBarFill} style={{ width: `${progressPct}%` }} />
      </div>
      <div className={rosterStyles.rankBarTrack}>
        <div className={rosterStyles.bufferBarFill} style={{ width: `${bufferPct}%` }} />
      </div>
    </div>
  );
}

const WEIGHT_ORDER = ['flyweight', 'lightweight', 'welterweight', 'middleweight', 'heavyweight'];

export default function Watchlist() {
  const [boxers, setBoxers] = useState<Boxer[]>([]);
  const [watchlistIds, setWatchlistIds] = useState<number[]>([]);
  const [gymId, setGymId] = useState<number | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [fightsMap, setFightsMap] = useState<Map<number, Fight>>(new Map());
  const [federationsMap, setFederationsMap] = useState<Map<number, Federation>>(new Map());
  const [boxersMap, setBoxersMap] = useState<Map<number, Boxer>>(new Map());
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gym, allBoxers, allEvents, allFights, allFederations] = await Promise.all([
        getGym(),
        getAllBoxers(),
        getAllCalendarEvents(),
        getAllFights(),
        getAllFederations(),
      ]);

      if (cancelled) return;

      const ids = gym?.watchlistIds ?? [];
      const watched = allBoxers
        .filter(b => b.id !== undefined && ids.includes(b.id))
        .sort((a, b) => {
          const wi = WEIGHT_ORDER.indexOf(a.weightClass) - WEIGHT_ORDER.indexOf(b.weightClass);
          return wi !== 0 ? wi : a.name.localeCompare(b.name);
        });

      const bMap = new Map<number, Boxer>();
      for (const b of allBoxers) {
        if (b.id !== undefined) bMap.set(b.id, b);
      }

      const fMap = new Map<number, Fight>();
      for (const f of allFights) {
        if (f.id !== undefined) fMap.set(f.id, f);
      }

      const fedMap = new Map<number, Federation>();
      for (const fed of allFederations) {
        if (fed.id !== undefined) fedMap.set(fed.id, fed);
      }

      setWatchlistIds(ids);
      setGymId(gym?.id ?? null);
      setBoxers(watched);
      setEvents(allEvents);
      setFightsMap(fMap);
      setFederationsMap(fedMap);
      setBoxersMap(bMap);
      setToday(gym?.currentDate ?? '');
      setLoading(false);
    }

    load();
    window.addEventListener('game:sim', load);
    return () => {
      cancelled = true;
      window.removeEventListener('game:sim', load);
    };
  }, []);

  async function handleRemove(boxerId: number) {
    await removeFromWatchlist(boxerId);
    setWatchlistIds(prev => prev.filter(id => id !== boxerId));
    setBoxers(prev => prev.filter(b => b.id !== boxerId));
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Watchlist" subtitle="Boxers you're tracking" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Watchlist" subtitle="Boxers you're tracking" />
      <div className={styles.page}>
        {boxers.length === 0 ? (
          <p className={styles.empty}>No boxers on your watchlist yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th className={styles.flagCell}></th>
                <th>Name</th>
                <th>Weight Class</th>
                <th>Record</th>
                <th>Reputation</th>
                <th>Rank</th>
                <th>Status</th>
                <th>Next Fight</th>
              </tr>
            </thead>
            <tbody>
              {boxers.map(boxer => {
                const status = getBoxerStatus(boxer, events, today);
                const nextFight = getNextFight(boxer, events, fightsMap, federationsMap, today, boxersMap);
                const isOwnGym = boxer.gymId === gymId && gymId !== null;

                return (
                  <tr key={boxer.id}>
                    <td className={styles.flagCell}>
                      <WatchlistFlag
                        isWatchlisted={true}
                        isOwnGym={isOwnGym}
                        onToggle={() => handleRemove(boxer.id!)}
                      />
                    </td>
                    <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                    <td>{capitalize(boxer.weightClass)}</td>
                    <td>{calcRecord(boxer.record)}</td>
                    <td>{boxer.reputation}</td>
                    <td><RankMiniBar boxer={boxer} /></td>
                    <td>
                      <span
                        className={rosterStyles.statusBadge}
                        style={{ backgroundColor: status.color }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td>
                      {nextFight
                        ? <span className={rosterStyles.nextFight}>{nextFight}</span>
                        : <span className={rosterStyles.noFight}>—</span>
                      }
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

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Players/Watchlist.tsx src/pages/Players/Watchlist.module.css
git commit -m "feat: add Watchlist page"
```

---

## Task 5: Wire up route and sidebar

**Files:**
- Modify: `src/routes.tsx`
- Modify: `src/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Import Watchlist in `src/routes.tsx`**

Add import after the Compare import:

```ts
import Watchlist from './pages/Players/Watchlist';
```

- [ ] **Step 2: Add route to the players section in `src/routes.tsx`**

Inside the `players` children array, add after the compare route:

```ts
{ path: 'watchlist', element: <Watchlist /> },
```

- [ ] **Step 3: Add sidebar link in `src/components/Sidebar/Sidebar.tsx`**

Find the Players section links array and add the watchlist entry:

```ts
{
  label: 'Players',
  prefix: '/players',
  links: [
    { to: '/players/recruiting', label: 'Recruiting' },
    { to: '/players/coaches', label: 'Coaches' },
    { to: '/players/compare', label: 'Compare' },
    { to: '/players/watchlist', label: 'Watchlist' },  // add this
  ],
},
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes.tsx src/components/Sidebar/Sidebar.tsx
git commit -m "feat: register watchlist route and sidebar link"
```

---

## Task 6: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm run dev
```

- [ ] **Step 2: Verify flag on PlayerPage**

  1. Navigate to any boxer's player page.
  2. Confirm a dim grey flag appears near the top of the page.
  3. Click it — flag should turn green (own gym boxer) or red (non-gym boxer) instantly without page reload.
  4. Click again — flag should return to grey.

- [ ] **Step 3: Verify Watchlist page**

  1. Add 2–3 boxers from different gyms to the watchlist via their player pages.
  2. Navigate to Players > Watchlist.
  3. Confirm all watchlisted boxers appear with correct flag color (green = own gym, red = other).
  4. Click a flag in the Watchlist table — row should disappear immediately.
  5. Navigate away and back — removed boxer should still be gone.

- [ ] **Step 4: Verify empty state**

  1. Remove all boxers from the watchlist.
  2. Confirm "No boxers on your watchlist yet." message appears.
