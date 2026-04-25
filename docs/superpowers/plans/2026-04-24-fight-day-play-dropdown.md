# Fight Day Play Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the game date lands on a fight day, replace the normal Play dropdown options with "Play Fight" (navigates to a placeholder fight page) and "Sim Fight" (advances date past the fight and clears the banner).

**Architecture:** `TopNav` already tracks `fightStop: CalendarEvent | null`. We derive all fight-day CalendarEvents from the existing `events` array and expose them as `todayFightEvents`. The dropdown conditionally renders fight-day items vs normal sim items based on whether `todayFightEvents` is non-empty. A new `FightPage` placeholder is added at `/fight/:fightId`.

**Tech Stack:** React 18, TypeScript, React Router v7, IndexedDB (idb), CSS Modules

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/pages/Fight/FightPage.tsx` | Create | Placeholder fight page |
| `src/routes.tsx` | Modify | Register `/fight/:fightId` route |
| `src/components/TopNav/TopNav.tsx` | Modify | Derive `todayFightEvents`; swap dropdown items on fight day; handle Sim Fight stub and Play Fight nav |

---

### Task 1: Create the placeholder FightPage

**Files:**
- Create: `src/pages/Fight/FightPage.tsx`

- [ ] **Step 1: Create the placeholder component**

Create `src/pages/Fight/FightPage.tsx` with this exact content:

```tsx
import { useParams, useNavigate } from 'react-router';

export default function FightPage() {
  const { fightId } = useParams<{ fightId: string }>();
  const navigate = useNavigate();

  return (
    <div style={{ padding: '32px 24px' }}>
      <button
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 13, marginBottom: 16 }}
        onClick={() => navigate(-1)}
      >
        &larr; Back
      </button>
      <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Fight #{fightId}</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Fight page coming soon.</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file exists and TypeScript is happy**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `FightPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Fight/FightPage.tsx
git commit -m "feat: add placeholder FightPage"
```

---

### Task 2: Register the `/fight/:fightId` route

**Files:**
- Modify: `src/routes.tsx`

- [ ] **Step 1: Add the import and route**

In `src/routes.tsx`, add the import after the existing imports:

```tsx
import FightPage from './pages/Fight/FightPage';
```

Then inside the `children` array of the root `'/'` route (alongside `player/:id`), add:

```tsx
{ path: 'fight/:fightId', element: <FightPage /> },
```

The updated children array top section should look like:

```tsx
children: [
  { index: true, element: <Dashboard /> },
  { path: 'player/:id', element: <PlayerPage /> },
  { path: 'fight/:fightId', element: <FightPage /> },
  // ... rest unchanged
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes.tsx
git commit -m "feat: add /fight/:fightId route"
```

---

### Task 3: Fight-day dropdown in TopNav

**Files:**
- Modify: `src/components/TopNav/TopNav.tsx`

This task adds:
1. A derived `todayFightEvents` array — all `CalendarEvent`s with `type === 'fight'`, `date === currentDate`, and at least one `boxerId` in `gymBoxerIds`.
2. Conditional dropdown rendering: when `todayFightEvents` is non-empty, show "Play Fight" and "Sim Fight" instead of the three normal sim options.
3. `handlePlayFight` — navigates to `/fight/:fightId` using the first event's `fightId`.
4. `handleSimFight` — stub: advances `gym.currentDate` by 1 day, saves it, clears `fightStop`, re-fetches events. (No actual fight resolution yet.)

- [ ] **Step 1: Add `useNavigate` import**

`TopNav.tsx` currently imports from `react-router`:
```tsx
import { NavLink } from 'react-router';
```

Change it to:
```tsx
import { NavLink, useNavigate } from 'react-router';
```

- [ ] **Step 2: Wire `useNavigate` inside the component**

At the top of the `TopNav` function body, after the existing `useState`/`useRef` declarations, add:

```tsx
const navigate = useNavigate();
```

- [ ] **Step 3: Derive `todayFightEvents`**

After the `const currentDate = gym?.currentDate ?? '2026-01-01';` line, add:

```tsx
const todayFightEvents = events.filter(
  e => e.type === 'fight' && e.date === currentDate && e.boxerIds.some(id => gymBoxerIds.has(id))
);
const isOnFightDay = todayFightEvents.length > 0;
```

- [ ] **Step 4: Add `handlePlayFight` and `handleSimFight`**

Add these two handlers after `handleSim`:

```tsx
function handlePlayFight() {
  if (todayFightEvents.length === 0) return;
  setDropdownOpen(false);
  navigate(`/fight/${todayFightEvents[0].fightId}`);
}

async function handleSimFight() {
  if (!gym || isSimming) return;
  setIsSimming(true);
  setDropdownOpen(false);
  try {
    const updated: Gym = { ...gym, currentDate: addDays(currentDate, 1) };
    await saveGym(updated);
    setGym(updated);
    setFightStop(null);
    const [freshEvts, freshBoxers] = await Promise.all([
      getAllCalendarEvents(),
      getAllBoxers(),
    ]);
    setEvents(freshEvts);
    const freshGymId = updated.id ?? 1;
    const freshIds = new Set(
      freshBoxers
        .filter(b => b.gymId === freshGymId && b.id !== undefined)
        .map(b => b.id!)
    );
    setGymBoxerIds(freshIds);
  } finally {
    setIsSimming(false);
  }
}
```

- [ ] **Step 5: Replace the dropdown JSX**

Find the existing dropdown JSX:

```tsx
{dropdownOpen && (
  <div className={styles.dropdown}>
    <button className={styles.dropdownItem} onClick={() => handleSim(7)}>
      Sim 1 Week
    </button>
    <button className={styles.dropdownItem} onClick={() => handleSim(21)}>
      Sim 1 Month
    </button>
    <button className={styles.dropdownItem} onClick={() => handleSim('next')}>
      Sim to Next Event
    </button>
  </div>
)}
```

Replace it with:

```tsx
{dropdownOpen && (
  <div className={styles.dropdown}>
    {isOnFightDay ? (
      <>
        <button className={styles.dropdownItem} onClick={handlePlayFight}>
          Play Fight
        </button>
        <button className={styles.dropdownItem} onClick={handleSimFight}>
          Sim Fight
        </button>
      </>
    ) : (
      <>
        <button className={styles.dropdownItem} onClick={() => handleSim(7)}>
          Sim 1 Week
        </button>
        <button className={styles.dropdownItem} onClick={() => handleSim(21)}>
          Sim 1 Month
        </button>
        <button className={styles.dropdownItem} onClick={() => handleSim('next')}>
          Sim to Next Event
        </button>
      </>
    )}
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Smoke test manually**

```bash
npm run dev
```

1. Open the app. Sim to the next event (a fight day). Confirm the dropdown shows "Play Fight" and "Sim Fight" only — no normal sim options.
2. Click "Play Fight" — confirm navigation to `/fight/<id>` showing the placeholder page with a back button.
3. Go back. Open Play dropdown again and click "Sim Fight" — confirm the date advances by 1 day, the fight banner clears, and the dropdown returns to normal sim options.

- [ ] **Step 8: Commit**

```bash
git add src/components/TopNav/TopNav.tsx
git commit -m "feat: show Play Fight / Sim Fight on fight day in TopNav dropdown"
```
