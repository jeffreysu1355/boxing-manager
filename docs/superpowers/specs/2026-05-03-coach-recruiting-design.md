# Coach Recruiting — Design Spec

## Overview

Coaches are no longer auto-assigned at world gen. Instead, a persistent recruiting pool exists in the `coaches` store. Players hire coaches for a one-time fee (deducted from gym balance) and pay a monthly salary. Coaches can be released back to the pool at any time with no refund. A new Coach Recruiting page under Players handles hiring. The existing Gym > Coaches page gains release buttons.

---

## Data Model Changes

### `Coach` interface — add two fields (`src/db/db.ts`)

```ts
export interface Coach {
  id?: number;
  name: string;
  skillLevel: CoachSkillLevel;
  style: FightingStyle;
  assignedBoxerId: number | null;
  gymId: number | null;     // null = available in recruiting pool; gym id = hired
  monthlySalary: number;    // fixed monthly cost deducted from gym balance
}
```

`gymId: null` means the coach is in the global recruiting pool and available for hire. Existing coaches in the DB will have `gymId: undefined` after the migration — runtime code treats `undefined` as `null` (available).

No new DB store is needed. A no-op migration comment block is added for version 13.

### Coach cap per gym level (constant, not stored in DB)

```ts
export const GYM_LEVEL_COACH_CAP: Record<number, number> = {
  1: 5, 2: 5,
  3: 6, 4: 7,
  5: 9, 6: 11,
  7: 13, 8: 15,
  9: 17, 10: 20,
};
```

### Salary & hiring fee by skill level (constants)

```ts
export const COACH_HIRING_FEE: Record<CoachSkillLevel, number> = {
  'local':                5_000,
  'contender':           50_000,
  'championship-caliber': 400_000,
  'all-time-great':     2_000_000,
};

export const COACH_MONTHLY_SALARY: Record<CoachSkillLevel, number> = {
  'local':                  500,
  'contender':            3_000,
  'championship-caliber': 15_000,
  'all-time-great':       75_000,
};
```

---

## World Generation Changes (`src/db/worldGen.ts`)

`generateCoaches()` is rewritten to produce a **persistent recruiting pool** of 24 coaches (`gymId: null`, `monthlySalary` set per skill level). The gym starts with **zero hired coaches** — `coachIds` on the gym record is removed (gym no longer tracks coaches; `gymId` on the coach is the source of truth).

Pool composition (guaranteed at least 1 per style × skill level):

| Skill Level | Count | Per style |
|---|---|---|
| Local | 8 | 2 each |
| Contender | 8 | 2 each |
| Championship Caliber | 4 | 1 each |
| All-Time Great | 4 | 1 each |

**Total: 24 coaches.**

`generateWorld()` calls `generateCoaches()` but no longer stores the returned ids on the gym — the gym starts empty.

---

## Gym Schema Change

`Gym.coachIds` is **removed**. Coach ownership is tracked exclusively via `Coach.gymId`. All existing reads of `gym.coachIds` are replaced with `getAllCoaches()` filtered by `gymId`.

The DB version bumps to 13. A migration comment notes that `coachIds` on Gym is abandoned (no structural migration needed — the field simply goes unused and coaches store `gymId` going forward).

---

## Monthly Salary Deduction

A new function `runCoachSalaries(fromDate: string, toDate: string, gymId: number): Promise<void>` in `src/lib/coachSalaries.ts`:

1. Count full calendar months elapsed between `fromDate` and `toDate` as `Math.floor((toYear * 12 + toMonth) - (fromYear * 12 + fromMonth))`. Example: Jan 15 → Mar 20 = 2 months; Jan 15 → Feb 10 = 1 month; same month = 0 months (no deduction).
2. Load all coaches where `coach.gymId === gymId`.
3. Sum `monthlySalary` across all hired coaches × months elapsed.
4. Deduct from `gym.balance` (balance can go negative).
5. Save updated gym.

Called from `TopNav`'s `handleSim` after `simulateNpcFights`.

---

## Hiring Flow

On the Coach Recruiting page:

1. Player clicks "Hire" on a coach in the pool.
2. Validate: hired coach count < `GYM_LEVEL_COACH_CAP[gymLevel]` AND `gym.balance >= COACH_HIRING_FEE[coach.skillLevel]`.
3. Deduct `COACH_HIRING_FEE[coach.skillLevel]` from `gym.balance`.
4. Set `coach.gymId = gym.id`.
5. Save both to DB.
6. Remove coach from the page's displayed pool.

---

## Release Flow

On Gym > Coaches page, each hired coach row gets a "Release" button:

1. Set `coach.gymId = null`.
2. Set `coach.assignedBoxerId = null`.
3. Save to DB.
4. Coach reappears in the recruiting pool.

---

## UI: Coach Recruiting Page (`src/pages/Players/CoachRecruiting.tsx`)

- Route: `/players/coaches`
- Sidebar entry: "Coaches" under Players section (between Recruiting and Compare)
- Shows all coaches where `gymId === null` AND `skillLevel ≤ gym's max coach skill`
- Callout: "Coaches: X / Y" (hired count vs cap)
- Table columns: Name | Skill Level | Style | Monthly Salary | Hiring Fee | Action
- "Hire" button disabled with tooltip when: at cap ("Roster full") or insufficient funds ("Insufficient funds")

---

## UI: Gym > Coaches Changes (`src/pages/Gym/Coaches.tsx`)

- Load coaches by `gymId === gym.id` instead of from `gym.coachIds`
- Add "Release" button to each coach row in both the Roster assignment table and Available Coaches section
- "Available Coaches" section title changes to "Unassigned Coaches" (they're hired but not assigned to a boxer)

---

## Routing & Sidebar

- New route: `{ path: 'coaches', element: <CoachRecruiting /> }` under `/players`
- Sidebar `/players` gains: `{ to: '/players/coaches', label: 'Coaches' }`

---

## Testing

- `src/lib/coachSalaries.test.ts` — unit tests for month-counting logic and salary deduction calculation
- `src/pages/Players/CoachRecruiting.test.ts` — verify pool filtering by gym level cap and available funds
