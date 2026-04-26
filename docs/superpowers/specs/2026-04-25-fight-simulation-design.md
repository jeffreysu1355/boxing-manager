# Fight Simulation Design

**Date:** 2026-04-25
**Status:** Approved

## Problem

"Sim Fight" in `TopNav.tsx` currently only advances the game date by 1 day. It does not compute a fight outcome, update boxer records, or update the Fight record in the DB.

## Goal

Implement fight simulation for "Sim Fight" (not "Play Fight"). Given two boxers and a scheduled fight, compute a winner, method, round, and time — then persist all results to the DB.

## Algorithm

### Stat Score

Weighted average of all 17 stats. Style-focus stats are weighted 2x, all others 1x:

```
statScore(boxer) = sum(stat * weight) / sum(weights)
```

Focus stats per style (from PRD):
- Out-Boxer: jab, cross, headMovement, guard, positioning, speed
- Swarmer: leadHook, rearHook, bodyMovement, positioning, endurance, toughness
- Slugger: rearHook, uppercut, power, endurance, recovery, toughness
- Counterpuncher: timing, adaptability, discipline, headMovement, bodyMovement, speed

Normalized to 0–1 by dividing by 20.

### Style Score

Rock-paper-scissors counters (from PRD):
- Out-Boxer → countered by Swarmer
- Swarmer → countered by Slugger
- Slugger → countered by Counterpuncher
- Counterpuncher → countered by Out-Boxer

Scoring for boxer A vs boxer B:
- A counters B: `1.0`
- Neutral: `0.5`
- B counters A: `0.0`

### Tier Gap & Random Weight

Reputation index (0–9): Unknown=0 … All-Time Great=9.

```
tierGap = abs(repIndexA - repIndexB)
randomWeight = max(0.01, 0.10 - tierGap * 0.01)
```

Gap of 0 → 10% random. Gap of 9 → 1% random.

### Win Probability

```
styleComponent = styleScore(A) * 0.20
statRatio      = statScore(A) / (statScore(A) + statScore(B))
statComponent  = statRatio * 0.70
randomComponent = (random < 0.5 ? 1 : 0) * randomWeight
total          = 0.20 + 0.70 + randomWeight

winProbA = (styleComponent + statComponent + randomComponent) / total
```

Winner = A if `Math.random() < winProbA`, else B. No draws from sim.

### Fight Outcome Details

**Margin** = `abs(winProbA - 0.5)`

| Margin | Method |
|--------|--------|
| > 0.35 | KO |
| > 0.20 | TKO |
| > 0.08 | Split Decision |
| ≤ 0.08 | Decision |

**Round:**
- KO: `rand(1, 6)`
- TKO: `rand(4, 10)`
- Decision / Split Decision: `12`

**Time:**
- KO/TKO: random `M:SS` (minutes 0–2, seconds 0–59)
- Decision / Split Decision: `"3:00"`

**Finishing move:**
- KO/TKO: random pick from winner's style `FINISH_MOVES`
- Decision / Split Decision: `null`

`FINISH_MOVES` (same as worldGen):
```ts
{
  'out-boxer':      ['Jab', 'Cross', 'Right Cross'],
  'swarmer':        ['Lead Hook', 'Rear Hook', 'Body Shot'],
  'slugger':        ['Rear Hook', 'Uppercut', 'Overhand Right'],
  'counterpuncher': ['Counter Right', 'Counter Left Hook', 'Body Counter'],
}
```

## Architecture

### New file: `src/lib/fightSim.ts`

Pure function — no DB access, fully testable:

```ts
export interface FightSimResult {
  winnerId: number;
  loserId: number;
  method: FightMethod;
  finishingMove: string | null;
  round: number;
  time: string;
  winnerRecord: FightRecord;
  loserRecord: FightRecord;
}

export function simulateFight(
  boxerA: Boxer,
  boxerB: Boxer,
  fight: Fight,
  federationName: string,
): FightSimResult
```

`boxerA` is always the gym boxer. `boxerB` is the opponent. Both must have valid `id` fields.

### Updated: `TopNav.tsx` — `handleSimFight`

Current behavior: advances date by 1, runs training.

New behavior:
1. Find the `CalendarEvent` of type `'fight'` for today that involves a gym boxer
2. Load the `Fight`, both `Boxer` records, and the `Federation`
3. Call `simulateFight`
4. Persist to DB:
   - Update `Fight` with `winnerId`, `method`, `finishingMove`, `round`, `time`
   - Push `winnerRecord` onto winner boxer's `record` array, save boxer
   - Push `loserRecord` onto loser boxer's `record` array, save boxer
   - If `fight.isTitleFight`: update `Title` — set `currentChampionId`, close previous champion's reign (`dateLost = fight.date`), open new reign for winner
   - Update `FightContract` status to `'completed'`
5. Advance date by 1 day
6. Run training for that 1 day

### Multiple fights on the same day

If multiple gym boxers have fights on the same day, simulate all of them before advancing the date.

## FightRecord format

```ts
{
  result: 'win' | 'loss',
  opponentName: string,        // opponent's boxer.name
  opponentId: number,          // opponent's boxer.id
  method: string,              // e.g. 'KO', 'Decision'
  finishingMove: string | null,
  round: number,
  time: string,
  federation: string,          // federation name string
  date: string,                // fight.date (ISO: '2026-03-14') — stored as-is
}
```

## Out of Scope

- Play Fight (round-by-round interactive)
- Reputation changes after fight
- Injury generation from fights
- Gym balance payout (contract payout)
- PPV revenue calculation
