# Coaches Page — Design Spec

**Date:** 2026-04-19

## Overview

The Coaches page lives under the Gym tab. It shows all gym boxers with their assigned coach (boxer-centric), and a list of unassigned coaches below. Assignments can be changed via a dropdown per boxer row.

## World Gen Changes

Add 11 coaches to `generateWorld()` after the gym is created:

- **10 local coaches** — styles distributed across all 4 fighting styles (2-3 per style, randomly assigned so distribution varies slightly each world gen)
- **1 contender coach** — random style

All coaches start with `assignedBoxerId: null`.

After creating the coaches, update the gym record to include all 11 coach IDs in `gym.coachIds` via `saveGym()`.

Coach names: use the existing `generateName()` helper with a random federation name for variety.

## Data Model

No schema changes needed. Uses existing `Coach` interface:
```typescript
interface Coach {
  id?: number;
  name: string;
  skillLevel: CoachSkillLevel; // 'local' | 'contender' | 'championship-caliber' | 'all-time-great'
  style: FightingStyle;
  assignedBoxerId: number | null;
}
```

Assignment is tracked on the coach record (`assignedBoxerId`), not on the boxer.

## Page Layout

```
[PageHeader: Coaches]

[Section: Roster]
  Table: Name | Style | Reputation | Coach (dropdown)

[Section: Available Coaches]
  Table: Name | Skill Level | Style
```

### Roster Section

- Lists all boxers where `boxer.gymId === gym.id`
- **Name** links to `/player/:id`
- **Coach dropdown** options:
  - "None" (value: empty string) — unassigns any current coach
  - One option per coach: "{coach.name} ({skillLabel})" — e.g. "Marcus Webb (Local)"
- The selected value for each boxer row is the id of the coach whose `assignedBoxerId === boxer.id`, or "None" if no coach is assigned
- Empty state: "No boxers on your roster yet."

### Available Coaches Section

- Lists all coaches where `coach.assignedBoxerId === null`
- Columns: Name | Skill Level | Style
- Updates reactively when assignments change
- Empty state: "No coaches available."

## Assignment Logic

On dropdown change for a boxer:

1. If a new coach is selected:
   - If that coach was previously assigned to another boxer, that boxer's slot simply shows "None" (derived from coach records — no boxer record changes needed)
   - Set `coach.assignedBoxerId = boxer.id`, save via `putCoach()`
2. If "None" is selected:
   - Find the coach currently assigned to this boxer (`assignedBoxerId === boxer.id`)
   - Set `coach.assignedBoxerId = null`, save via `putCoach()`

All state is derived from the coaches array — a boxer's "assigned coach" is found by scanning coaches for `assignedBoxerId === boxer.id`.

## Skill Level Display Labels

| DB value | Display label |
|---|---|
| `local` | Local |
| `contender` | Contender |
| `championship-caliber` | Championship Caliber |
| `all-time-great` | All-Time Great |

## Style Display Labels

Same helper as existing pages: split on `-`, capitalize each word. e.g. `out-boxer` → `Out-Boxer`.

## State Management

Single load on mount:
1. `getGym()` — to get `gym.id` for filtering roster
2. `getAllCoaches()` — full coach list
3. `getAllBoxers()` — filter to `gymId === gym.id` for roster

All subsequent updates are local state + single `putCoach()` call. No full reloads after assignment changes.

## Files to Create/Modify

- **Modify** `src/db/worldGen.ts` — add coach seeding after gym creation
- **Modify** `src/pages/Gym/Coaches.tsx` — full UI
- **Create** `src/pages/Gym/Coaches.module.css` — styles
