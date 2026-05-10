# Staggered Federation Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spread federation events across the year (~bi-weekly cadence) by assigning each federation fixed week offsets, and show full federation names as section headers on the Schedule Fight page.

**Architecture:** Extract shared constants (`FEDERATION_ABBR`, `FEDERATION_WEEKS`) into `src/constants/federations.ts`, update the two event-generation sites (worldGen.ts and Schedule.tsx) to use per-federation week offsets, and update the Schedule Fight page section headers to render full names.

**Tech Stack:** TypeScript, React 18, Vite, IndexedDB (Dexie)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/constants/federations.ts` | **Create** | Single source of truth for `FEDERATION_ABBR` and `FEDERATION_WEEKS` |
| `src/db/worldGen.ts` | **Modify** | Remove local `FEDERATION_ABBR_MAP` + `QUARTER_WEEKS`; import from constants; use per-federation weeks |
| `src/pages/League/Schedule.tsx` | **Modify** | Remove local `FEDERATION_ABBR` + `QUARTER_WEEKS`; import from constants; use per-federation weeks; section headers use `fed.name` |
| `src/pages/League/Calendar.tsx` | **Modify** | Remove local `FEDERATION_ABBR`; import from constants |

---

### Task 1: Create `src/constants/federations.ts`

**Files:**
- Create: `src/constants/federations.ts`

- [ ] **Step 1: Create the constants file**

```typescript
import type { FederationName } from '../db/db';

export const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};

// Fixed week offsets per federation. IBF is quarterly (prestige). SABF/ABF have 3 events
// (lower prestige). AsBF/OBF include early-year slots (weeks 2 and 5) which are skipped
// at runtime when they fall outside the target year's bounds.
export const FEDERATION_WEEKS: Record<FederationName, number[]> = {
  'International Boxing Federation': [10, 23, 36, 49],
  'North America Boxing Federation': [4, 17, 30, 43],
  'European Boxing Federation':      [6, 19, 32, 45],
  'South America Boxing Federation': [8, 21, 34],
  'African Boxing Federation':       [12, 25, 38],
  'Asia Boxing Federation':          [15, 28, 41, 2],
  'Oceania Boxing Federation':       [18, 31, 44, 5],
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to the new file).

- [ ] **Step 3: Commit**

```bash
git add src/constants/federations.ts
git commit -m "feat: add shared federation constants (FEDERATION_ABBR, FEDERATION_WEEKS)"
```

---

### Task 2: Update `src/db/worldGen.ts`

**Files:**
- Modify: `src/db/worldGen.ts`

- [ ] **Step 1: Add import at the top of worldGen.ts**

Find the existing imports block (around line 1) and add:

```typescript
import { FEDERATION_ABBR, FEDERATION_WEEKS } from '../constants/federations';
```

- [ ] **Step 2: Remove the local `FEDERATION_ABBR_MAP` constant**

Remove these lines (currently around line 332–340):

```typescript
const FEDERATION_ABBR_MAP: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};
```

- [ ] **Step 3: Remove the local `QUARTER_WEEKS` constant**

Remove this line (currently around line 570):

```typescript
// Quarter week offsets: weeks 10, 23, 36, 49 (roughly Mar, Jun, Sep, Dec)
const QUARTER_WEEKS = [10, 23, 36, 49];
```

- [ ] **Step 4: Update `generateFederationEvents` to use per-federation weeks**

Replace the current function body (currently around lines 572–599):

```typescript
export async function generateFederationEvents(
  year: number,
  federationIds: { id: number; name: FederationName }[]
): Promise<void> {
  for (const fed of federationIds) {
    const abbr = FEDERATION_ABBR[fed.name];
    const weeks = FEDERATION_WEEKS[fed.name];
    // Deterministic stagger per federation (0–6 days) so events don't all land on the same day
    const stagger = Math.floor(Math.abs(fed.id * 13) % 7);

    for (const week of weeks) {
      const dayOfYear = week * 7 + stagger;
      const date = new Date(year, 0, dayOfYear);
      // Skip if week offset falls outside the target year (e.g. AsBF week 2, OBF week 5)
      if (date.getFullYear() !== year) continue;
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const isoDate = `${year}-${m}-${d}`;
      const monthName = MONTHS[date.getMonth()];
      const name = `${abbr} ${monthName} ${year}`;

      await putFederationEvent({
        federationId: fed.id,
        date: isoDate,
        name,
        fightIds: [],
      });
    }
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/worldGen.ts
git commit -m "feat: use per-federation week offsets in worldGen event generation"
```

---

### Task 3: Update `src/pages/League/Schedule.tsx`

**Files:**
- Modify: `src/pages/League/Schedule.tsx`

- [ ] **Step 1: Replace local constants with import**

Find the existing imports at the top of the file and add:

```typescript
import { FEDERATION_ABBR, FEDERATION_WEEKS } from '../../constants/federations';
```

Then remove these lines (currently around lines 39–50):

```typescript
export const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const QUARTER_WEEKS = [10, 23, 36, 49];
```

Note: `MONTH_NAMES` is only used in the auto-gen block below — keep it as a local const if it's still needed there, or inline it. Check usages with grep:

```bash
grep -n "MONTH_NAMES" /Users/jefsu/Documents/workspace/boxing-manager/src/pages/League/Schedule.tsx
```

If `MONTH_NAMES` is only used in the auto-gen block, keep it as a local const (renamed if desired); it does not need to move to constants.

- [ ] **Step 2: Update the auto-gen useEffect to use `FEDERATION_WEEKS`**

Find the auto-gen loop (currently around lines 148–174). Replace the inner `for` loop:

```typescript
for (const fed of federations) {
  if (fed.id === undefined) continue;
  const fedId = fed.id;
  const futureFedEvents = federationEvents.filter(
    e => e.federationId === fedId && e.date > gameDate
  );
  if (futureFedEvents.length < 2) {
    const abbr = FEDERATION_ABBR[fed.name] ?? fed.name;
    const stagger = Math.floor(Math.abs(fedId * 13) % 7);
    const weeks = FEDERATION_WEEKS[fed.name] ?? [10, 23, 36, 49];
    const newEvents: FederationEvent[] = [];
    for (const week of weeks) {
      const dayOfYear = week * 7 + stagger;
      const date = new Date(nextYear, 0, dayOfYear);
      // Skip if week offset falls outside the target year
      if (date.getFullYear() !== nextYear) continue;
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const isoDate = `${y}-${m}-${d}`;
      const monthName = MONTH_NAMES[date.getMonth()];
      const name = `${abbr} ${monthName} ${nextYear}`;
      const newId = await putFederationEvent({ federationId: fedId, date: isoDate, name, fightIds: [] });
      if (!cancelled) {
        newEvents.push({ id: newId, federationId: fedId, date: isoDate, name, fightIds: [] });
      }
    }
    updatedFederationEvents = [...updatedFederationEvents, ...newEvents];
  }
}
```

- [ ] **Step 3: Update the "Select an Event" section header to use full federation name**

Find the section header around line 441:

```typescript
{fed ? (FEDERATION_ABBR[fed.name] ?? fed.name) : `Federation ${fedId}`}
```

Replace with:

```typescript
{fed ? fed.name : `Federation ${fedId}`}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors. If `FEDERATION_ABBR` was exported from Schedule.tsx and imported elsewhere, grep for consumers:

```bash
grep -rn "from.*Schedule" /Users/jefsu/Documents/workspace/boxing-manager/src --include="*.ts" --include="*.tsx" | grep FEDERATION_ABBR
```

If anything imports `FEDERATION_ABBR` from Schedule.tsx, update those imports to point to `../../constants/federations` (or the equivalent relative path).

- [ ] **Step 5: Commit**

```bash
git add src/pages/League/Schedule.tsx
git commit -m "feat: stagger schedule events by federation, use full name as section header"
```

---

### Task 4: Update `src/pages/League/Calendar.tsx`

**Files:**
- Modify: `src/pages/League/Calendar.tsx`

- [ ] **Step 1: Replace local `FEDERATION_ABBR` with import**

Add import:

```typescript
import { FEDERATION_ABBR } from '../../constants/federations';
```

Remove these lines (currently around lines 16–24):

```typescript
export const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};
```

Also remove `FederationName` from the `import type` line in Calendar.tsx if it's no longer used directly there (it was only needed to type the local constant). Check:

```bash
grep -n "FederationName" /Users/jefsu/Documents/workspace/boxing-manager/src/pages/League/Calendar.tsx
```

If `FederationName` only appeared in the now-deleted constant, remove it from the `import type` statement.

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Smoke test in browser**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm run dev
```

Open the app, navigate to League > Calendar and League > Schedule. Verify:
- Calendar table still shows abbreviations in the Federation column (e.g. "NABF")
- Schedule Fight page section headers now show full names (e.g. "North America Boxing Federation")
- Individual event rows still show abbreviated names (e.g. "NABF March 2026")

- [ ] **Step 4: Commit**

```bash
git add src/pages/League/Calendar.tsx
git commit -m "refactor: import FEDERATION_ABBR from shared constants in Calendar"
```

---

### Task 5: Verify staggered event distribution on new game

- [ ] **Step 1: Start a new game and inspect events**

In the browser dev console (F12), after starting a new game run:

```javascript
const db = await import('/src/db/db.ts'); // or use IDB explorer
// Open IndexedDB > boxing-manager-db > federationEvents
// Verify events are spread across different months, not all clustering in Mar/Jun/Sep/Dec
```

Or navigate to League > Calendar after advancing a few months and confirm events from different federations appear in different months.

- [ ] **Step 2: Confirm IBF is quarterly**

Check that IBF events appear in approximately March, June, September, December — not every month.

- [ ] **Step 3: Confirm no events wrap to wrong year**

AsBF (week 2) and OBF (week 5) should only appear early in the NEXT year's auto-generation cycle, not appended to the current year's events. Since week 2 * 7 = day 14 (Jan 14) and week 5 * 7 = day 35 (Feb 4), these dates fall in the same year — actually they ARE valid for the given year. Double-check the year guard:

```typescript
// new Date(year, 0, 14).getFullYear() === year  → true, keeps the event
// new Date(year, 0, 35).getFullYear() === year  → true, keeps the event
```

Both are valid — the year guard only fires if dayOfYear > 365 pushes the date into the next year (which can happen at high week numbers like 52+ with stagger). Verify the early weeks work correctly by checking events appear in January/February as expected for AsBF/OBF.

- [ ] **Step 4: Final commit if any minor fixes were needed**

```bash
git add -p
git commit -m "fix: correct event year guard for AsBF/OBF early-year weeks"
```

Only commit if there were actual fixes. Skip if everything worked as expected.
