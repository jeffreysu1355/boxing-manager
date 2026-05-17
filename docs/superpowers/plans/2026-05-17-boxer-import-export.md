# Boxer Import/Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JSON export of any boxer from PlayerPage and EditBoxerPage, and JSON import from the God Mode page that routes through a new ImportBoxerPage for stat review before adding to the gym roster.

**Architecture:** A shared `exportBoxer` utility handles download. Import parses/validates JSON on the God Mode page, passes data via React Router `location.state` to a new `ImportBoxerPage`, which resolves fight record opponent IDs against current session boxers before writing to IndexedDB.

**Tech Stack:** React 18 + TypeScript, IndexedDB via `idb`, React Router v7, CSS Modules

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `src/lib/exportBoxer.ts` | Shared export utility (serialize + download) |
| Modify | `src/pages/Player/PlayerPage.tsx` | Add Export button in header (god-mode gated) |
| Modify | `src/pages/Player/EditBoxerPage.tsx` | Add Export button in actions row |
| Modify | `src/pages/Tools/GodMode.tsx` | Add Import Boxer section with file input + validation |
| Create | `src/pages/Player/ImportBoxerPage.tsx` | Import edit page (reads location.state, saves to gym) |
| Modify | `src/routes.tsx` | Register `/player/import/edit` route |

---

## Task 1: Create `exportBoxer` utility

**Files:**
- Create: `src/lib/exportBoxer.ts`

- [ ] **Step 1: Create `src/lib/exportBoxer.ts`**

```ts
import type { Boxer } from '../db/db';

export interface BoxerExport {
  exportVersion: 1;
  boxer: Omit<Boxer, 'id'>;
}

export function exportBoxer(boxer: Boxer): void {
  const { id: _id, ...rest } = boxer;
  const payload: BoxerExport = { exportVersion: 1, boxer: rest };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `boxer-${boxer.name.toLowerCase().replace(/\s+/g, '-')}.json`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/exportBoxer.ts
git commit -m "feat: add exportBoxer utility"
```

---

## Task 2: Add Export button to PlayerPage

**Files:**
- Modify: `src/pages/Player/PlayerPage.tsx`

The export button should appear in the same area as the Edit Boxer link, which is already gated on `godMode`. Both are god-mode-only actions.

- [ ] **Step 1: Add import for `exportBoxer`**

At the top of `src/pages/Player/PlayerPage.tsx`, after the existing imports, add:

```ts
import { exportBoxer } from '../../lib/exportBoxer';
```

- [ ] **Step 2: Add Export button JSX**

Find the `{godMode && (` block that renders the Edit Boxer link (around line 289). After its closing `)}`, add a new export button block:

```tsx
{godMode && boxer.id !== undefined && (
  <div style={{ marginBottom: 8 }}>
    <button
      onClick={() => exportBoxer(boxer)}
      style={{
        display: 'inline-block',
        padding: '5px 14px',
        background: 'var(--surface, #1a1a2e)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        borderRadius: 3,
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      Export Boxer
    </button>
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Player/PlayerPage.tsx
git commit -m "feat: add Export Boxer button to PlayerPage"
```

---

## Task 3: Add Export button to EditBoxerPage

**Files:**
- Modify: `src/pages/Player/EditBoxerPage.tsx`

The export button goes in the actions row alongside Save and Cancel, and exports the boxer's saved state (not in-progress edits).

- [ ] **Step 1: Add import for `exportBoxer`**

At the top of `src/pages/Player/EditBoxerPage.tsx`, after the existing imports, add:

```ts
import { exportBoxer } from '../../lib/exportBoxer';
```

- [ ] **Step 2: Add Export button in the actions row**

Find the `{/* Actions */}` section (around line 307). It currently contains Save and Cancel buttons inside a `<div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>`. Add the Export button after the Cancel button:

```tsx
<button
  onClick={() => exportBoxer(boxer)}
  style={{
    padding: '6px 16px',
    background: 'none',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    cursor: 'pointer',
  }}
>
  Export
</button>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Player/EditBoxerPage.tsx
git commit -m "feat: add Export button to EditBoxerPage"
```

---

## Task 4: Add Import Boxer section to GodMode page

**Files:**
- Modify: `src/pages/Tools/GodMode.tsx`

Add a file input + Import button below the existing controls. Validates the JSON and navigates to `/player/import/edit` with the parsed boxer in router state.

- [ ] **Step 1: Add imports and validation logic to `src/pages/Tools/GodMode.tsx`**

At the top of the file, add:

```ts
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
```

Note: `useState` is already imported — only add `useRef`. `useNavigate` is not currently imported; add it.

- [ ] **Step 2: Add state and helpers inside the `GodMode` component**

After the existing state declarations (`godMode`, `restarting`, `loading`, `toggling`), add:

```ts
const navigate = useNavigate();
const fileInputRef = useRef<HTMLInputElement>(null);
const [importError, setImportError] = useState<string | null>(null);
```

- [ ] **Step 3: Add the `handleImport` function**

After `handleRestart`, add:

```ts
async function handleImport() {
  setImportError(null);
  const file = fileInputRef.current?.files?.[0];
  if (!file) {
    setImportError('Please select a JSON file.');
    return;
  }
  let parsed: unknown;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    setImportError('Invalid JSON file.');
    return;
  }

  if (
    typeof parsed !== 'object' || parsed === null ||
    (parsed as Record<string, unknown>).exportVersion !== 1
  ) {
    setImportError('Not a valid boxer export file (missing exportVersion: 1).');
    return;
  }

  const data = parsed as Record<string, unknown>;
  const boxer = data.boxer as Record<string, unknown> | undefined;

  if (!boxer) {
    setImportError('Missing boxer data in file.');
    return;
  }

  const VALID_WEIGHT_CLASSES = ['flyweight', 'lightweight', 'welterweight', 'middleweight', 'heavyweight'];
  const VALID_STYLES = ['out-boxer', 'swarmer', 'slugger', 'counterpuncher'];
  const VALID_REPUTATIONS = [
    'Unknown', 'Local Star', 'Rising Star', 'Respectable Opponent', 'Contender',
    'Championship Caliber', 'Nationally Ranked', 'World Class Fighter',
    'International Superstar', 'All-Time Great',
  ];
  const REQUIRED_STATS = [
    'jab', 'cross', 'leadHook', 'rearHook', 'uppercut',
    'headMovement', 'bodyMovement', 'guard', 'positioning',
    'timing', 'adaptability', 'discipline',
    'speed', 'power', 'endurance', 'recovery', 'toughness',
  ];

  if (typeof boxer.name !== 'string' || !boxer.name.trim()) {
    setImportError('Invalid boxer: missing name.'); return;
  }
  if (!VALID_WEIGHT_CLASSES.includes(boxer.weightClass as string)) {
    setImportError('Invalid boxer: invalid weightClass.'); return;
  }
  if (!VALID_STYLES.includes(boxer.style as string)) {
    setImportError('Invalid boxer: invalid style.'); return;
  }
  if (!VALID_REPUTATIONS.includes(boxer.reputation as string)) {
    setImportError('Invalid boxer: invalid reputation.'); return;
  }
  if (typeof boxer.rankPoints !== 'number') {
    setImportError('Invalid boxer: missing rankPoints.'); return;
  }
  if (typeof boxer.demotionBuffer !== 'number') {
    setImportError('Invalid boxer: missing demotionBuffer.'); return;
  }
  if (!Array.isArray(boxer.naturalTalents)) {
    setImportError('Invalid boxer: naturalTalents must be an array.'); return;
  }
  if (!Array.isArray(boxer.injuries)) {
    setImportError('Invalid boxer: injuries must be an array.'); return;
  }
  if (!Array.isArray(boxer.titles)) {
    setImportError('Invalid boxer: titles must be an array.'); return;
  }
  if (!Array.isArray(boxer.record)) {
    setImportError('Invalid boxer: record must be an array.'); return;
  }
  const stats = boxer.stats as Record<string, unknown> | undefined;
  if (!stats || typeof stats !== 'object') {
    setImportError('Invalid boxer: missing stats.'); return;
  }
  for (const key of REQUIRED_STATS) {
    if (typeof stats[key] !== 'number') {
      setImportError(`Invalid boxer: missing stat "${key}".`); return;
    }
  }

  navigate('/player/import/edit', { state: { boxer } });
}
```

- [ ] **Step 4: Add Import Boxer UI in the JSX**

Inside the return JSX, after the closing `</button>` of the Restart button, add:

```tsx
<div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
    Import Boxer
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <input
      ref={fileInputRef}
      type="file"
      accept=".json"
      style={{ fontSize: 13, color: 'var(--text-secondary)' }}
      onChange={() => setImportError(null)}
    />
    <button
      onClick={handleImport}
      style={{
        padding: '6px 14px',
        background: 'var(--accent)',
        color: '#000',
        border: 'none',
        borderRadius: 3,
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      Import
    </button>
  </div>
  {importError && (
    <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{importError}</p>
  )}
</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Tools/GodMode.tsx
git commit -m "feat: add Import Boxer section to GodMode page"
```

---

## Task 5: Create ImportBoxerPage

**Files:**
- Create: `src/pages/Player/ImportBoxerPage.tsx`

This page mirrors `EditBoxerPage` but reads from `location.state` instead of IndexedDB, and on Save writes a new boxer to IndexedDB with `gymId` set and adds it to the gym roster.

- [ ] **Step 1: Create `src/pages/Player/ImportBoxerPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { putBoxer, getAllBoxers } from '../../db/boxerStore';
import { getGym, saveGym } from '../../db/gymStore';
import { RANK_CONFIG, REPUTATION_ORDER } from '../../lib/rankSystem';
import type { Boxer, BoxerStats, NaturalTalent, ReputationLevel } from '../../db/db';

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

export default function ImportBoxerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const imported = (location.state as { boxer: Omit<Boxer, 'id'> } | null)?.boxer;

  const [stats, setStats] = useState<BoxerStats | null>(null);
  const [reputation, setReputation] = useState<ReputationLevel>('Unknown');
  const [rankPoints, setRankPoints] = useState(0);
  const [demotionBuffer, setDemotionBuffer] = useState(0);
  const [naturalTalents, setNaturalTalents] = useState<NaturalTalent[]>([]);
  const [age, setAge] = useState(18);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!imported) {
      navigate('/tools/god-mode', { replace: true });
      return;
    }
    setStats({ ...imported.stats });
    setReputation(imported.reputation);
    setRankPoints(imported.rankPoints ?? 0);
    setDemotionBuffer(imported.demotionBuffer ?? RANK_CONFIG[imported.reputation].bufferMax);
    setNaturalTalents([...imported.naturalTalents]);
    setAge(imported.age);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!imported || !stats) return;
    setSaving(true);
    try {
      const gym = await getGym();
      if (!gym) return;

      const allBoxers = await getAllBoxers();
      const nameMap = new Map<string, number>();
      for (const b of allBoxers) {
        if (b.id !== undefined) nameMap.set(b.name, b.id);
      }

      const resolvedRecord = imported.record.map(r => ({
        ...r,
        opponentId: nameMap.has(r.opponentName) ? (nameMap.get(r.opponentName) ?? null) : null,
      }));

      const newBoxer: Omit<Boxer, 'id'> = {
        ...imported,
        stats,
        reputation,
        rankPoints,
        demotionBuffer,
        naturalTalents,
        age,
        gymId: gym.id ?? 1,
        record: resolvedRecord,
        lastRankDelta: undefined,
        retired: false,
      };

      const newId = await putBoxer(newBoxer);
      await saveGym({ ...gym, rosterIds: [...(gym.rosterIds ?? []), newId] });
      navigate(`/player/${newId}`);
    } finally {
      setSaving(false);
    }
  }

  if (!imported || !stats) return null;

  const rankConfig = RANK_CONFIG[reputation];

  return (
    <div>
      <PageHeader title={`Import: ${imported.name}`} subtitle="God Mode — Review stats before adding to roster" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>

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

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Natural Talents
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {(Object.keys(STAT_LABELS) as (keyof BoxerStats)[]).map(stat => {
              const hasTalent = naturalTalents.some(t => t.stat === stat);
              return (
                <label key={stat} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={hasTalent}
                    onChange={e => {
                      if (e.target.checked) {
                        setNaturalTalents(prev => [...prev, { stat }]);
                      } else {
                        setNaturalTalents(prev => prev.filter(t => t.stat !== stat));
                      }
                    }}
                  />
                  <span style={{ color: hasTalent ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {STAT_LABELS[stat]}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Boxer Info
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Age</span>
            <input
              type="number"
              min={16}
              max={60}
              value={age}
              onChange={e => setAge(Math.max(16, Math.min(60, Math.round(Number(e.target.value)))))}
              style={{
                background: 'var(--surface, #1a1a2e)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                color: 'var(--text-primary)',
                padding: '4px 8px',
                fontSize: 13,
                maxWidth: 100,
              }}
            />
          </label>
        </div>

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
            {saving ? 'Saving…' : 'Save & Add to Roster'}
          </button>
          <button
            onClick={() => navigate('/tools/god-mode')}
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
git add src/pages/Player/ImportBoxerPage.tsx
git commit -m "feat: add ImportBoxerPage"
```

---

## Task 6: Register route

**Files:**
- Modify: `src/routes.tsx`

- [ ] **Step 1: Add import for `ImportBoxerPage`**

At the top of `src/routes.tsx`, after the `EditBoxerPage` import, add:

```ts
import ImportBoxerPage from './pages/Player/ImportBoxerPage';
```

- [ ] **Step 2: Add route**

In the routes array, after the existing `{ path: 'player/:id/edit', element: <EditBoxerPage /> }` entry, add:

```ts
{ path: 'player/import/edit', element: <ImportBoxerPage /> },
```

Note: this must appear **before** `{ path: 'player/:id', ... }` in the array, or at minimum alongside the other `player/...` routes. React Router v7 matches routes in order — `player/import/edit` is a static path and must not be shadowed by `player/:id`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes.tsx
git commit -m "feat: register /player/import/edit route"
```

---

## Task 7: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm run dev
```

- [ ] **Step 2: Test export from PlayerPage**

1. Enable God Mode (Tools > God Mode).
2. Navigate to any boxer's player page.
3. Confirm "Export Boxer" button appears.
4. Click it — browser should download `boxer-<name>.json`.
5. Open the file and confirm it has `exportVersion: 1` and a `boxer` object with all stats.

- [ ] **Step 3: Test export from EditBoxerPage**

1. From a boxer's player page, click "Edit Boxer".
2. Confirm "Export" button appears in the actions row.
3. Click it — same download should trigger.

- [ ] **Step 4: Test import on GodMode page**

1. Navigate to Tools > God Mode.
2. Confirm "Import Boxer" section appears.
3. Select the exported JSON file and click Import.
4. Confirm navigation to the import edit page with the boxer's data pre-filled.
5. Adjust a stat, click "Save & Add to Roster".
6. Confirm navigation to the new boxer's player page.
7. Confirm the boxer appears in the roster.

- [ ] **Step 5: Test fight record link resolution**

1. Export a boxer who has fight records with opponents that exist in the current session.
2. Import that boxer.
3. On the player page, confirm that fight records with known opponents show clickable links.
4. For opponents not present in the session, confirm plain text display.

- [ ] **Step 6: Test invalid file**

1. On GodMode page, select a non-boxer JSON file (e.g. `package.json`).
2. Click Import.
3. Confirm an inline error message appears and no navigation occurs.
