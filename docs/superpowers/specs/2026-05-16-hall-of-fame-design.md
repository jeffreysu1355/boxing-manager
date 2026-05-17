# Hall of Fame Design

**Date:** 2026-05-16
**Status:** Approved

## Overview

Three interconnected subsystems:
1. **NPC retirement** — auto-retire NPC boxers aged 35–45, weighted by career success
2. **HOF scoring** — compute a career score on retirement (player and NPC); induct automatically if score ≥ 50
3. **Hall of Fame storage + page** — dedicated IndexedDB store, League-tab page, TopNav notification on induction

---

## Section 1: NPC Retirement

### Trigger

Each simulated day, during the existing daily sim loop in `TopNav.tsx`, run a retirement check for every active NPC boxer (all boxers where `gymId !== playerGymId`) aged 35 or older who is not already retired.

### Probability formula

```
baseProbability    = (boxer.age - 34) * 0.002   // 0.2% at 35, 2% at 45
successDiscount    = REPUTATION_INDEX[boxer.reputation] * 0.0002  // 0–0.0018
dailyRetireChance  = max(0, baseProbability - successDiscount)
```

`REPUTATION_INDEX` values range 0 (Unknown) to 9 (All-Time Great), from `src/lib/reputationIndex.ts`.

**Hard cap:** Any NPC boxer reaching age 45 is forcibly retired regardless of the roll.

### On retirement

1. Mark `boxer.retired = true`
2. Run HOF scoring (Section 2)
3. Set `boxer.hofScore = score`
4. Save boxer via `putBoxer`
5. If inducted: write `HallOfFameEntry` to the `hallOfFame` store
6. Return `{ inducted: boolean, score: number, boxerName: string }` to the caller

NPC stat regression already applies via the existing aging system — no change needed.

---

## Section 2: HOF Scoring

### Function signature

```ts
export function calcHofScore(
  boxer: Boxer,
  allTitles: Title[],
  currentDate: string,
): number
```

All scoring is pure and synchronous. The caller passes `allTitles` (already fetched).

### Component 1: Career length (max 25 pts)

- Find earliest fight date in `boxer.record`; if no fights, score = 0
- `careerYears = daysBetween(firstFightDate, currentDate) / 365.25`
- `score = min(25, floor(careerYears))`

### Component 2: Peak rank + tenure (max 25 pts)

Each fight carries the boxer's reputation at that time. Since we don't store per-fight reputation snapshots, we use the fight record to approximate via the boxer's current + peak reputation:

- `peakRepIndex = REPUTATION_INDEX[boxer.reputation]` (reputation at retirement is peak, as rank only degrades slowly)
- `totalFights = boxer.record.length`
- `score = (peakRepIndex / 9) * 25`

This rewards fighters who achieved the highest reputation levels.

### Component 3: Title reigns (max 25 pts)

Scan `allTitles` for all `TitleReign` entries where `reign.boxerId === boxer.id`:

For each reign:
- Base: +5 pts
- Defenses: `+2 * reign.defenseCount`
- Duration: `reignYears = daysBetween(reign.dateWon, reign.dateLost ?? currentDate) / 365.25`; `+3 * floor(reignYears)`

`score = min(25, sum of all reign scores)`

### Component 4: Record quality (max 25 pts)

- `wins = record.filter(r => r.result === 'win').length`
- `losses = record.filter(r => r.result === 'loss').length`
- `totalFights = wins + losses + draws`
- `winRate = totalFights > 0 ? wins / totalFights : 0`
- `winRateScore = winRate * 15`  (max 15)
- `volumeScore = min(10, floor(totalFights / 10))`  (max 10)
- `score = winRateScore + volumeScore`

### Total

```
totalScore = careerLength + peakRank + titleReigns + recordQuality  // max 100
```

**HOF threshold: 50 points.**

---

## Section 3: HOF Storage

### New interface (`src/db/db.ts`)

```ts
export interface HallOfFameEntry {
  id?: number;
  boxerId: number;
  boxerName: string;
  weightClass: WeightClass;
  inductedDate: string;       // ISO date of retirement/induction
  score: number;
  peakReputation: ReputationLevel;
  record: { wins: number; losses: number; draws: number };
  totalFights: number;
  careerSpan: number;         // years (fractional) from first fight to retirement
  titlesWon: number;          // count of unique title reigns
  totalDefenses: number;
}
```

### New IndexedDB object store

Store name: `'hallOfFame'`, keyPath: `'id'`, autoIncrement.
Index: `'boxerId'` (unique) — prevents double-induction.

DB version bump required. Migration: create the store, no data backfill.

### New store file: `src/db/hallOfFameStore.ts`

```ts
export async function getAllHofEntries(): Promise<HallOfFameEntry[]>
export async function putHofEntry(entry: Omit<HallOfFameEntry, 'id'>): Promise<number>
export async function getHofEntryByBoxer(boxerId: number): Promise<HallOfFameEntry | undefined>
```

### Boxer schema addition

Add one optional field to `Boxer`:

```ts
hofScore?: number;  // set at retirement whether or not inducted
```

No migration needed — optional field.

---

## Section 4: Retirement Utility

### New file: `src/lib/retireBoxer.ts`

```ts
export interface RetireResult {
  inducted: boolean;
  score: number;
  boxerName: string;
}

export async function retireBoxer(
  boxer: Boxer,
  allTitles: Title[],
  currentDate: string,
): Promise<RetireResult>
```

Steps:
1. Compute `score = calcHofScore(boxer, allTitles, currentDate)`
2. Build updated boxer: `{ ...boxer, retired: true, hofScore: score }`
3. Save via `putBoxer`
4. If `score >= 50`: build and save `HallOfFameEntry` via `putHofEntry`
5. Return `{ inducted: score >= 50, score, boxerName: boxer.name }`

### Callers

**Player retirement (existing Retire button in `src/pages/Player/PlayerPage.tsx`):**
- Currently sets `retired: true` and calls `putBoxer` directly
- Replace with `retireBoxer(boxer, allTitles, currentDate)`
- On return: if `inducted`, show inline alert: `"[Name] has been inducted into the Hall of Fame! (Score: X)"`

**NPC auto-retirement (daily sim in `src/components/TopNav/TopNav.tsx`):**
- After each NPC retirement via `retireBoxer`, collect inducted results
- After sim completes, if any inductees, append to the existing notification banner (same pattern as `rankChanges` and `simmedFights`)

---

## Section 5: Hall of Fame Page

### Route

`/league/hall-of-fame` — added to `LeagueLayout.tsx` nav and `src/routes.tsx`.

### File: `src/pages/League/HallOfFame.tsx`

Loads all `HallOfFameEntry` records on mount, sorted by `score` descending.

**Table columns:**

| Name | Weight Class | Record | Peak Reputation | Career Span | Titles | Defenses | HOF Score |

- **Name** — links to `/player/:boxerId`
- **Weight Class** — capitalized
- **Record** — "W-L-D" format
- **Peak Reputation** — displayed as-is
- **Career Span** — `"X years"`
- **Titles** — `titlesWon` count
- **Defenses** — `totalDefenses` count
- **HOF Score** — numeric, one decimal place

Empty state: "No boxers have been inducted into the Hall of Fame yet."

### Navigation

Add "Hall of Fame" link to `LeagueLayout.tsx` nav alongside Standings, Calendar, Recent Results, Championship History.

---

## Section 6: TopNav Notification

In the daily sim, after all NPC retirements are processed, collect an array of `RetireResult` where `inducted === true`. If non-empty, add a new banner block (same pattern as `rankChanges`) showing:

```
Hall of Fame Inductee!
⭐ [Name] has been inducted into the Hall of Fame! (Score: X)
```

One entry per inductee, dismissible.

---

## Section 7: HOF Badge on Boxer Profile Page

On `src/pages/Player/PlayerPage.tsx`, if the boxer has `hofScore` set and a `HallOfFameEntry` exists for them (i.e. `hofScore >= 50`), display a badge near the boxer's name/header:

```
⭐ Hall of Fame (Score: X)
```

**Implementation:** On page load, after fetching the boxer, call `getHofEntryByBoxer(boxer.id)`. If an entry is returned, render the badge. The badge links to `/league/hall-of-fame`.

---

## Out of Scope

- Manual HOF nomination
- HOF page for NPC gyms (only one HOF, league-wide)
- Backfilling HOF scores for already-retired boxers
