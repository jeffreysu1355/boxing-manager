# Hover Comparison Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a tooltip-style popup comparing all 17 stats between the user's selected boxer and a hovered opponent row on the Schedule fight screen.

**Architecture:** A `StatComparePopup` component renders in a React portal attached to `document.body`, positioned near the cursor via `onMouseMove` tracking. Hover state (cursor position + hovered opponent) is lifted into `Schedule.tsx` and passed down to `OpponentRow` as event handlers. The popup flips left when it would overflow the right edge of the viewport.

**Tech Stack:** React 18, TypeScript, CSS Modules, React portals (`ReactDOM.createPortal`)

---

### Task 1: Add hover state and mouse-tracking to OpponentRow

**Files:**
- Modify: `src/pages/League/Schedule.tsx`

- [ ] **Step 1: Add hover state to the Schedule component**

In `Schedule.tsx`, add the following state near the other `useState` declarations (around line 113):

```tsx
const [hoverState, setHoverState] = useState<{
  x: number;
  y: number;
  opponent: Boxer;
} | null>(null);
```

- [ ] **Step 2: Update OpponentRowProps interface to accept mouse handlers**

Find the `OpponentRowProps` interface (around line 602) and add three new optional props:

```tsx
interface OpponentRowProps {
  boxer: Boxer;
  gymBoxer: Boxer | null;
  label: 'Counters you' | 'Neutral' | 'You counter';
  booked: boolean;
  isSelected: boolean;
  onSelect: () => void;
  styles: Record<string, string>;
  onMouseEnter?: (e: React.MouseEvent, opponent: Boxer) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}
```

- [ ] **Step 3: Wire mouse handlers into OpponentRow's div**

In the `OpponentRow` function component, update the root `<div>` to call the new handlers:

```tsx
<div
  className={rowClass}
  onClick={onSelect}
  role="button"
  tabIndex={booked ? -1 : 0}
  onKeyDown={e => { if (!booked && (e.key === 'Enter' || e.key === ' ')) onSelect(); }}
  onMouseEnter={e => onMouseEnter?.(e, boxer)}
  onMouseMove={e => onMouseMove?.(e)}
  onMouseLeave={() => onMouseLeave?.()}
>
```

- [ ] **Step 4: Pass handlers to every OpponentRow call site**

There are two call sites in `Schedule.tsx` where `<OpponentRow>` is rendered (one for `opponentsByFed.size === 0` and one inside the federation group map). Update both to pass the three new props:

```tsx
<OpponentRow
  key={oppId}
  boxer={opp}
  gymBoxer={selectedGymBoxer}
  label={label}
  booked={booked}
  isSelected={isSelected}
  onSelect={() => { if (!booked) { setSelectedOpponentId(oppId); setIsTitleFight(false); } }}
  styles={styles}
  onMouseEnter={(e, opponent) => {
    if (!booked) setHoverState({ x: e.clientX, y: e.clientY, opponent });
  }}
  onMouseMove={e => {
    if (!booked) setHoverState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  }}
  onMouseLeave={() => setHoverState(null)}
/>
```

Apply this to **both** call sites (the flat list and the federation-grouped list).

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors related to `hoverState` or `OpponentRowProps`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/League/Schedule.tsx
git commit -m "feat: add hover state tracking to opponent rows in Schedule"
```

---

### Task 2: Build the StatComparePopup component

**Files:**
- Modify: `src/pages/League/Schedule.tsx`
- Modify: `src/pages/League/Schedule.module.css`

- [ ] **Step 1: Add popup CSS to Schedule.module.css**

Append the following to the end of `src/pages/League/Schedule.module.css`:

```css
.popup {
  position: fixed;
  z-index: 1000;
  background: var(--surface, #1a1a2e);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  min-width: 300px;
  max-width: 360px;
  font-size: 12px;
  pointer-events: none;
  padding: 10px 12px;
  color: var(--text-primary);
}

.popupHeader {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 6px;
}

.popupFighterName {
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.popupFighterMeta {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.popupFighterRight {
  text-align: right;
}

.popupMatchup {
  text-align: center;
  font-size: 11px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.popupSection {
  margin-top: 8px;
}

.popupSectionLabel {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}

.popupStatRow {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 4px;
  align-items: center;
  padding: 1px 0;
}

.popupStatName {
  text-align: center;
  color: var(--text-muted);
  font-size: 11px;
}

.popupStatLeft {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.popupStatRight {
  text-align: left;
  font-variant-numeric: tabular-nums;
}

.popupStatWin {
  color: var(--success);
  font-weight: 600;
}

.popupStatLose {
  color: var(--danger);
}
```

- [ ] **Step 2: Add the StatComparePopup component to Schedule.tsx**

Add the following import at the top of `Schedule.tsx` (after existing imports):

```tsx
import ReactDOM from 'react-dom';
```

Then add the `StatComparePopup` component at the bottom of `Schedule.tsx` (after the `OpponentRow` function):

```tsx
interface StatComparePopupProps {
  x: number;
  y: number;
  gymBoxer: Boxer;
  opponent: Boxer;
  matchupLabel: 'Counters you' | 'Neutral' | 'You counter';
  styles: Record<string, string>;
}

const STAT_SECTIONS: { label: string; stats: { key: keyof BoxerStats; name: string }[] }[] = [
  {
    label: 'Offense',
    stats: [
      { key: 'jab', name: 'Jab' },
      { key: 'cross', name: 'Cross' },
      { key: 'leadHook', name: 'Lead Hook' },
      { key: 'rearHook', name: 'Rear Hook' },
      { key: 'uppercut', name: 'Uppercut' },
    ],
  },
  {
    label: 'Defense',
    stats: [
      { key: 'headMovement', name: 'Head Mvmt' },
      { key: 'bodyMovement', name: 'Body Mvmt' },
      { key: 'guard', name: 'Guard' },
      { key: 'positioning', name: 'Positioning' },
    ],
  },
  {
    label: 'Mental',
    stats: [
      { key: 'timing', name: 'Timing' },
      { key: 'adaptability', name: 'Adaptability' },
      { key: 'discipline', name: 'Discipline' },
    ],
  },
  {
    label: 'Physical',
    stats: [
      { key: 'speed', name: 'Speed' },
      { key: 'power', name: 'Power' },
      { key: 'endurance', name: 'Endurance' },
      { key: 'recovery', name: 'Recovery' },
      { key: 'toughness', name: 'Toughness' },
    ],
  },
];

function StatComparePopup({ x, y, gymBoxer, opponent, matchupLabel: label, styles }: StatComparePopupProps) {
  const POPUP_WIDTH = 320;
  const OFFSET_X = 16;
  const OFFSET_Y = -8;

  const left = x + OFFSET_X + POPUP_WIDTH > window.innerWidth
    ? x - POPUP_WIDTH - OFFSET_X
    : x + OFFSET_X;
  const top = y + OFFSET_Y;

  const matchupClass =
    label === 'Counters you' ? styles.matchupCounter :
    label === 'You counter'  ? styles.matchupYou :
    styles.matchupNeutral;

  const popup = (
    <div
      className={styles.popup}
      style={{ left, top }}
    >
      <div className={styles.popupHeader}>
        <div>
          <div className={styles.popupFighterName}>{gymBoxer.name}</div>
          <div className={styles.popupFighterMeta}>{calcRecord(gymBoxer.record)} · {gymBoxer.reputation}</div>
          <div className={styles.popupFighterMeta}>{gymBoxer.style}</div>
        </div>
        <div className={styles.popupFighterRight}>
          <div className={styles.popupFighterName}>{opponent.name}</div>
          <div className={styles.popupFighterMeta}>{calcRecord(opponent.record)} · {opponent.reputation}</div>
          <div className={styles.popupFighterMeta}>{opponent.style}</div>
        </div>
      </div>

      <div className={styles.popupMatchup}>
        <span className={matchupClass}>{label}</span>
      </div>

      {STAT_SECTIONS.map(section => (
        <div key={section.label} className={styles.popupSection}>
          <div className={styles.popupSectionLabel}>{section.label}</div>
          {section.stats.map(({ key, name }) => {
            const gymVal = gymBoxer.stats[key];
            const oppVal = opponent.stats[key];
            const gymWins = gymVal > oppVal;
            const oppWins = oppVal > gymVal;
            return (
              <div key={key} className={styles.popupStatRow}>
                <span className={`${styles.popupStatLeft} ${gymWins ? styles.popupStatWin : oppWins ? styles.popupStatLose : ''}`}>
                  {gymVal}
                </span>
                <span className={styles.popupStatName}>{name}</span>
                <span className={`${styles.popupStatRight} ${oppWins ? styles.popupStatWin : gymWins ? styles.popupStatLose : ''}`}>
                  {oppVal}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return ReactDOM.createPortal(popup, document.body);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/League/Schedule.tsx src/pages/League/Schedule.module.css
git commit -m "feat: add StatComparePopup component with portal rendering"
```

---

### Task 3: Render the popup in Schedule and wire it up end-to-end

**Files:**
- Modify: `src/pages/League/Schedule.tsx`

- [ ] **Step 1: Render StatComparePopup in the Panel 2 return**

In the `Schedule` component's Panel 2 return (the `return` block that renders the two-panel layout, starting around line 397), add the popup just before the closing `</div>` of the outermost `<div className={styles.page}>`:

```tsx
{hoverState && selectedGymBoxer && (
  <StatComparePopup
    x={hoverState.x}
    y={hoverState.y}
    gymBoxer={selectedGymBoxer}
    opponent={hoverState.opponent}
    matchupLabel={matchupLabel(selectedGymBoxer.style, hoverState.opponent.style)}
    styles={styles}
  />
)}
```

Note: `matchupLabel` is already defined as an exported function in `Schedule.tsx` — use it directly here.

- [ ] **Step 2: Verify the popup does not appear in Panel 1 (boxer picker)**

Panel 1's return block (around line 359) only shows the gym boxer list and has no `hoverState` usage — confirm that the `StatComparePopup` render is only inside the Panel 2 return, not Panel 1.

- [ ] **Step 3: Start dev server and test manually**

```bash
cd /Users/jefsu/Documents/workspace/boxing-manager && npm run dev
```

Open `http://localhost:5173` in a browser. Navigate to League → Schedule. Select a boxer, select an event, then hover over opponent rows. Verify:
- Popup appears near cursor with correct fighter names, records, reputations, and styles
- Stats are grouped into Offense / Defense / Mental / Physical sections
- Higher gym boxer stat = green on the left, red on the right
- Higher opponent stat = green on the right, red on the left
- Tied stats = no color
- Style matchup label is colored correctly (red for "Counters you", green for "You counter", muted for "Neutral")
- Popup flips left when near the right edge of the viewport
- Popup disappears when mouse leaves the row
- Booked (greyed-out) rows do not trigger the popup

- [ ] **Step 4: Commit**

```bash
git add src/pages/League/Schedule.tsx
git commit -m "feat: render hover comparison popup on opponent rows in Schedule"
```

---

### Self-Review Notes

**Spec coverage:**
- ✅ Hover on opponent row triggers popup — Task 1 (mouse handlers), Task 3 (render)
- ✅ Tooltip follows cursor — Task 1 (onMouseMove updates x/y)
- ✅ All 17 stats grouped by category — Task 2 (STAT_SECTIONS)
- ✅ Green = user's boxer is higher, Red = opponent higher — Task 2 (popupStatWin/popupStatLose)
- ✅ Header with names, record, reputation, style — Task 2 (popupHeader)
- ✅ Matchup indicator — Task 2 (popupMatchup), Task 3 (matchupLabel call)
- ✅ Portal rendering to avoid clipping — Task 2 (ReactDOM.createPortal)
- ✅ Viewport flip logic — Task 2 (left calculation)
- ✅ Booked rows don't trigger popup — Task 1 (`if (!booked)` guards on handlers)

**No placeholders detected.**

**Type consistency:** `BoxerStats` keys used in `STAT_SECTIONS` match `db.ts` exactly (jab, cross, leadHook, rearHook, uppercut, headMovement, bodyMovement, guard, positioning, timing, adaptability, discipline, speed, power, endurance, recovery, toughness). `calcRecord` and `matchupLabel` are used as already defined in `Schedule.tsx`.
