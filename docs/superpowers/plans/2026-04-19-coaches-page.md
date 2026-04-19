# Coaches Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed 11 coaches in world generation and implement the Coaches page showing gym roster with coach assignment dropdowns and an available-coaches list.

**Architecture:** Three independent changes — add coach seeding to `generateWorld()` (updating `gym.coachIds` after creation), build `Coaches.tsx` as a self-contained component that derives all state from the coaches array (coach record is source of truth for assignments), and add scoped CSS. No DB schema changes needed.

**Tech Stack:** React 18, TypeScript, CSS Modules, IndexedDB via existing `coachStore.ts` / `gymStore.ts` / `boxerStore.ts`

---

### Task 1: Seed coaches in `generateWorld()`

**Files:**
- Modify: `src/db/worldGen.ts`

**Context:**
- `putCoach` is in `src/db/coachStore.ts`: `putCoach(coach: Omit<Coach, 'id'> | Coach): Promise<number>`
- `Coach` type: `{ id?: number; name: string; skillLevel: CoachSkillLevel; style: FightingStyle; assignedBoxerId: number | null }`
- `CoachSkillLevel`: `'local' | 'contender' | 'championship-caliber' | 'all-time-great'`
- `FIGHTING_STYLES` array already exists in `worldGen.ts`: `['out-boxer', 'swarmer', 'slugger', 'counterpuncher']`
- `generateName(fedName)` already exists in `worldGen.ts` — takes a `FederationName`
- `pick<T>(arr: T[]): T` already exists in `worldGen.ts`
- `saveGym` is already imported; `getGym` is NOT imported yet
- `gym.coachIds` needs to be updated after coach creation — fetch gym via `getGym()`, spread with new coachIds, save via `saveGym()`

- [ ] **Step 1: Add imports**

At the top of `src/db/worldGen.ts`, add `putCoach` and `getGym` to the existing imports:

```typescript
import { getGym, saveGym } from './gymStore';
import { putCoach } from './coachStore';
```

Also add `Coach` and `CoachSkillLevel` to the type imports block:

```typescript
import type {
  Boxer,
  BoxerStats,
  Coach,
  CoachSkillLevel,
  Federation,
  FederationName,
  FightingStyle,
  FightRecord,
  NaturalTalent,
  ReputationLevel,
  Title,
} from './db';
```

- [ ] **Step 2: Add `generateCoaches()` function**

Add this function just before the `// --- Main world gen ---` comment in `worldGen.ts`:

```typescript
// --- Coach generation ---

async function generateCoaches(): Promise<number[]> {
  const styles: FightingStyle[] = ['out-boxer', 'swarmer', 'slugger', 'counterpuncher'];

  // Distribute 10 local coaches across 4 styles: 3 + 3 + 2 + 2
  const localStyleAssignments: FightingStyle[] = [
    ...Array(3).fill(styles[0]),
    ...Array(3).fill(styles[1]),
    ...Array(2).fill(styles[2]),
    ...Array(2).fill(styles[3]),
  ];
  // Shuffle so it's not always the same order
  localStyleAssignments.sort(() => Math.random() - 0.5);

  const coachIds: number[] = [];

  for (const style of localStyleAssignments) {
    const coach: Omit<Coach, 'id'> = {
      name: generateName(pick(FEDERATION_NAMES)),
      skillLevel: 'local',
      style,
      assignedBoxerId: null,
    };
    const id = await putCoach(coach);
    coachIds.push(id);
  }

  // 1 contender coach with random style
  const contender: Omit<Coach, 'id'> = {
    name: generateName(pick(FEDERATION_NAMES)),
    skillLevel: 'contender',
    style: pick(styles),
    assignedBoxerId: null,
  };
  const contenderId = await putCoach(contender);
  coachIds.push(contenderId);

  return coachIds;
}
```

- [ ] **Step 3: Call `generateCoaches()` in `generateWorld()` and update gym**

After the `await saveGym(...)` call (step 6 in `generateWorld()`), add:

```typescript
  // 7. Seed coaches and update gym
  const coachIds = await generateCoaches();
  const gym = await getGym();
  if (gym) {
    await saveGym({ ...gym, coachIds });
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
node_modules/.bin/tsc -b
```

Expected: no output (clean compile).

- [ ] **Step 5: Commit**

```bash
git add src/db/worldGen.ts
git commit -m "feat: seed coaches in generateWorld"
```

---

### Task 2: Create `Coaches.module.css`

**Files:**
- Create: `src/pages/Gym/Coaches.module.css`

- [ ] **Step 1: Create the CSS module**

Create `src/pages/Gym/Coaches.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.sectionTitle {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin: 0 0 10px 0;
}

.styleTag {
  color: var(--text-secondary);
  font-size: 12px;
}

.skillTag {
  font-size: 12px;
  color: var(--text-secondary);
}

.coachSelect {
  font-size: 12px;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 3px 6px;
  cursor: pointer;
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Gym/Coaches.module.css
git commit -m "feat: add Coaches.module.css"
```

---

### Task 3: Implement `Coaches.tsx`

**Files:**
- Modify: `src/pages/Gym/Coaches.tsx`

**Context:**
- `getGym()` → `src/db/gymStore.ts`
- `getAllCoaches()`, `putCoach()` → `src/db/coachStore.ts`
- `getAllBoxers()` → `src/db/boxerStore.ts`
- `Gym`, `Coach`, `Boxer`, `CoachSkillLevel` types → `src/db/db.ts`
- Boxer name links to `/player/:id` — use `<Link to={...}>` from `react-router`
- Assignment is derived: find coach where `coach.assignedBoxerId === boxer.id`
- On dropdown change:
  - New coach selected → update that coach's `assignedBoxerId = boxer.id`, also clear old coach if any (set its `assignedBoxerId = null`)
  - "None" selected → find coach assigned to boxer, set its `assignedBoxerId = null`
- Available coaches = coaches where `assignedBoxerId === null` (derived from `coaches` state after each update)

**Skill level labels:**
```typescript
const SKILL_LABELS: Record<CoachSkillLevel, string> = {
  'local': 'Local',
  'contender': 'Contender',
  'championship-caliber': 'Championship Caliber',
  'all-time-great': 'All-Time Great',
};
```

**Style label helper:**
```typescript
function styleLabel(style: string): string {
  return style.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-');
}
```

- [ ] **Step 1: Replace `Coaches.tsx` with full implementation**

Replace the entire contents of `src/pages/Gym/Coaches.tsx` with:

```typescript
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym } from '../../db/gymStore';
import { getAllCoaches, putCoach } from '../../db/coachStore';
import { getAllBoxers } from '../../db/boxerStore';
import type { Boxer, Coach, CoachSkillLevel } from '../../db/db';
import styles from './Coaches.module.css';

const SKILL_LABELS: Record<CoachSkillLevel, string> = {
  'local': 'Local',
  'contender': 'Contender',
  'championship-caliber': 'Championship Caliber',
  'all-time-great': 'All-Time Great',
};

function styleLabel(style: string): string {
  return style.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-');
}

export default function Coaches() {
  const [roster, setRoster] = useState<Boxer[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [gym, allCoaches, allBoxers] = await Promise.all([
        getGym(),
        getAllCoaches(),
        getAllBoxers(),
      ]);
      if (!cancelled) {
        const gymRoster = allBoxers.filter(b => b.gymId === (gym?.id ?? 1));
        setRoster(gymRoster);
        setCoaches(allCoaches);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  async function handleAssign(boxer: Boxer, coachIdStr: string) {
    const updatedCoaches = [...coaches];

    // Clear any existing coach assigned to this boxer
    const prevCoachIdx = updatedCoaches.findIndex(c => c.assignedBoxerId === boxer.id);
    if (prevCoachIdx !== -1) {
      const prev = { ...updatedCoaches[prevCoachIdx], assignedBoxerId: null };
      updatedCoaches[prevCoachIdx] = prev;
      await putCoach(prev);
    }

    if (coachIdStr !== '') {
      const newCoachId = Number(coachIdStr);
      const newCoachIdx = updatedCoaches.findIndex(c => c.id === newCoachId);
      if (newCoachIdx !== -1) {
        const updated = { ...updatedCoaches[newCoachIdx], assignedBoxerId: boxer.id! };
        updatedCoaches[newCoachIdx] = updated;
        await putCoach(updated);
      }
    }

    setCoaches(updatedCoaches);
  }

  const availableCoaches = coaches.filter(c => c.assignedBoxerId === null);

  if (loading) {
    return (
      <div>
        <PageHeader title="Coaches" subtitle="Current coaches and training assignments" />
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Coaches" subtitle="Current coaches and training assignments" />
      <div className={styles.page}>

        <section>
          <h2 className={styles.sectionTitle}>Roster</h2>
          {roster.length === 0 ? (
            <p className={styles.empty}>No boxers on your roster yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Style</th>
                  <th>Reputation</th>
                  <th>Coach</th>
                </tr>
              </thead>
              <tbody>
                {roster.map(boxer => {
                  const assignedCoach = coaches.find(c => c.assignedBoxerId === boxer.id);
                  return (
                    <tr key={boxer.id}>
                      <td><Link to={`/player/${boxer.id}`}>{boxer.name}</Link></td>
                      <td className={styles.styleTag}>{styleLabel(boxer.style)}</td>
                      <td>{boxer.reputation}</td>
                      <td>
                        <select
                          className={styles.coachSelect}
                          value={assignedCoach?.id?.toString() ?? ''}
                          onChange={e => handleAssign(boxer, e.target.value)}
                        >
                          <option value="">None</option>
                          {coaches.map(coach => (
                            <option key={coach.id} value={coach.id?.toString()}>
                              {coach.name} ({SKILL_LABELS[coach.skillLevel]})
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Available Coaches</h2>
          {availableCoaches.length === 0 ? (
            <p className={styles.empty}>No coaches available.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Skill Level</th>
                  <th>Style</th>
                </tr>
              </thead>
              <tbody>
                {availableCoaches.map(coach => (
                  <tr key={coach.id}>
                    <td>{coach.name}</td>
                    <td className={styles.skillTag}>{SKILL_LABELS[coach.skillLevel]}</td>
                    <td className={styles.styleTag}>{styleLabel(coach.style)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

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
git add src/pages/Gym/Coaches.tsx
git commit -m "feat: implement Coaches page with assignment UI"
```
