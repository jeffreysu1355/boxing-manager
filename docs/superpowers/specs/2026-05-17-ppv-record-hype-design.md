# PPV Record Hype — Design Spec

**Date:** 2026-05-17  
**Status:** Approved

## Overview

Boxing records now influence PPV viewership. Two fighters with dominant win rates and active win streaks generate more hype — and more money — than two same-reputation fighters with mediocre records. The bonus stacks on top of the existing reputation rank and title fight multipliers.

## Formula

`viewers = base × homeFedBonus × rankBonus × titleBonus × recordMultiplier × streakMultiplier`

### Record Multiplier (win rate, geometric mean)

`recordMultiplier = 1.0 + min(0.4, max(0, sqrt(winRateA × winRateB) - 0.5) × 0.8)`

- Win rate per boxer = wins / totalFights (defaults to 0.5 if no fights)
- Geometric mean of both win rates: punishes lopsided matchups (90% vs 10% ≈ 0.3 geometric mean → small bonus)
- Range: 1.0× (both 50% win rate) to 1.4× (both 100% win rate)
- Two 80% fighters → geometric mean 0.8 → ~1.24×

### Streak Multiplier (recent momentum)

`streakMultiplier = 1.0 + min(0.15, sqrt((streakA/5) × (streakB/5)) × 0.15)`

- Streak = consecutive wins from the tail of `FightRecord[]`
- Capped at 5 for scaling purposes
- Range: 1.0× (neither on a streak) to 1.15× (both on 5+ win streaks)
- Both on 3-fight streaks → ~1.09×

### Combined ceiling

Max record × streak: 1.4 × 1.15 ≈ **+61% over base** — firmly in the "significant" range.

## Implementation

### `ppvCalc.ts`

Add two helpers (pure functions, easily testable):

```ts
function calcRecordMultiplier(recordA: FightRecord[], recordB: FightRecord[]): number
function calcStreakMultiplier(recordA: FightRecord[], recordB: FightRecord[]): number
```

`calcViewers` gains two new optional params:

```ts
gymBoxerRecord?: FightRecord[]   // defaults to [] → 0.5 win rate, 0 streak
opponentRecord?: FightRecord[]   // defaults to [] → 0.5 win rate, 0 streak
```

Win rate and streak are derived internally. Callers that don't pass records get neutral multipliers (1.0×) — no breaking changes.

### `fightResultApplier.ts`

The existing PPV payout block already has `winner` and `loser` boxer objects with full `.record[]` arrays. Pass `gymBoxer.record` and `opponent.record` into `calcViewers`.

### Tests (`ppvCalc.test.ts`)

- Two undefeated fighters → record multiplier ≈ 1.4
- 90% vs 10% → record multiplier ≈ 1.0 (geometric mean ~0.3, below 0.5 anchor → no bonus)
- Both on 5-fight streaks → streak multiplier = 1.15
- One on streak, one at 0 → streak multiplier ≈ 1.0
- Combined: both 80% win rate + both 3-fight streaks → correct stacked value
- Empty records (new fighters) → both multipliers = 1.0 (neutral)

## What doesn't change

- `calcPpvPayout` — unchanged
- PPV network data model — unchanged
- DB schema — no migration needed
- Reputation rank bonus — unchanged, record bonus stacks on top
