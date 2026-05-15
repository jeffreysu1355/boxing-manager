# In-Fight Tactics System — Design Spec

**Date**: 2026-05-14  
**Status**: Approved

---

## Overview

An interactive, round-based fight system that activates when the player clicks "Play Fight" instead of "Sim Fight" on fight day. The player makes tactical decisions each round (category focus + stat spotlight), watches health/stamina change, and sees a body-damage outline update in real time. The fight produces the same `FightSimResult` as the auto-sim, extended with a `roundLog` for post-fight review.

---

## Trigger & Entry Point

- On fight day, "Play Fight" in the TopNav dropdown navigates to `/fight/{fightId}` (existing route).
- `FightPage.tsx` detects that the fight is unresolved and renders the interactive fight UI instead of the current "not yet played" placeholder.
- "Sim Fight" continues to use the existing auto-sim path unchanged.

---

## Data Model Changes

### `db.ts` — `Fight` interface
Add one optional field:
```ts
roundLog?: RoundLogEntry[];
```

### `db.ts` — DB version bump
Increment DB version to 15. The upgrade step is a no-op comment (new optional field on existing records, no structural change needed).

### New types (in `fightSim.ts`)

```ts
export type StatCategory = 'offense' | 'defense' | 'mental' | 'physical';

export const STAT_CATEGORIES: Record<StatCategory, (keyof BoxerStats)[]> = {
  offense:  ['jab', 'cross', 'leadHook', 'rearHook', 'uppercut'],
  defense:  ['headMovement', 'bodyMovement', 'guard', 'positioning'],
  mental:   ['timing', 'adaptability', 'discipline'],
  physical: ['speed', 'power', 'endurance', 'recovery', 'toughness'],
};

export interface RoundLogEntry {
  round: number;
  playerFocus: { category: StatCategory; stat: keyof BoxerStats };
  playerDamageDealt: number;
  opponentDamageDealt: number;
  playerScoreThisRound: number;   // 10 or 9 (or 8 on knockdown)
  opponentScoreThisRound: number;
  adaptationPenalty: number;      // 0.0–0.5
  knockdownOccurred: boolean;
  narrative: string;
}

export interface FightState {
  round: number;                          // next round to simulate (starts at 1)
  playerHealth: number;                   // 0–100
  opponentHealth: number;                 // 0–100
  playerStamina: number;                  // 0–100
  opponentStamina: number;                // 0–100
  playerScore: number;                    // cumulative judge points
  opponentScore: number;
  repeatCount: number;                    // consecutive rounds with same stat choice
  lastPlayerStat: keyof BoxerStats | null;
  lastPlayerCategory: StatCategory | null;
  roundLog: RoundLogEntry[];
  finished: boolean;
  result?: Pick<FightSimResult, 'winnerId' | 'loserId' | 'method' | 'finishingMove' | 'round' | 'time'>;
}
```

### Extended `FightSimResult`
```ts
export interface FightSimResult {
  // ... all existing fields unchanged ...
  roundLog?: RoundLogEntry[];  // populated by interactive path only
}
```

---

## Round Simulation Engine

New pure function in `fightSim.ts`:

```ts
export function simulateRound(
  state: FightState,
  player: Boxer,
  opponent: Boxer,
  choice: { category: StatCategory; stat: keyof BoxerStats },
): FightState
```

### Stamina Drain (both boxers each round)
```
drain = BASE_DRAIN - (endurance * 0.8 + toughness * 0.4) / 2
BASE_DRAIN = 12
```
- endurance=20, toughness=20 → ~4%/round
- endurance=5,  toughness=5  → ~9%/round
- Clamped to minimum 2%/round, maximum 15%/round

### Effective Stats (stamina debuff)
```
effectiveStats = boxer.stats * (0.4 + 0.6 * stamina / 100)
```
At 100% stamina = full stats. At 0% stamina = 40% of stats.

### Adaptation Penalty (stack-based decay)
- `adaptationPenalty = min(0.5, repeatCount * PENALTY_RATE)`
- Default `PENALTY_RATE = 0.10` per consecutive repeat
- If opponent's `adaptability ≥ 15`: `PENALTY_RATE = 0.15`
- `repeatCount` increments when player picks the **same stat** as last round; resets to 0 on switch
- Penalty applies to player's attack output only

### Damage Calculation
```
playerAttack   = effectiveStatScore(player, choice.category, choice.stat) * (1 - adaptationPenalty)
opponentAttack = effectiveStatScore(opponent, opponentCategory, opponentStat)   // AI picks best
```

`effectiveStatScore` weights the chosen category stats 3× and the spotlight stat an additional 2× on top, then normalizes to 0–1.

```
playerNetDamage   = playerAttack   * DAMAGE_SCALE - defenseScore(opponent) * DEFENSE_SCALE
opponentNetDamage = opponentAttack * DAMAGE_SCALE - defenseScore(player)   * DEFENSE_SCALE
```
`DAMAGE_SCALE = 15`, `DEFENSE_SCALE = 0.5`. Net damage clamped to minimum 1.

Health reduced by net damage each round.

### Round Scoring (10-point must)
- Higher net damage dealer scores 10; other scores 9
- If damage difference > 8: score is 10–8, `knockdownOccurred = true` in log

### Fight Termination
- **KO**: Either boxer health ≤ 0 mid-round (end-of-round check after round 12 → not KO, just low health)
- **TKO**: Health 1–15 at end of any round AND that boxer took more damage this round
- **Decision**: After round 12, compare cumulative `playerScore` vs `opponentScore`
  - Difference ≥ 4 pts → Decision; < 4 pts → Split Decision
- Finishing move derived from the winning boxer's style (`FINISH_MOVES` map already in `fightSim.ts`)
- Round and time populated from the actual round number and a random time within the round

### AI Opponent Tactical Choice
Each round the opponent picks:
- **Category**: the first category in `STYLE_FOCUS[opponent.style]` that maps to a `StatCategory`
- **Stat**: the highest effective stat in that category
Fully deterministic given the style — no randomness in the AI's tactical choice.

---

## sessionStorage Checkpoint

- **Key**: `fight-session-{fightId}`
- **Written**: after every `simulateRound` call (JSON.stringify of `FightState`)
- **Read**: on `FightPage` mount — if key exists and matches current `fightId`, hydrate state from it
- **Deleted**: on fight completion before navigating away

---

## UI Layout (`FightPage.tsx`)

```
┌─────────────────────────────────────────────────────┐
│  YOUR BOXER          Round 3 / 12      OPPONENT      │
│  Health:  ████████░░  78%    Health:  ██████░░░░ 61% │
│  Stamina: ██████████  95%    Stamina: ███████░░░  70%│
│                                                      │
│  [Body outline - player]    [Body outline - opponent]│
│  Left half: damage zones    Right half: threat zones  │
│  (green → yellow → red)     (style-based highlights) │
│                                                      │
│  ── Choose Your Focus ──────────────────────────── │
│  Category: [Offense] [Defense] [Mental] [Physical]   │
│  Stat:     [Jab] [Cross] [Lead Hook] ...             │
│            (filtered to selected category)           │
│                                                      │
│  ── Last Round ─────────────────────────────────── │
│  narrative string from RoundLogEntry                 │
│                                                      │
│  [Simulate Round]   (disabled until both chosen)     │
└─────────────────────────────────────────────────────┘
```

### Body Outline (SVG)
- Regions: head, chin, body, left-arm, right-arm
- **Player outline** (left): cumulative damage per region drives color (green → yellow → red)
  - 0–25% damage: green; 25–60%: yellow; 60–100%: red
- **Opponent outline** (right): highlight regions based on opponent style's focus stats
  - Swarmer → body + arms highlighted as high threat
  - Out-Boxer → head highlighted
  - Slugger → chin highlighted
  - Counterpuncher → head highlighted (counter-attack zone)
- SVG is a simple text-based body silhouette consistent with the game's text-UI aesthetic

### Stat Picker
- Selecting a category shows only stats in that category as buttons
- Player must select both a category and a stat before "Simulate Round" enables
- If `repeatCount ≥ 2`: warning badge on the currently focused stat ("Opponent adapting: -N%")

### Post-Fight Recap
- After fight resolves: show round-by-round log (round number, narrative, scores) in `FightPage`
- "View Full Results →" button navigates to `/fight-results?fights={fightId}`
- Auto-navigate after 8 seconds if player does not click

---

## Result Integration

### `applyFightResult` extension
Add optional `roundLog?: RoundLogEntry[]` parameter. If present, spread onto the `Fight` record before saving to IndexedDB:
```ts
await putFight({ ...fight, winnerId, method, ..., roundLog });
```

### Flow
1. `simulateRound` resolves fight → `FightState.finished = true`
2. Assemble `FightSimResult` (same shape as auto-sim) + `roundLog`
3. Call `applyFightResult` with extended result
4. Delete `sessionStorage` key
5. Show recap in `FightPage`
6. Navigate to `/fight-results`

---

## Files Affected

| File | Change |
|---|---|
| `src/db/db.ts` | Add `roundLog?` to `Fight`; bump DB version to 15 |
| `src/lib/fightSim.ts` | Add `StatCategory`, `RoundLogEntry`, `FightState`, `simulateRound`, extend `FightSimResult` |
| `src/pages/Fight/FightPage.tsx` | Full rewrite — interactive fight UI, sessionStorage hydration, recap view |
| `src/pages/Fight/FightPage.module.css` | New styles for fight UI (health bars, body outline, stat picker) |
| `src/components/TopNav/fightResultApplier.ts` | Accept + persist `roundLog` on `Fight` record |

---

## Out of Scope

- Injury generation during interactive fights (tracked as existing PRD gap)
- Multi-fight play sessions (only one active interactive fight at a time)
- Replay/review of past round logs in the UI beyond the immediate post-fight recap
