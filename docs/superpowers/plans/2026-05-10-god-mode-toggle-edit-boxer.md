# God Mode Toggle + Edit Boxer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent god mode toggle to the Tools page that, when enabled, shows an "Edit Boxer" button on the Player page allowing the user to modify any boxer's stats, rank, rankPoints, and demotionBuffer.

**Architecture:** `godModeEnabled` is stored as an optional boolean on the `Gym` record in IndexedDB (no migration needed — optional field, defaults to `false`). The God Mode page reads and writes this flag via `saveGym`. PlayerPage reads the gym on load to conditionally show an "Edit Boxer" link. A new `/player/:id/edit` route renders `EditBoxerPage`, which redirects to `/player/:id` if god mode is off.

**Tech Stack:** React 18, TypeScript, React Router v7, IndexedDB via `idb`, CSS Modules

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/db/db.ts` | Modify | Add `godModeEnabled?: boolean` to `Gym` interface |
| `src/pages/Tools/GodMode.tsx` | Modify | Add god mode toggle button that reads/writes gym |
| `src/pages/Player/PlayerPage.tsx` | Modify | Load gym, show "Edit Boxer" button when god mode on |
| `src/pages/Player/EditBoxerPage.tsx` | Create | Full edit form for stats + ranking; redirects if god mode off |
| `src/routes.tsx` | Modify | Add `/player/:id/edit` route |

---

### Task 1: Add `godModeEnabled` to the Gym interface

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add the field to the Gym interface**

In `src/db/db.ts`, find the `Gym` interface (around line 168) and add `godModeEnabled?: boolean`:

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
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: add godModeEnabled field to Gym interface"
```

---

### Task 2: God Mode toggle on the Tools page

**Files:**
- Modify: `src/pages/Tools/GodMode.tsx`

- [ ] **Step 1: Rewrite GodMode.tsx with the toggle**

Replace the full contents of `src/pages/Tools/GodMode.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym, saveGym } from '../../db/gymStore';

export default function GodMode() {
  const [godMode, setGodMode] = useState<boolean>(false);
  const [restarting, setRestarting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGym().then(gym => {
      setGodMode(gym?.godModeEnabled ?? false);
      setLoading(false);
    });
  }, []);

  async function handleToggle() {
    const gym = await getGym();
    if (!gym) return;
    const next = !godMode;
    await saveGym({ ...gym, godModeEnabled: next });
    setGodMode(next);
  }

  async function handleRestart() {
    if (!confirm('This will wipe all data and start a fresh world. Continue?')) return;
    setRestarting(true);
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('boxing-manager');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
    window.location.href = '/';
  }

  return (
    <div>
      <PageHeader title="God Mode" subtitle="Modify stats, natural talents, and history" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleToggle}
            disabled={loading}
            style={{
              padding: '6px 16px',
              background: godMode ? 'var(--success)' : 'var(--surface, #1a1a2e)',
              color: godMode ? '#000' : 'var(--text-primary)',
              border: '1px solid ' + (godMode ? 'var(--success)' : 'var(--border)'),
              borderRadius: 3,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              minWidth: 120,
            }}
          >
            God Mode: {godMode ? 'ON' : 'OFF'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {godMode ? 'Edit buttons are visible on player pages.' : 'Enable to unlock boxer editing.'}
          </span>
        </div>
        <button
          onClick={handleRestart}
          disabled={restarting}
          style={{
            padding: '6px 16px',
            background: 'var(--danger)',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            fontWeight: 600,
            cursor: restarting ? 'not-allowed' : 'pointer',
            opacity: restarting ? 0.6 : 1,
            alignSelf: 'flex-start',
          }}
        >
          {restarting ? 'Restarting...' : 'Restart'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Tools/GodMode.tsx
git commit -m "feat: add god mode toggle to Tools page"
```

---

### Task 3: Show "Edit Boxer" button on PlayerPage when god mode is on

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`

- [ ] **Step 1: Add gym load to the useEffect in PlayerPage**

In `src/pages/Player/PlayerPage.tsx`, add `getGym` to the imports at the top:

```tsx
import { getGym } from '../../db/gymStore';
```

- [ ] **Step 2: Add `godMode` state and load it alongside the boxer**

Add a new state variable just below the existing `useState` declarations (around line 148):

```tsx
const [godMode, setGodMode] = useState(false);
```

Inside the `load()` async function (which already fetches boxer and coaches), add a `getGym()` call in the existing `Promise.all`:

```tsx
const [b, coaches, gym] = await Promise.all([
  getBoxer(Number(id)),
  getAllCoaches(),
  getGym(),
]);
```

Then after the `if (cancelled) return;` check, add:

```tsx
setGodMode(gym?.godModeEnabled ?? false);
```

- [ ] **Step 3: Add the "Edit Boxer" button below the PageHeader**

In the final `return (...)` block of `PlayerPage`, find this line (around line 216):

```tsx
<PageHeader title={boxer.name} subtitle={boxer.reputation} />
```

Replace it with:

```tsx
<PageHeader title={boxer.name} subtitle={boxer.reputation} />
{godMode && (
  <div style={{ marginBottom: 8 }}>
    <Link
      to={`/player/${boxer.id}/edit`}
      style={{
        display: 'inline-block',
        padding: '5px 14px',
        background: 'var(--accent)',
        color: '#000',
        borderRadius: 3,
        fontWeight: 600,
        fontSize: 13,
        textDecoration: 'none',
      }}
    >
      Edit Boxer
    </Link>
  </div>
)}
```

`Link` is already imported from `'react-router'` in this file.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Player/PlayerPage.tsx
git commit -m "feat: show Edit Boxer button on player page when god mode is enabled"
```

---

### Task 4: Create EditBoxerPage

**Files:**
- Create: `src/pages/Player/EditBoxerPage.tsx`

- [ ] **Step 1: Create EditBoxerPage.tsx**

Create the file `src/pages/Player/EditBoxerPage.tsx` with the following content:

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getBoxer, putBoxer } from '../../db/boxerStore';
import { getGym } from '../../db/gymStore';
import { RANK_CONFIG, REPUTATION_ORDER } from '../../lib/rankSystem';
import type { Boxer, BoxerStats, ReputationLevel } from '../../db/db';

const STAT_GROUPS: { label: string; stats: (keyof BoxerStats)[] }[] = [
  { label: 'Offense',  stats: ['jab', 'cross', 'leadHook', 'rearHook', 'uppercut'] },
  { label: 'Defense',  stats: ['headMovement', 'bodyMovement', 'guard', 'positioning'] },
  { label: 'Mental',   stats: ['timing', 'adaptability', 'discipline'] },
  { label: 'Physical', stats: ['speed', 'power', 'endurance', 'recovery', 'toughness'] },
];

const STAT_LABELS: Record<keyof BoxerStats, string> = {
  jab: 'Jab', cross: 'Cross', leadHook: 'Lead Hook', rearHook: 'Rear Hook', uppercut: 'Uppercut',
  headMovement: 'Head Movement', bodyMovement: 'Body Movement', guard: 'Guard', positioning: 'Positioning',
  timing: 'Timing', adaptability: 'Adaptability', discipline: 'Discipline',
  speed: 'Speed', power: 'Power', endurance: 'Endurance', recovery: 'Recovery', toughness: 'Toughness',
};

function clampStat(val: number): number {
  return Math.max(1, Math.min(25, Math.round(val)));
}

export default function EditBoxerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [boxer, setBoxer] = useState<Boxer | null>(null);
  const [stats, setStats] = useState<BoxerStats | null>(null);
  const [reputation, setReputation] = useState<ReputationLevel>('Unknown');
  const [rankPoints, setRankPoints] = useState(0);
  const [demotionBuffer, setDemotionBuffer] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const [b, gym] = await Promise.all([getBoxer(Number(id)), getGym()]);
      if (!gym?.godModeEnabled) {
        navigate(`/player/${id}`, { replace: true });
        return;
      }
      if (!b) {
        navigate('/', { replace: true });
        return;
      }
      setBoxer(b);
      setStats({ ...b.stats });
      setReputation(b.reputation);
      setRankPoints(b.rankPoints ?? 0);
      setDemotionBuffer(b.demotionBuffer ?? RANK_CONFIG[b.reputation].bufferMax);
      setLoading(false);
    }
    load();
  }, [id, navigate]);

  async function handleSave() {
    if (!boxer || !stats) return;
    setSaving(true);
    await putBoxer({
      ...boxer,
      stats,
      reputation,
      rankPoints,
      demotionBuffer,
    });
    navigate(`/player/${boxer.id}`);
  }

  if (loading || !boxer || !stats) {
    return (
      <div>
        <PageHeader title="Edit Boxer" subtitle="God Mode" />
        <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Loading…</p>
      </div>
    );
  }

  const rankConfig = RANK_CONFIG[reputation];

  return (
    <div>
      <PageHeader title={`Edit: ${boxer.name}`} subtitle="God Mode" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>

        {/* Stats */}
        {STAT_GROUPS.map(group => (
          <div key={group.label}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {group.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {group.stats.map(stat => (
                <label key={stat} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{STAT_LABELS[stat]}</span>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={stats[stat]}
                    onChange={e => setStats(prev => prev ? { ...prev, [stat]: clampStat(Number(e.target.value)) } : prev)}
                    style={{
                      background: 'var(--surface, #1a1a2e)',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      color: 'var(--text-primary)',
                      padding: '4px 8px',
                      fontSize: 13,
                      width: '100%',
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Ranking */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Ranking
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Reputation</span>
              <select
                value={reputation}
                onChange={e => {
                  const rep = e.target.value as ReputationLevel;
                  setReputation(rep);
                  setRankPoints(0);
                  setDemotionBuffer(RANK_CONFIG[rep].bufferMax);
                }}
                style={{
                  background: 'var(--surface, #1a1a2e)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                  fontSize: 13,
                  maxWidth: 260,
                }}
              >
                {REPUTATION_ORDER.map(rep => (
                  <option key={rep} value={rep}>{rep}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Rank Points
                {rankConfig.promotionThreshold === Infinity
                  ? ' (max rank — no promotion threshold)'
                  : ` (threshold: ${rankConfig.promotionThreshold} pts)`}
              </span>
              <input
                type="number"
                min={0}
                max={rankConfig.promotionThreshold === Infinity ? 9999 : rankConfig.promotionThreshold}
                value={rankPoints}
                onChange={e => setRankPoints(Math.max(0, Math.round(Number(e.target.value))))}
                style={{
                  background: 'var(--surface, #1a1a2e)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                  fontSize: 13,
                  maxWidth: 120,
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Demotion Buffer (max: {rankConfig.bufferMax} pts)
              </span>
              <input
                type="number"
                min={0}
                max={rankConfig.bufferMax}
                value={demotionBuffer}
                onChange={e => setDemotionBuffer(Math.max(0, Math.min(rankConfig.bufferMax, Math.round(Number(e.target.value)))))}
                style={{
                  background: 'var(--surface, #1a1a2e)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                  fontSize: 13,
                  maxWidth: 120,
                }}
              />
            </label>

          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '6px 20px',
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 3,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => navigate(`/player/${boxer.id}`)}
            style={{
              padding: '6px 16px',
              background: 'none',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Player/EditBoxerPage.tsx
git commit -m "feat: add EditBoxerPage for god mode stat and rank editing"
```

---

### Task 5: Register the edit route in routes.tsx

**Files:**
- Modify: `src/routes.tsx`

- [ ] **Step 1: Import EditBoxerPage**

In `src/routes.tsx`, add the import after the `PlayerPage` import:

```tsx
import EditBoxerPage from './pages/Player/EditBoxerPage';
```

- [ ] **Step 2: Add the route**

In the routes array, find the existing player route:

```tsx
{ path: 'player/:id', element: <PlayerPage /> },
```

Replace it with a nested route so both `/player/:id` and `/player/:id/edit` are reachable:

```tsx
{ path: 'player/:id', element: <PlayerPage /> },
{ path: 'player/:id/edit', element: <EditBoxerPage /> },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm test -- --run
```

Expected: 322 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add src/routes.tsx
git commit -m "feat: register /player/:id/edit route for EditBoxerPage"
```

---

## Self-Review

**Spec coverage:**
- ✅ God mode toggle in Tools page — Task 2
- ✅ Toggle state persisted in IndexedDB gym record — Tasks 1 + 2
- ✅ "Edit Boxer" button on player page only when god mode on — Task 3
- ✅ Edit page shows all 17 stats with number inputs — Task 4
- ✅ Edit page shows reputation select — Task 4
- ✅ Edit page shows rankPoints with promotion threshold displayed — Task 4
- ✅ Edit page shows demotionBuffer with bufferMax displayed — Task 4
- ✅ Changing reputation resets rankPoints/buffer to sane defaults — Task 4 (`onChange` on select)
- ✅ Redirect to player page if god mode off — Task 4 (`navigate` on load if `!gym?.godModeEnabled`)
- ✅ Route registered — Task 5

**No placeholders detected.**

**Type consistency:**
- `Gym.godModeEnabled?: boolean` defined in Task 1, read in Tasks 2, 3, 4 — consistent.
- `putBoxer` accepts `Boxer` (has `id`) — used correctly in Task 4 (`{ ...boxer, stats, reputation, rankPoints, demotionBuffer }`).
- `RANK_CONFIG` and `REPUTATION_ORDER` imported from `'../../lib/rankSystem'` in Task 4 — both exist in that file.
- `ReputationLevel` imported from `'../../db/db'` in Task 4 — correct.
