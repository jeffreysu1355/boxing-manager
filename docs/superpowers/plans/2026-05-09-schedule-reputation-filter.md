# Schedule Fight: Opponent Reputation Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reputation filter bar (arrow buttons + dropdown) above the opponent list on the Schedule Fight page, defaulting to the selected gym boxer's reputation and resetting on boxer/event change.

**Architecture:** All changes are contained to `Schedule.tsx` and `Schedule.module.css`. A new `reputationFilter` state variable controls which reputation tier is displayed; opponents are filtered and sorted before the existing federation-grouping logic runs.

**Tech Stack:** React 18, TypeScript, CSS Modules

---

### Task 1: Add `REPUTATION_LEVELS` constant and `reputationFilter` state

**Files:**
- Modify: `src/pages/League/Schedule.tsx`

- [ ] **Step 1: Add the ordered `REPUTATION_LEVELS` array after the existing `REPUTATION_INDEX` constant (around line 36)**

  Open `src/pages/League/Schedule.tsx`. After the closing `}` of `REPUTATION_INDEX`, add:

  ```ts
  const REPUTATION_LEVELS: ReputationLevel[] = [
    'Unknown',
    'Local Star',
    'Rising Star',
    'Respectable Opponent',
    'Contender',
    'Championship Caliber',
    'Nationally Ranked',
    'World Class Fighter',
    'International Superstar',
    'All-Time Great',
  ];
  ```

- [ ] **Step 2: Add `reputationFilter` state inside the `Schedule` component**

  In the `Schedule` function body, after the existing `useState` declarations (around line 116), add:

  ```ts
  const [reputationFilter, setReputationFilter] = useState<ReputationLevel | null>(null);
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npm run build 2>&1 | tail -20`
  Expected: no TypeScript errors (build may warn about other things but must not error on Schedule.tsx)

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/League/Schedule.tsx
  git commit -m "feat: add REPUTATION_LEVELS constant and reputationFilter state"
  ```

---

### Task 2: Wire reset behavior into existing event handlers

**Files:**
- Modify: `src/pages/League/Schedule.tsx`

The page has two places where selections are cleared:
1. The "Back to boxer list" button — clears boxer, event, opponent
2. The event row `onClick` — clears opponent when a new event is picked

- [ ] **Step 1: Reset `reputationFilter` to `null` in the "Back to boxer list" button handler**

  Find this onClick (around line 395):
  ```ts
  onClick={() => { setSelectedBoxerId(null); setSelectedEventId(null); setSelectedOpponentId(null); setIsTitleFight(false); }}
  ```
  Replace with:
  ```ts
  onClick={() => {
    setSelectedBoxerId(null);
    setSelectedEventId(null);
    setSelectedOpponentId(null);
    setReputationFilter(null);
    setIsTitleFight(false);
  }}
  ```

- [ ] **Step 2: Set `reputationFilter` to the boxer's reputation when an event is selected**

  Find the event row `onClick` handler (around line 429):
  ```ts
  onClick={() => {
    setSelectedEventId(ev.id);
    setSelectedOpponentId(null);
    setIsTitleFight(false);
  }}
  ```
  Replace with:
  ```ts
  onClick={() => {
    setSelectedEventId(ev.id);
    setSelectedOpponentId(null);
    setReputationFilter(selectedGymBoxer?.reputation ?? null);
    setIsTitleFight(false);
  }}
  ```
  Also update the matching `onKeyDown` handler directly below it the same way:
  ```ts
  onKeyDown={e => {
    if (e.key === 'Enter' || e.key === ' ') {
      setSelectedEventId(ev.id);
      setSelectedOpponentId(null);
      setReputationFilter(selectedGymBoxer?.reputation ?? null);
      setIsTitleFight(false);
    }
  }}
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npm run build 2>&1 | tail -20`
  Expected: no errors on Schedule.tsx

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/League/Schedule.tsx
  git commit -m "feat: reset reputationFilter on boxer/event change"
  ```

---

### Task 3: Filter and sort opponents by `reputationFilter`

**Files:**
- Modify: `src/pages/League/Schedule.tsx`

- [ ] **Step 1: Derive `filteredOpponents` from `opponents`**

  Find the existing `opponents` derivation (around line 282):
  ```ts
  const opponents = selectedGymBoxer && selectedEvent
    ? boxers.filter(b => {
        if (b.id === undefined) return false;
        if (gymBoxerIds.has(b.id)) return false;
        if (b.weightClass !== selectedGymBoxer.weightClass) return false;
        return true;
      })
    : [];
  ```
  Add directly after it:
  ```ts
  const filteredOpponents = reputationFilter !== null
    ? opponents
        .filter(b => b.reputation === reputationFilter)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  ```

- [ ] **Step 2: Re-derive `opponentsByFed` from `filteredOpponents` instead of `opponents`**

  Find the `opponentsByFed` block (around line 292):
  ```ts
  const opponentsByFed = new Map<number, Boxer[]>();
  for (const opp of opponents) {
  ```
  Change `opponents` to `filteredOpponents`:
  ```ts
  const opponentsByFed = new Map<number, Boxer[]>();
  for (const opp of filteredOpponents) {
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npm run build 2>&1 | tail -20`
  Expected: no errors on Schedule.tsx

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/League/Schedule.tsx
  git commit -m "feat: filter opponents by reputationFilter"
  ```

---

### Task 4: Add CSS for the reputation filter bar

**Files:**
- Modify: `src/pages/League/Schedule.module.css`

- [ ] **Step 1: Append the filter bar styles**

  Add to the end of `src/pages/League/Schedule.module.css`:

  ```css
  .reputationFilter {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .reputationFilterArrow {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    border-radius: 3px;
    width: 24px;
    height: 24px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .reputationFilterArrow:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .reputationFilterArrow:not(:disabled):hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .reputationFilterSelect {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-primary);
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 13px;
    cursor: pointer;
    flex: 1;
  }

  .reputationFilterSelect:focus {
    outline: none;
    border-color: var(--accent);
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/pages/League/Schedule.module.css
  git commit -m "feat: add CSS for reputation filter bar"
  ```

---

### Task 5: Render the reputation filter bar in the opponent panel

**Files:**
- Modify: `src/pages/League/Schedule.tsx`

- [ ] **Step 1: Replace the opponent panel content with the filter bar + updated empty states**

  Find the right column (opponent panel) content starting at the comment `{/* Right column: opponents */}` (around line 459). The panel currently looks like:

  ```tsx
  {/* Right column: opponents */}
  <div className={styles.panel}>
    <div className={styles.panelTitle}>Select an Opponent</div>
    {!selectedEvent && (
      <p className={styles.empty}>Select an event first.</p>
    )}
    {selectedEvent && opponents.length === 0 && (
      <p className={styles.empty}>No available opponents for this weight class.</p>
    )}
    {selectedEvent && opponents.length > 0 && (
      <>
        {opponentsByFed.size === 0 && opponents.map(opp => {
  ```

  Replace the entire right panel JSX (from `{/* Right column: opponents */}` through its closing `</div>`) with:

  ```tsx
  {/* Right column: opponents */}
  <div className={styles.panel}>
    <div className={styles.panelTitle}>Select an Opponent</div>

    {selectedEvent && reputationFilter !== null && (
      <div className={styles.reputationFilter}>
        <button
          className={styles.reputationFilterArrow}
          disabled={REPUTATION_LEVELS.indexOf(reputationFilter) === 0}
          onClick={() => {
            const idx = REPUTATION_LEVELS.indexOf(reputationFilter);
            if (idx > 0) setReputationFilter(REPUTATION_LEVELS[idx - 1]);
          }}
        >
          ‹
        </button>
        <select
          className={styles.reputationFilterSelect}
          value={reputationFilter}
          onChange={e => setReputationFilter(e.target.value as ReputationLevel)}
        >
          {REPUTATION_LEVELS.map(rep => (
            <option key={rep} value={rep}>{rep}</option>
          ))}
        </select>
        <button
          className={styles.reputationFilterArrow}
          disabled={REPUTATION_LEVELS.indexOf(reputationFilter) === REPUTATION_LEVELS.length - 1}
          onClick={() => {
            const idx = REPUTATION_LEVELS.indexOf(reputationFilter);
            if (idx < REPUTATION_LEVELS.length - 1) setReputationFilter(REPUTATION_LEVELS[idx + 1]);
          }}
        >
          ›
        </button>
      </div>
    )}

    {!selectedEvent && (
      <p className={styles.empty}>Select an event first.</p>
    )}
    {selectedEvent && filteredOpponents.length === 0 && (
      <p className={styles.empty}>No opponents at this reputation level.</p>
    )}
    {selectedEvent && filteredOpponents.length > 0 && (
      <>
        {opponentsByFed.size === 0 && filteredOpponents.map(opp => {
          if (opp.id === undefined) return null;
          const oppId = opp.id;
          const booked = opponentsBookedForEvent.has(oppId);
          const isSelected = selectedOpponentId === oppId;
          const label = selectedGymBoxer ? matchupLabel(selectedGymBoxer.style, opp.style) : 'Neutral';
          return (
            <OpponentRow
              key={oppId}
              boxer={opp}
              gymBoxer={selectedGymBoxer}
              label={label}
              booked={booked}
              isSelected={isSelected}
              onSelect={() => { if (!booked) { setSelectedOpponentId(oppId); setIsTitleFight(false); } }}
              styles={styles}
            />
          );
        })}
        {opponentsByFed.size > 0 && Array.from(opponentsByFed.entries())
          .sort(([aId], [bId]) => aId - bId)
          .map(([fedId, opps]) => {
            const fed = fedMap.get(fedId);
            return (
              <div key={fedId} className={styles.federationGroup}>
                <div className={styles.federationGroupLabel}>
                  {fed ? (FEDERATION_ABBR[fed.name] ?? fed.name) : `Federation ${fedId}`}
                </div>
                {opps.map(opp => {
                  if (opp.id === undefined) return null;
                  const oppId = opp.id;
                  const booked = opponentsBookedForEvent.has(oppId);
                  const isSelected = selectedOpponentId === oppId;
                  const label = selectedGymBoxer ? matchupLabel(selectedGymBoxer.style, opp.style) : 'Neutral';
                  return (
                    <OpponentRow
                      key={oppId}
                      boxer={opp}
                      gymBoxer={selectedGymBoxer}
                      label={label}
                      booked={booked}
                      isSelected={isSelected}
                      onSelect={() => { if (!booked) { setSelectedOpponentId(oppId); setIsTitleFight(false); } }}
                      styles={styles}
                    />
                  );
                })}
              </div>
            );
          })}
      </>
    )}
  </div>
  ```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

  Run: `npm run build 2>&1 | tail -20`
  Expected: build succeeds with no TypeScript errors

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/League/Schedule.tsx
  git commit -m "feat: render reputation filter bar in opponent panel"
  ```

---

### Task 6: Manual smoke test

- [ ] **Step 1: Start the dev server**

  Run: `npm run dev`
  Open browser to the URL shown (typically `http://localhost:5173`).

- [ ] **Step 2: Navigate to Schedule Fight**

  Go to League → Schedule (or use the Schedule Fight button from the Roster page).

- [ ] **Step 3: Verify filter bar appears after selecting an event**

  - Select a boxer, then select an event
  - Confirm the `‹ [Reputation Level ▾] ›` bar appears above the opponent list
  - Confirm the dropdown shows the boxer's own reputation level by default

- [ ] **Step 4: Verify arrow buttons and dropdown work**

  - Click `›` — confirm reputation steps up one level and opponent list refreshes
  - Click `‹` — confirm it steps back down
  - Confirm `‹` is disabled at "Unknown" (first level)
  - Confirm `›` is disabled at "All-Time Great" (last level)
  - Change the dropdown directly — confirm list updates immediately

- [ ] **Step 5: Verify reset behavior**

  - Select a boxer with reputation X, pick an event, change the filter to a different level
  - Click "Back to boxer list", pick the same (or different) boxer and a new event
  - Confirm the filter resets to that boxer's reputation level, not the previously selected level

- [ ] **Step 6: Verify empty state**

  - Step the filter to a reputation level with no opponents
  - Confirm "No opponents at this reputation level." message appears

- [ ] **Step 7: Stop dev server** (`Ctrl+C`)
