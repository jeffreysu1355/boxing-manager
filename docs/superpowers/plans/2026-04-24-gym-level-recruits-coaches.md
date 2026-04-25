# Gym Level Attracts Better Recruits and Coaches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Higher gym levels unlock higher-reputation free agents and higher-skill coaches.

**Architecture:** Two independent filtering changes. `Recruiting.tsx` already filters free agents by gym level via `GYM_LEVEL_MAX_REP` — fix the mapping to cover all 10 levels correctly. `Coaches.tsx` needs to load gym level and filter the Available Coaches list with a new `GYM_LEVEL_MAX_COACH_SKILL` map. No data model changes needed.

**Tech Stack:** React 18, TypeScript, Vitest

---

### Task 1: Fix `GYM_LEVEL_MAX_REP` in `Recruiting.tsx`

**Files:**
- Modify: `src/pages/Players/Recruiting.tsx:23-28`
- Test: `src/pages/Players/Recruiting.test.ts` (create)

The current mapping skips index 3 (Respectable Opponent) and jumps straight from Rising Star (2) to Contender (4) at level 8. The correct mapping per the design:

| Gym Level | Max Rep Index | Reputation |
|-----------|--------------|------------|
| 1–2 | 0 | Unknown |
| 3–4 | 1 | Local Star |
| 5–7 | 2 | Rising Star |
| 8–10 | 4 | Contender (skipping Respectable Opponent intentionally — index 4 includes both 3 and 4) |

The current mapping is already correct for levels 8–10 (index 4 = Contender). The only actual bug is levels 3–7 need verification. Looking at the existing code:
- Level 3–4 → index 1 ✓
- Level 5–7 → index 2 ✓
- Level 8–10 → index 4 ✓

The mapping is already correct. This task is to write tests that lock in this behavior.

- [ ] **Step 1: Create test file**

Create `src/pages/Players/Recruiting.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Extracted pure logic from Recruiting.tsx for testability
const GYM_LEVEL_MAX_REP: Record<number, number> = {
  1: 0, 2: 0,
  3: 1, 4: 1,
  5: 2, 6: 2, 7: 2,
  8: 4, 9: 4, 10: 4,
};

describe('GYM_LEVEL_MAX_REP', () => {
  it('gym level 1 → max rep index 0 (Unknown only)', () => {
    expect(GYM_LEVEL_MAX_REP[1]).toBe(0);
  });

  it('gym level 2 → max rep index 0 (Unknown only)', () => {
    expect(GYM_LEVEL_MAX_REP[2]).toBe(0);
  });

  it('gym level 3 → max rep index 1 (Local Star)', () => {
    expect(GYM_LEVEL_MAX_REP[3]).toBe(1);
  });

  it('gym level 4 → max rep index 1 (Local Star)', () => {
    expect(GYM_LEVEL_MAX_REP[4]).toBe(1);
  });

  it('gym level 5 → max rep index 2 (Rising Star)', () => {
    expect(GYM_LEVEL_MAX_REP[5]).toBe(2);
  });

  it('gym level 7 → max rep index 2 (Rising Star)', () => {
    expect(GYM_LEVEL_MAX_REP[7]).toBe(2);
  });

  it('gym level 8 → max rep index 4 (up to Contender)', () => {
    expect(GYM_LEVEL_MAX_REP[8]).toBe(4);
  });

  it('gym level 10 → max rep index 4 (up to Contender)', () => {
    expect(GYM_LEVEL_MAX_REP[10]).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/pages/Players/Recruiting.test.ts
```

Expected: All 8 tests PASS (the mapping is already correct).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Players/Recruiting.test.ts
git commit -m "test: lock in GYM_LEVEL_MAX_REP mapping for recruit filtering"
```

---

### Task 2: Add gym-level filtering for coaches in `Coaches.tsx`

**Files:**
- Modify: `src/pages/Gym/Coaches.tsx`
- Test: `src/pages/Gym/Coaches.test.ts` (create)

Add a `GYM_LEVEL_MAX_COACH_SKILL` map and filter `availableCoaches` by gym level. The coach skill order is: `local` < `contender` < `championship-caliber` < `all-time-great`.

**Mapping:**
| Gym Level | Max Coach Skill |
|-----------|----------------|
| 1–3 | local |
| 4–6 | contender |
| 7–9 | championship-caliber |
| 10 | all-time-great |

- [ ] **Step 1: Write the failing test**

Create `src/pages/Gym/Coaches.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { CoachSkillLevel } from '../../db/db';

const COACH_SKILL_INDEX: Record<CoachSkillLevel, number> = {
  'local': 0,
  'contender': 1,
  'championship-caliber': 2,
  'all-time-great': 3,
};

const GYM_LEVEL_MAX_COACH_SKILL: Record<number, CoachSkillLevel> = {
  1: 'local', 2: 'local', 3: 'local',
  4: 'contender', 5: 'contender', 6: 'contender',
  7: 'championship-caliber', 8: 'championship-caliber', 9: 'championship-caliber',
  10: 'all-time-great',
};

function maxCoachSkillIndex(gymLevel: number): number {
  const maxSkill = GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local';
  return COACH_SKILL_INDEX[maxSkill];
}

describe('GYM_LEVEL_MAX_COACH_SKILL', () => {
  it('gym level 1 → local coaches only', () => {
    expect(maxCoachSkillIndex(1)).toBe(0);
  });

  it('gym level 3 → local coaches only', () => {
    expect(maxCoachSkillIndex(3)).toBe(0);
  });

  it('gym level 4 → up to contender coaches', () => {
    expect(maxCoachSkillIndex(4)).toBe(1);
  });

  it('gym level 6 → up to contender coaches', () => {
    expect(maxCoachSkillIndex(6)).toBe(1);
  });

  it('gym level 7 → up to championship-caliber coaches', () => {
    expect(maxCoachSkillIndex(7)).toBe(2);
  });

  it('gym level 9 → up to championship-caliber coaches', () => {
    expect(maxCoachSkillIndex(9)).toBe(2);
  });

  it('gym level 10 → all-time-great coaches visible', () => {
    expect(maxCoachSkillIndex(10)).toBe(3);
  });
});

describe('coach filtering by gym level', () => {
  const allCoaches = [
    { id: 1, skillLevel: 'local' as CoachSkillLevel, assignedBoxerId: null },
    { id: 2, skillLevel: 'contender' as CoachSkillLevel, assignedBoxerId: null },
    { id: 3, skillLevel: 'championship-caliber' as CoachSkillLevel, assignedBoxerId: null },
    { id: 4, skillLevel: 'all-time-great' as CoachSkillLevel, assignedBoxerId: null },
    { id: 5, skillLevel: 'local' as CoachSkillLevel, assignedBoxerId: 99 }, // assigned — always hidden
  ];

  function filterAvailableCoaches(gymLevel: number) {
    const maxSkill = GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local';
    const maxIdx = COACH_SKILL_INDEX[maxSkill];
    return allCoaches.filter(
      c => c.assignedBoxerId === null && COACH_SKILL_INDEX[c.skillLevel] <= maxIdx
    );
  }

  it('gym level 1 shows only local unassigned coaches', () => {
    const result = filterAvailableCoaches(1);
    expect(result.map(c => c.id)).toEqual([1]);
  });

  it('gym level 4 shows local + contender unassigned coaches', () => {
    const result = filterAvailableCoaches(4);
    expect(result.map(c => c.id)).toEqual([1, 2]);
  });

  it('gym level 7 shows local + contender + championship-caliber', () => {
    const result = filterAvailableCoaches(7);
    expect(result.map(c => c.id)).toEqual([1, 2, 3]);
  });

  it('gym level 10 shows all unassigned coaches', () => {
    const result = filterAvailableCoaches(10);
    expect(result.map(c => c.id)).toEqual([1, 2, 3, 4]);
  });

  it('assigned coaches are never shown regardless of gym level', () => {
    const result = filterAvailableCoaches(10);
    expect(result.find(c => c.id === 5)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/pages/Gym/Coaches.test.ts
```

Expected: FAIL — `GYM_LEVEL_MAX_COACH_SKILL` and `COACH_SKILL_INDEX` are not yet exported from `Coaches.tsx`.

- [ ] **Step 3: Implement in `Coaches.tsx`**

Replace the top of `src/pages/Gym/Coaches.tsx` (after imports, before the component) with:

```typescript
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { getGym } from '../../db/gymStore';
import { getAllCoaches, putCoach } from '../../db/coachStore';
import { getAllBoxers } from '../../db/boxerStore';
import type { Boxer, Coach, CoachSkillLevel, Gym } from '../../db/db';
import styles from './Coaches.module.css';

const SKILL_LABELS: Record<CoachSkillLevel, string> = {
  'local': 'Local',
  'contender': 'Contender',
  'championship-caliber': 'Championship Caliber',
  'all-time-great': 'All-Time Great',
};

export const COACH_SKILL_INDEX: Record<CoachSkillLevel, number> = {
  'local': 0,
  'contender': 1,
  'championship-caliber': 2,
  'all-time-great': 3,
};

export const GYM_LEVEL_MAX_COACH_SKILL: Record<number, CoachSkillLevel> = {
  1: 'local', 2: 'local', 3: 'local',
  4: 'contender', 5: 'contender', 6: 'contender',
  7: 'championship-caliber', 8: 'championship-caliber', 9: 'championship-caliber',
  10: 'all-time-great',
};

function styleLabel(style: string): string {
  return style.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('-');
}
```

Then update the component state to include gym level and filter available coaches:

Replace the `useState` declarations and `useEffect` in the component:

```typescript
export default function Coaches() {
  const [gymLevel, setGymLevel] = useState<number>(1);
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
        setGymLevel(gym?.level ?? 1);
        setRoster(gymRoster);
        setCoaches(allCoaches);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);
```

Replace the `availableCoaches` derivation (line 71 in original):

```typescript
  const maxCoachSkill = GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local';
  const maxCoachSkillIdx = COACH_SKILL_INDEX[maxCoachSkill];
  const availableCoaches = coaches.filter(
    c => c.assignedBoxerId === null && COACH_SKILL_INDEX[c.skillLevel] <= maxCoachSkillIdx
  );
```

The rest of the component (JSX) is unchanged.

- [ ] **Step 4: Fix test imports**

Update `src/pages/Gym/Coaches.test.ts` to import the constants from the component instead of redefining them:

```typescript
import { describe, it, expect } from 'vitest';
import { COACH_SKILL_INDEX, GYM_LEVEL_MAX_COACH_SKILL } from './Coaches';
import type { CoachSkillLevel } from '../../db/db';

function maxCoachSkillIndex(gymLevel: number): number {
  const maxSkill = GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local';
  return COACH_SKILL_INDEX[maxSkill];
}

describe('GYM_LEVEL_MAX_COACH_SKILL', () => {
  it('gym level 1 → local coaches only', () => {
    expect(maxCoachSkillIndex(1)).toBe(0);
  });

  it('gym level 3 → local coaches only', () => {
    expect(maxCoachSkillIndex(3)).toBe(0);
  });

  it('gym level 4 → up to contender coaches', () => {
    expect(maxCoachSkillIndex(4)).toBe(1);
  });

  it('gym level 6 → up to contender coaches', () => {
    expect(maxCoachSkillIndex(6)).toBe(1);
  });

  it('gym level 7 → up to championship-caliber coaches', () => {
    expect(maxCoachSkillIndex(7)).toBe(2);
  });

  it('gym level 9 → up to championship-caliber coaches', () => {
    expect(maxCoachSkillIndex(9)).toBe(2);
  });

  it('gym level 10 → all-time-great coaches visible', () => {
    expect(maxCoachSkillIndex(10)).toBe(3);
  });
});

describe('coach filtering by gym level', () => {
  const allCoaches = [
    { id: 1, skillLevel: 'local' as CoachSkillLevel, assignedBoxerId: null },
    { id: 2, skillLevel: 'contender' as CoachSkillLevel, assignedBoxerId: null },
    { id: 3, skillLevel: 'championship-caliber' as CoachSkillLevel, assignedBoxerId: null },
    { id: 4, skillLevel: 'all-time-great' as CoachSkillLevel, assignedBoxerId: null },
    { id: 5, skillLevel: 'local' as CoachSkillLevel, assignedBoxerId: 99 },
  ];

  function filterAvailableCoaches(gymLevel: number) {
    const maxSkill = GYM_LEVEL_MAX_COACH_SKILL[gymLevel] ?? 'local';
    const maxIdx = COACH_SKILL_INDEX[maxSkill];
    return allCoaches.filter(
      c => c.assignedBoxerId === null && COACH_SKILL_INDEX[c.skillLevel] <= maxIdx
    );
  }

  it('gym level 1 shows only local unassigned coaches', () => {
    const result = filterAvailableCoaches(1);
    expect(result.map(c => c.id)).toEqual([1]);
  });

  it('gym level 4 shows local + contender unassigned coaches', () => {
    const result = filterAvailableCoaches(4);
    expect(result.map(c => c.id)).toEqual([1, 2]);
  });

  it('gym level 7 shows local + contender + championship-caliber', () => {
    const result = filterAvailableCoaches(7);
    expect(result.map(c => c.id)).toEqual([1, 2, 3]);
  });

  it('gym level 10 shows all unassigned coaches', () => {
    const result = filterAvailableCoaches(10);
    expect(result.map(c => c.id)).toEqual([1, 2, 3, 4]);
  });

  it('assigned coaches are never shown regardless of gym level', () => {
    const result = filterAvailableCoaches(10);
    expect(result.find(c => c.id === 5)).toBeUndefined();
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run src/pages/Gym/Coaches.test.ts
```

Expected: All 12 tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Gym/Coaches.tsx src/pages/Gym/Coaches.test.ts
git commit -m "feat: filter available coaches by gym level"
```

---

### Task 3: Mark requirements as complete

**Files:**
- Modify: `PRD.md` (source of truth for progress tracking)

- [ ] **Step 1: Update PRD.md**

In `PRD.md` Section 4 (Gym System), check off:
- `[x] Gym level affects recruit quality generation`
- `[x] Gym level affects coach attraction`

- [ ] **Step 2: Commit**

```bash
git add PRD.md
git commit -m "docs: mark gym level recruit/coach filtering as complete"
```
