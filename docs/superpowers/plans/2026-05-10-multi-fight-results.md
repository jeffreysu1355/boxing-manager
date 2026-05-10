# Multi-Fight Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When multiple gym fights happen on the same day and the user sims them, show all results in a banner summary and on a new multi-fight results page.

**Architecture:** After `handleSimFight` resolves all fights, collect the simmed fight IDs, show a compact per-fight summary line in the TopNav banner, and navigate to `/fight-results?fights=1,2,3`. A new `FightResultsPage` fetches each fight and renders a result card per fight (reusing the same display logic as the existing `FightPage`). The existing `/fight/:fightId` detail page is unchanged.

**Tech Stack:** React 18, React Router v7, TypeScript, CSS Modules, IndexedDB via `idb`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/pages/Fight/FightResultsPage.tsx` | Multi-fight results page — fetches N fights by IDs from query param, renders a card per fight |
| Create | `src/pages/Fight/FightResultsPage.module.css` | Scoped styles for the results page |
| Modify | `src/routes.tsx` | Add route `fight-results` → `FightResultsPage` |
| Modify | `src/components/TopNav/TopNav.tsx` | Collect simmed fight IDs into new `simmedFights` state; render per-fight summary lines in banner; navigate to `/fight-results?fights=…` |
| Modify | `src/components/TopNav/TopNav.module.css` | Add `.fightResultLine` and `.fightResultDivider` styles for banner rows |

---

### Task 1: Create `FightResultsPage` component

**Files:**
- Create: `src/pages/Fight/FightResultsPage.tsx`
- Create: `src/pages/Fight/FightResultsPage.module.css`

- [ ] **Step 1: Create the CSS module**

Create `src/pages/Fight/FightResultsPage.module.css` with this content:

```css
.page {
  padding: 32px 24px;
  max-width: 640px;
}

.title {
  margin: 0 0 4px;
  font-size: 20px;
}

.subtitle {
  margin: 0 0 24px;
  color: var(--text-secondary);
  font-size: 13px;
}

.card {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 20px 24px;
  margin-bottom: 16px;
}

.cardHeader {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.cardMeta {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.resultLabel {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.resultLine {
  font-size: 16px;
  font-weight: 600;
}

.resultDetail {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.boxerLinks {
  margin-top: 14px;
  display: flex;
  gap: 16px;
}

.boxerLink {
  color: var(--accent);
  font-size: 13px;
}

.empty {
  color: var(--text-secondary);
  font-size: 14px;
}

.backBtn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  padding: 0;
  font-size: 13px;
  margin-bottom: 16px;
}
```

- [ ] **Step 2: Create `FightResultsPage.tsx`**

Create `src/pages/Fight/FightResultsPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { getFight } from '../../db/fightStore';
import { getBoxer } from '../../db/boxerStore';
import type { Fight, Boxer } from '../../db/db';
import styles from './FightResultsPage.module.css';

interface FightEntry {
  fight: Fight;
  boxers: Map<number, Boxer>;
}

function resultLine(fight: Fight, boxers: Map<number, Boxer>): string {
  const boxerName = (id: number | undefined) =>
    id !== undefined ? (boxers.get(id)?.name ?? `Boxer #${id}`) : '—';

  if (fight.method === 'Draw') return `Draw — ${fight.method}`;
  if (fight.winnerId === null) return 'Result pending';

  const winnerName = boxerName(fight.winnerId);
  const isDecision = fight.method === 'Decision' || fight.method === 'Split Decision';
  if (isDecision) return `${winnerName} wins by ${fight.method}`;

  const move = fight.finishingMove ? ` (${fight.finishingMove})` : '';
  const timing = fight.round != null ? ` — Rd. ${fight.round}` : '';
  const time = fight.time ? ` (${fight.time})` : '';
  return `${winnerName} wins by ${fight.method}${move}${timing}${time}`;
}

function resultDetail(fight: Fight): string | null {
  const isDecision = fight.method === 'Decision' || fight.method === 'Split Decision';
  const isDraw = fight.method === 'Draw';
  if (isDecision || isDraw || fight.winnerId === null) return null;

  const parts: string[] = [fight.method];
  if (fight.finishingMove) parts.push(fight.finishingMove);
  if (fight.round != null) parts.push(`Round ${fight.round}`);
  if (fight.time) parts.push(fight.time);
  return parts.join(' · ');
}

export default function FightResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = (searchParams.get('fights') ?? '')
      .split(',')
      .map(Number)
      .filter(n => !isNaN(n) && n > 0);

    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    async function load() {
      const results: FightEntry[] = [];
      for (const id of ids) {
        const fight = await getFight(id);
        if (!fight) continue;
        const boxerEntries = await Promise.all(
          fight.boxerIds.map(async bid => {
            const b = await getBoxer(bid);
            return b ? ([bid, b] as [number, Boxer]) : null;
          })
        );
        const map = new Map<number, Boxer>();
        for (const entry of boxerEntries) {
          if (entry) map.set(entry[0], entry[1]);
        }
        results.push({ fight, boxers: map });
      }
      setEntries(results);
      setLoading(false);
    }

    load();
  }, [searchParams]);

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>
        &larr; Back
      </button>
      <h2 className={styles.title}>Fight Results</h2>
      <p className={styles.subtitle}>
        {entries.length > 0 ? entries[0].fight.date : '—'}
      </p>

      {loading && <p className={styles.empty}>Loading…</p>}

      {!loading && entries.length === 0 && (
        <p className={styles.empty}>No fight results found.</p>
      )}

      {entries.map(({ fight, boxers }) => {
        const [b1Id, b2Id] = fight.boxerIds;
        const b1 = boxers.get(b1Id);
        const b2 = b2Id !== undefined ? boxers.get(b2Id) : undefined;
        const name = (id: number | undefined, b: Boxer | undefined) =>
          b?.name ?? (id !== undefined ? `Boxer #${id}` : '—');
        const detail = resultDetail(fight);

        return (
          <div key={fight.id} className={styles.card}>
            <div className={styles.cardHeader}>
              {name(b1Id, b1)} vs. {name(b2Id, b2)}
            </div>
            <div className={styles.cardMeta}>
              {fight.isTitleFight && (
                <span style={{ color: 'var(--accent)', fontWeight: 600, marginRight: 8 }}>
                  Title Fight ·
                </span>
              )}
              <Link
                to={`/fight/${fight.id}`}
                style={{ color: 'var(--text-secondary)', fontSize: 12 }}
              >
                View Details →
              </Link>
            </div>
            <div className={styles.resultLabel}>Result</div>
            <div className={styles.resultLine}>{resultLine(fight, boxers)}</div>
            {detail && <div className={styles.resultDetail}>{detail}</div>}
            <div className={styles.boxerLinks}>
              {b1 && b1.id !== undefined && (
                <Link to={`/player/${b1.id}`} className={styles.boxerLink}>{b1.name}</Link>
              )}
              {b2 && b2.id !== undefined && (
                <Link to={`/player/${b2.id}`} className={styles.boxerLink}>{b2.name}</Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Fight/FightResultsPage.tsx src/pages/Fight/FightResultsPage.module.css
git commit -m "feat: add FightResultsPage for multi-fight result display"
```

---

### Task 2: Register the route

**Files:**
- Modify: `src/routes.tsx`

- [ ] **Step 1: Add the import and route**

In `src/routes.tsx`, add the import after the existing `FightPage` import (line 6):

```tsx
import FightResultsPage from './pages/Fight/FightResultsPage';
```

Then add the route after `{ path: 'fight/:fightId', element: <FightPage /> }` (line 34):

```tsx
{ path: 'fight-results', element: <FightResultsPage /> },
```

- [ ] **Step 2: Verify the dev server compiles without errors**

Run: `npm run build 2>&1 | tail -20`
Expected: no TypeScript errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/routes.tsx
git commit -m "feat: register /fight-results route"
```

---

### Task 3: Update TopNav — collect simmed fight IDs and update navigation

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`

This task replaces the `firstSimmedFightId` + single `navigate` pattern with a list of all simmed fight IDs, then navigates to `/fight-results?fights=1,2,3`.

- [ ] **Step 1: Add `simmedFights` state**

In `TopNav.tsx`, find the existing state declarations (around line 66–68). Add a new state after `rankChanges`:

```tsx
const [simmedFights, setSimmedFights] = useState<Array<{ fightId: number; winnerId: number | null; loserId: number; method: string; finishingMove: string | null; round: number | null; time: string | null; boxer1Name: string; boxer2Name: string }>>([]);
```

Also add a clear in `handleSimFight` at the top where `rankChanges` is cleared (around line 240):

```tsx
setSimmedFights([]);
```

- [ ] **Step 2: Collect fight summaries during the loop**

Inside `handleSimFight`, the loop processes each fight. After the `applyFightResult` call and before the `setRankChanges` update, add this block (after line 287):

```tsx
const [wBoxer, lBoxer] = await Promise.all([
  getBoxer(simResult.winnerId),
  getBoxer(simResult.loserId),
]);
setSimmedFights(prev => [...prev, {
  fightId: fight.id!,
  winnerId: simResult.winnerId,
  loserId: simResult.loserId,
  method: simResult.method,
  finishingMove: simResult.finishingMove,
  round: simResult.round,
  time: simResult.time,
  boxer1Name: wBoxer?.name ?? `Boxer #${simResult.winnerId}`,
  boxer2Name: lBoxer?.name ?? `Boxer #${simResult.loserId}`,
}]);
```

- [ ] **Step 3: Replace navigation to single fight with navigation to fight-results**

Find the block near the end of `handleSimFight` (around line 327–329):

```tsx
if (firstSimmedFightId !== null) {
  navigate(`/fight/${firstSimmedFightId}`);
}
```

Remove that block and the `firstSimmedFightId` variable (lines 247–254 that declare and set it). Replace the navigation with:

```tsx
// navigation happens via the banner "View Results" button — no auto-navigate here
```

(No navigation on sim complete — user clicks the banner link instead. This avoids jarring page changes mid-sim.)

The complete updated `handleSimFight` after removing `firstSimmedFightId` will have its loop starting:

```tsx
for (const event of todayFights) {
  const fight = await getFight(event.fightId);
  if (!fight || fight.winnerId !== null) continue;
  // ... rest of loop unchanged except no firstSimmedFightId tracking
```

- [ ] **Step 4: Clear `simmedFights` in `handleSim` alongside other state resets**

In `handleSim` (around line 145–146 where `setFightStop(null)` and `setRankChanges([])` are called):

```tsx
setFightStop(null);
setRankChanges([]);
setSimmedFights([]);
```

- [ ] **Step 5: Commit**

```bash
git add src/components/TopNav/TopNav.tsx
git commit -m "feat: collect simmed fight summaries in TopNav state"
```

---

### Task 4: Render fight summaries in the TopNav banner

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`
- Modify: `src/components/TopNav/TopNav.module.css`

- [ ] **Step 1: Add CSS classes for fight result lines in the banner**

In `src/components/TopNav/TopNav.module.css`, add after the existing `.rankChangeDemoted` block:

```css
.fightResultsSection {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.fightResultLine {
  font-size: 12px;
  color: #fff;
}

.fightResultDivider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  margin: 4px 0;
}

.viewResultsBtn {
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  text-decoration: underline;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-top: 4px;
  text-align: left;
}
```

- [ ] **Step 2: Render the fight summary banner**

In `src/components/TopNav/TopNav.tsx`, locate the existing rank-change banner block (around line 404). Add a new banner block **above** it (after the `fightStop` banner, before the `rankChanges` banner):

```tsx
{simmedFights.length > 0 && (
  <div className={styles.fightBanner}>
    <div className={styles.fightResultsSection}>
      <strong>Fight Day Results</strong>
      {simmedFights.map((f, i) => {
        const isDecision = f.method === 'Decision' || f.method === 'Split Decision';
        const winnerName = f.winnerId !== null
          ? (f.boxer1Name) // boxer1Name is always the winner (set from wBoxer in the loop)
          : '—';
        const summary = f.winnerId === null
          ? `Draw — ${f.method}`
          : isDecision
            ? `${winnerName} wins by ${f.method}`
            : `${winnerName} wins by ${f.method}${f.finishingMove ? ` (${f.finishingMove})` : ''}${f.round != null ? ` — Rd. ${f.round}` : ''}`;
        return (
          <div key={f.fightId}>
            {i > 0 && <hr className={styles.fightResultDivider} />}
            <div className={styles.fightResultLine}>{summary}</div>
          </div>
        );
      })}
      <button
        className={styles.viewResultsBtn}
        onClick={() => navigate(`/fight-results?fights=${simmedFights.map(f => f.fightId).join(',')}`)}
      >
        View Full Results →
      </button>
    </div>
    <button className={styles.dismissBtn} onClick={() => setSimmedFights([])}>Dismiss</button>
  </div>
)}
```

- [ ] **Step 3: Verify in the browser**

Run `npm run dev`, start a game, schedule 2+ fights on the same day, sim them. Confirm:
- The banner shows each fight result on its own line with a divider between fights
- "View Full Results →" navigates to `/fight-results?fights=X,Y`
- The `FightResultsPage` shows a card per fight
- Each card's "View Details →" link opens the existing `/fight/:id` page
- The rank change banner still appears below the fight results banner
- "Dismiss" on each banner dismisses only that banner

- [ ] **Step 4: Commit**

```bash
git add src/components/TopNav/TopNav.tsx src/components/TopNav/TopNav.module.css
git commit -m "feat: show multi-fight result banner and link to fight-results page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Multiple fights on same day show results in banner with separation — Task 4 renders one line per fight with `<hr>` dividers
- ✅ Banner shows fight results after sim — Tasks 3 & 4
- ✅ New fight results page shows all fights from that sim — Task 1
- ✅ Individual fight detail still accessible — "View Details →" link on each card in FightResultsPage

**Placeholder scan:**
- No TBDs or TODOs
- All code blocks are complete

**Type consistency:**
- `simmedFights` state shape defined in Task 3 Step 1, used identically in Task 3 Step 2 and Task 4 Step 2
- `boxer1Name` is always the winner's name (set from `wBoxer` which is `getBoxer(simResult.winnerId)`) — this is noted inline in Task 4 Step 2 to avoid confusion
- `FightEntry` interface in FightResultsPage matches what `getFight` + `getBoxer` return from `db.ts`
- `resultLine` / `resultDetail` in FightResultsPage use `fight.method`, `fight.winnerId`, `fight.finishingMove`, `fight.round`, `fight.time` — all present on the `Fight` type in `db.ts`
