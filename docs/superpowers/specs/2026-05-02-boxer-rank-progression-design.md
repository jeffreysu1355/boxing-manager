# Boxer Rank Progression System

**Date:** 2026-05-02  
**Status:** Approved

## Overview

Implement dynamic reputation progression for boxers. Reputation levels change based on fight outcomes, with cumulative points needed to promote and a demotion buffer protecting recently promoted boxers from immediate relegation.

## Scope

- All boxers (player-managed and AI) use the same rank update logic
- Updates trigger only after fights (no inactivity decay)
- World fight simulation (AI vs AI) is a separate future feature; this system is designed so that feature can call the same rank update function when implemented

---

## Data Model

Two new fields added to the `Boxer` interface in `src/db/db.ts`:

```typescript
rankPoints: number       // progress toward next reputation level (0 to threshold)
demotionBuffer: number   // absorbs losses before rank drops (0 to bufferMax)
```

Existing boxers in IndexedDB (migration): set `rankPoints = 0`, `demotionBuffer = bufferMax` for their current reputation level.

A `RANK_CONFIG` constant in `src/lib/rankSystem.ts` defines per-rank thresholds:

```typescript
const RANK_CONFIG: Record<ReputationLevel, { promotionThreshold: number; bufferMax: number; baseWinPoints: number }> = {
  'Unknown':                 { promotionThreshold: 20,       bufferMax: 10, baseWinPoints: 6  },
  'Local Star':              { promotionThreshold: 30,       bufferMax: 15, baseWinPoints: 8  },
  'Rising Star':             { promotionThreshold: 40,       bufferMax: 20, baseWinPoints: 10 },
  'Respectable Opponent':    { promotionThreshold: 55,       bufferMax: 25, baseWinPoints: 13 },
  'Contender':               { promotionThreshold: 70,       bufferMax: 30, baseWinPoints: 17 },
  'Championship Caliber':    { promotionThreshold: 85,       bufferMax: 35, baseWinPoints: 20 },
  'Nationally Ranked':       { promotionThreshold: 100,      bufferMax: 40, baseWinPoints: 23 },
  'World Class Fighter':     { promotionThreshold: 120,      bufferMax: 45, baseWinPoints: 27 },
  'International Superstar': { promotionThreshold: 150,      bufferMax: 50, baseWinPoints: 32 },
  'All-Time Great':          { promotionThreshold: Infinity, bufferMax: 50, baseWinPoints: 32 },
}
```

Same-rank wins take ~3-5 fights to promote at each level, increasing at higher ranks.

---

## Point Flow

All rank updates are handled by `applyRankChange(boxer, opponent, result, isTitleFight)` in `src/lib/rankSystem.ts`, called from `fightResultApplier.ts` after each fight.

### Opponent Gap Multiplier

Determined by `opponent.reputation` rank index minus `boxer.reputation` rank index:

| Gap | Win multiplier | Loss multiplier |
|-----|---------------|-----------------|
| +2 or more above | 1.5x | 0.3x |
| +1 above | 1.25x | 0.45x |
| Same rank (0) | 1.0x | 0.6x |
| -1 below | 0.4x | 0.9x |
| -2 or more below | 0.1x | 1.2x |

Loss multipliers are intentionally asymmetric: losing to a lower-ranked opponent is a bigger reputation hit; losing to a higher-ranked opponent is more forgivable.

### On a Win

1. `pointsEarned = baseWinPoints * opponentGapMultiplier` (floor: 0 — wins never give negative points)
2. If title fight: use `2.0x base` instead of gap multiplier
3. Add `pointsEarned` to `rankPoints`
4. If `rankPoints >= promotionThreshold`:
   - Increment `reputation` to next level
   - Set `rankPoints = 0`
   - Set `demotionBuffer = bufferMax` for the new rank

### On a Loss

1. `pointsLost = baseWinPoints * 0.6 * opponentGapMultiplier`
2. If title fight (win or loss): `pointsLost = 0` — no rank penalty for title fights on a loss
3. Drain `demotionBuffer` first: `demotionBuffer = max(0, demotionBuffer - pointsLost)`
4. Remaining overflow drains `rankPoints`: `rankPoints = max(0, rankPoints - overflow)`
5. If `rankPoints <= 0` AND `demotionBuffer <= 0`:
   - Decrement `reputation` to previous level
   - Set `rankPoints = promotionThreshold * 0.7` for the lower rank (prevents immediate re-promotion)
   - Set `demotionBuffer = bufferMax` for the lower rank

### On a Draw

No rank change in either direction.

### Edge Cases

- `Unknown` is the floor — losses there have no effect on rank fields
- `All-Time Great` is the ceiling — wins accumulate points with no promotion effect
- `rankPoints` and `demotionBuffer` are always `>= 0`

---

## UI Display

### Roster Page (boxer list row)

Add a compact rank indicator next to the reputation badge:
- Blue progress bar: `rankPoints / promotionThreshold`
- Amber segment below: `demotionBuffer / bufferMax`
- Tooltip on hover: "32 / 55 points to Contender · Buffer: 18 / 25"

### Boxer Detail View

A "Ranking" section showing:
- Current reputation level label
- Blue progress bar with exact numbers: "32 / 55 pts to next rank"
- Amber demotion buffer bar: "Buffer: 18 / 25"
- Last fight's rank delta: "+8 pts (same-rank win)" or "-5 pts (drained buffer)"

The last fight delta is stored as a new optional field `lastRankDelta?: { points: number; bufferPoints: number; promoted: boolean; demoted: boolean }` on `Boxer`, overwritten after each fight. It is not part of the permanent fight history.

### Post-Fight Summary

After a fight resolves, show rank change inline in the result modal:
- Normal: "Rising Star · +10 pts → 32 / 55"
- Promotion: "Promoted to Contender!"
- Demotion: "Demoted to Rising Star"

### Standings Page

No changes needed — Standings already sorts by `reputation`, which will now be dynamic.

---

## Implementation Touchpoints

| File | Change |
|------|--------|
| `src/db/db.ts` | Add `rankPoints`, `demotionBuffer`, `lastRankDelta?` to `Boxer` interface; bump DB version for migration |
| `src/lib/rankSystem.ts` | New file: `RANK_CONFIG`, `applyRankChange()`, `getOpponentGapMultiplier()` |
| `src/components/TopNav/fightResultApplier.ts` | Call `applyRankChange()` for both boxers after fight resolves |
| `src/db/worldGen.ts` | Initialize `rankPoints = 0`, `demotionBuffer = bufferMax` on boxer generation |
| `src/pages/Gym/Roster.tsx` | Add compact rank progress indicator to boxer list rows |
| Boxer detail component | Add "Ranking" section with progress/buffer bars and last fight delta |
| Fight result modal | Add rank change line to post-fight summary |
