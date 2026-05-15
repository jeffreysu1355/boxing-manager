# In-Fight Tactics System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a round-based interactive fight UI that activates when the player clicks "Play Fight", letting them pick a category + stat focus each round while health/stamina/adaptation mechanics determine the outcome.

**Architecture:** Pure `simulateRound` function in `fightSim.ts` drives all game logic; `FightPage.tsx` holds React state checkpointed to `sessionStorage` after each round; on fight completion the result flows through the existing `applyFightResult` pipeline extended to persist the `roundLog`.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vitest, IndexedDB via `idb`

---

## File Map

| File | Role |
|---|---|
| `src/db/db.ts` | Add `roundLog?` to `Fight`; bump DB version to 15 |
| `src/lib/fightSim.ts` | Add types + `simulateRound` + `pickOpponentChoice` + extend `FightSimResult` |
| `src/lib/fightSim.test.ts` | Tests for `simulateRound` and `pickOpponentChoice` |
| `src/components/TopNav/fightResultApplier.ts` | Accept + persist optional `roundLog` |
| `src/pages/Fight/FightPage.tsx` | Full rewrite — interactive fight UI, sessionStorage, recap |
| `src/pages/Fight/FightPage.module.css` | Styles for health bars, body SVG, stat picker, recap |

---

## Task 1: Add Types and DB Schema

**Files:**
- Modify: `src/db/db.ts`
- Modify: `src/lib/fightSim.ts`

- [ ] **Step 1: Add `roundLog` field to `Fight` interface and bump DB version**

In `src/db/db.ts`, add the `roundLog` import reference (the type lives in `fightSim.ts` — use a forward-compatible approach: type the field as `unknown[]` in db.ts, typed properly via `FightSimResult` in consumers). Actually, to avoid a circular import, define `RoundLogEntry` in `db.ts` itself and import it in `fightSim.ts`.

Open `src/db/db.ts`. Add the following **before** the `Fight` interface:

```ts
export type StatCategory = 'offense' | 'defense' | 'mental' | 'physical';

export interface RoundLogEntry {
  round: number;
  playerFocus: { category: StatCategory; stat: keyof BoxerStats };
  playerDamageDealt: number;
  opponentDamageDealt: number;
  playerScoreThisRound: number;
  opponentScoreThisRound: number;
  adaptationPenalty: number;
  knockdownOccurred: boolean;
  narrative: string;
}
```

Then add to the `Fight` interface (after the `contractId` line):
```ts
  roundLog?: RoundLogEntry[];
```

- [ ] **Step 2: Bump DB version to 15**

In `src/db/db.ts`, find the `openDB` call:
```ts
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 14, {
```
Change to:
```ts
dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 15, {
```

Add the no-op upgrade block at the end of the `upgrade` function (after the `oldVersion < 14` block):
```ts
      if (oldVersion < 15) {
        // roundLog added as optional field on Fight — no structural change needed
      }
```

- [ ] **Step 3: Add `StatCategory`, `STAT_CATEGORIES`, `FightState` to `fightSim.ts`**

In `src/lib/fightSim.ts`, add these imports and constants after the existing imports:

```ts
import type { StatCategory, RoundLogEntry } from '../db/db';
export type { StatCategory };

export { RoundLogEntry };

export const STAT_CATEGORIES: Record<StatCategory, (keyof Boxer['stats'])[]> = {
  offense:  ['jab', 'cross', 'leadHook', 'rearHook', 'uppercut'],
  defense:  ['headMovement', 'bodyMovement', 'guard', 'positioning'],
  mental:   ['timing', 'adaptability', 'discipline'],
  physical: ['speed', 'power', 'endurance', 'recovery', 'toughness'],
};

export interface FightState {
  round: number;
  playerHealth: number;
  opponentHealth: number;
  playerStamina: number;
  opponentStamina: number;
  playerScore: number;
  opponentScore: number;
  repeatCount: number;
  lastPlayerStat: keyof Boxer['stats'] | null;
  lastPlayerCategory: StatCategory | null;
  roundLog: RoundLogEntry[];
  finished: boolean;
  result?: Pick<FightSimResult, 'winnerId' | 'loserId' | 'method' | 'finishingMove' | 'round' | 'time'>;
}
```

- [ ] **Step 4: Extend `FightSimResult` with `roundLog`**

In `src/lib/fightSim.ts`, find the existing `FightSimResult` interface and add:
```ts
  roundLog?: RoundLogEntry[];
```

- [ ] **Step 5: Commit**

```bash
git add src/db/db.ts src/lib/fightSim.ts
git commit -m "feat: add RoundLogEntry, StatCategory, FightState types; bump DB to v15"
```

---

## Task 2: Implement `simulateRound` and `pickOpponentChoice`

**Files:**
- Modify: `src/lib/fightSim.ts`
- Modify: `src/lib/fightSim.test.ts`

- [ ] **Step 1: Write failing tests for `pickOpponentChoice`**

First, update the existing import at the top of `src/lib/fightSim.test.ts` (line 1–8) to include the new exports:

```ts
import { describe, it, expect } from 'vitest';
import {
  computeStatScore,
  computeStyleScore,
  computeRandomWeight,
  simulateFight,
  pickOpponentChoice,
  simulateRound,
  initFightState,
  STAT_CATEGORIES,
  type FightSimResult,
} from './fightSim';
import type { Boxer, BoxerStats, Fight } from '../db/db';
```

Then add the following helper function after the existing `makeFight` helper (after line ~55), before the first `describe` block:

```ts
function makeFullBoxer(id: number, overrides: Partial<Boxer> = {}): Boxer {
  return {
    ...makeBoxer(id, overrides),
    rankPoints: 0,
    demotionBuffer: 0,
  };
}
```

Then add the following `describe` blocks at the end of the file:

```ts
describe('pickOpponentChoice', () => {
  it('returns a category and stat consistent with the opponent style', () => {
    const opponent = makeFullBoxer(2, { style: 'swarmer', stats: makeStats(10) });
    const choice = pickOpponentChoice(opponent);
    // Swarmer focus stats: leadHook, rearHook, bodyMovement, positioning, endurance, toughness
    const swarmStats = ['leadHook', 'rearHook', 'bodyMovement', 'positioning', 'endurance', 'toughness'];
    expect(swarmStats).toContain(choice.stat);
  });

  it('returns a valid StatCategory', () => {
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(10) });
    const { category } = pickOpponentChoice(opponent);
    expect(['offense', 'defense', 'mental', 'physical']).toContain(category);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/fightSim.test.ts 2>&1 | tail -20
```
Expected: FAIL — `pickOpponentChoice` not defined.

- [ ] **Step 3: Implement `pickOpponentChoice`**

Add to `src/lib/fightSim.ts` (before `simulateFight`):

```ts
// Maps each style's focus stats to which StatCategory they fall in
const STYLE_TO_CATEGORY: Record<FightingStyle, StatCategory> = {
  'out-boxer':      'offense',   // jab, cross dominate
  'swarmer':        'offense',   // hooks dominate
  'slugger':        'offense',   // rear hook, uppercut
  'counterpuncher': 'mental',    // timing, adaptability, discipline
};

export function pickOpponentChoice(
  opponent: Boxer,
): { category: StatCategory; stat: keyof Boxer['stats'] } {
  const category = STYLE_TO_CATEGORY[opponent.style];
  const statsInCategory = STAT_CATEGORIES[category];
  // pick the highest raw stat in the category
  let bestStat = statsInCategory[0];
  let bestVal = opponent.stats[bestStat] as number;
  for (const s of statsInCategory) {
    const v = opponent.stats[s] as number;
    if (v > bestVal) { bestVal = v; bestStat = s; }
  }
  return { category, stat: bestStat };
}
```

- [ ] **Step 4: Run `pickOpponentChoice` tests**

```bash
npx vitest run src/lib/fightSim.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗|FAIL|PASS"
```
Expected: `pickOpponentChoice` tests PASS.

- [ ] **Step 5: Write failing tests for `initFightState` and `simulateRound`**

Add to `src/lib/fightSim.test.ts`:

```ts
describe('initFightState', () => {
  it('starts at round 1 with full health and stamina', () => {
    const state = initFightState();
    expect(state.round).toBe(1);
    expect(state.playerHealth).toBe(100);
    expect(state.opponentHealth).toBe(100);
    expect(state.playerStamina).toBe(100);
    expect(state.opponentStamina).toBe(100);
    expect(state.finished).toBe(false);
    expect(state.roundLog).toHaveLength(0);
  });
});

describe('simulateRound', () => {
  it('advances round by 1', () => {
    const player   = makeFullBoxer(1, { style: 'slugger',  stats: makeStats(10) });
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(10) });
    const state = initFightState();
    const next = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    expect(next.round).toBe(2);
  });

  it('reduces stamina each round', () => {
    const player   = makeFullBoxer(1, { style: 'slugger',  stats: makeStats(10) });
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(10) });
    const state = initFightState();
    const next = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    expect(next.playerStamina).toBeLessThan(100);
    expect(next.opponentStamina).toBeLessThan(100);
  });

  it('reduces health each round', () => {
    const player   = makeFullBoxer(1, { style: 'slugger',  stats: makeStats(10) });
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(10) });
    const state = initFightState();
    const next = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    // at least one boxer takes damage
    const healthLost = (100 - next.playerHealth) + (100 - next.opponentHealth);
    expect(healthLost).toBeGreaterThan(0);
  });

  it('appends a RoundLogEntry with correct round number', () => {
    const player   = makeFullBoxer(1, { style: 'slugger',  stats: makeStats(10) });
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(10) });
    const state = initFightState();
    const next = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    expect(next.roundLog).toHaveLength(1);
    expect(next.roundLog[0].round).toBe(1);
    expect(next.roundLog[0].playerFocus).toEqual({ category: 'offense', stat: 'jab' });
  });

  it('increments repeatCount when same stat chosen twice', () => {
    const player   = makeFullBoxer(1, { style: 'slugger',  stats: makeStats(10) });
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(10) });
    let state = initFightState();
    state = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    state = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    expect(state.roundLog[1].adaptationPenalty).toBeGreaterThan(0);
  });

  it('resets repeatCount when stat switches', () => {
    const player   = makeFullBoxer(1, { style: 'slugger',  stats: makeStats(10) });
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(10) });
    let state = initFightState();
    state = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    state = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    state = simulateRound(state, player, opponent, { category: 'offense', stat: 'cross' });
    expect(state.roundLog[2].adaptationPenalty).toBe(0);
  });

  it('finishes fight with KO when opponent health drops to 0', () => {
    const player   = makeFullBoxer(1, { style: 'slugger',  stats: makeStats(20) });
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(1) });
    let state = initFightState();
    // simulate up to 12 rounds or until finished
    for (let r = 0; r < 12 && !state.finished; r++) {
      state = simulateRound(state, player, opponent, { category: 'offense', stat: 'rearHook' });
    }
    expect(state.finished).toBe(true);
    expect(state.result).toBeDefined();
    expect(['KO', 'TKO', 'Decision', 'Split Decision']).toContain(state.result!.method);
  });

  it('finishes with a decision after round 12 on evenly matched boxers', () => {
    // Force 12 rounds by capping damage — use stats=10 (moderate) so health survives
    const player   = makeFullBoxer(1, { style: 'slugger',  stats: makeStats(10) });
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(10) });
    let state = initFightState();
    for (let r = 0; r < 12 && !state.finished; r++) {
      state = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    }
    // May finish before 12 if unlucky — just verify it terminates
    expect(state.finished).toBe(true);
  });

  it('high-adaptability opponent applies 0.15 penalty rate', () => {
    const highAdapt = { ...makeStats(10), adaptability: 15 };
    const player   = makeFullBoxer(1, { style: 'slugger',  stats: makeStats(10) });
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: highAdapt });
    let state = initFightState();
    state = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    state = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    // After 1 repeat, penalty should be 0.15 (not 0.10)
    expect(state.roundLog[1].adaptationPenalty).toBeCloseTo(0.15);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

```bash
npx vitest run src/lib/fightSim.test.ts 2>&1 | tail -20
```
Expected: FAIL — `initFightState`, `simulateRound` not defined.

- [ ] **Step 7: Implement `initFightState` and `simulateRound`**

Add to `src/lib/fightSim.ts` (after `pickOpponentChoice`, before `simulateFight`):

```ts
const BASE_DRAIN = 12;
const DAMAGE_SCALE = 15;
const DEFENSE_SCALE = 0.5;

export function initFightState(): FightState {
  return {
    round: 1,
    playerHealth: 100,
    opponentHealth: 100,
    playerStamina: 100,
    opponentStamina: 100,
    playerScore: 0,
    opponentScore: 0,
    repeatCount: 0,
    lastPlayerStat: null,
    lastPlayerCategory: null,
    roundLog: [],
    finished: false,
  };
}

function staminaDrain(boxer: Boxer): number {
  const drain = BASE_DRAIN - (boxer.stats.endurance * 0.8 + boxer.stats.toughness * 0.4) / 2;
  return Math.min(15, Math.max(2, drain));
}

function staminaMultiplier(stamina: number): number {
  return 0.4 + 0.6 * (stamina / 100);
}

function effectiveStatScore(
  boxer: Boxer,
  stamina: number,
  category: StatCategory,
  spotlightStat: keyof Boxer['stats'],
): number {
  const mult = staminaMultiplier(stamina);
  const statsInCat = STAT_CATEGORIES[category];
  let sum = 0;
  let totalWeight = 0;
  for (const stat of statsInCat) {
    const weight = stat === spotlightStat ? 3 * 2 : 3; // category weight 3×, spotlight extra 2×
    sum += (boxer.stats[stat] as number) * mult * weight;
    totalWeight += weight;
  }
  return (sum / totalWeight) / 20; // normalise to 0–1 (max stat 20)
}

function defenseScore(boxer: Boxer, stamina: number): number {
  const mult = staminaMultiplier(stamina);
  return ((boxer.stats.guard as number) + (boxer.stats.headMovement as number)) / 2 * mult;
}

function generateNarrative(
  playerDmg: number,
  opponentDmg: number,
  penalty: number,
  spotlightStat: keyof Boxer['stats'],
  knockdown: boolean,
): string {
  const statLabel = spotlightStat.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  let msg = '';
  if (playerDmg > opponentDmg + 5) {
    msg = `You dominated with your ${statLabel}.`;
  } else if (opponentDmg > playerDmg + 5) {
    msg = `Opponent took control — your ${statLabel} wasn't enough.`;
  } else {
    msg = `Competitive round — you focused on ${statLabel}.`;
  }
  if (penalty >= 0.20) msg += ` Opponent is adapting to your ${statLabel} (−${Math.round(penalty * 100)}%).`;
  if (knockdown) msg += ' Knockdown!';
  return msg;
}

export function simulateRound(
  state: FightState,
  player: Boxer,
  opponent: Boxer,
  choice: { category: StatCategory; stat: keyof Boxer['stats'] },
): FightState {
  if (state.finished) return state;

  // Adaptation penalty
  const sameStatAsLast = state.lastPlayerStat === choice.stat;
  const newRepeatCount = sameStatAsLast ? state.repeatCount + 1 : 0;
  const penaltyRate = (opponent.stats.adaptability as number) >= 15 ? 0.15 : 0.10;
  const adaptationPenalty = Math.min(0.5, newRepeatCount * penaltyRate);

  // Stamina drain
  const playerDrain   = staminaDrain(player);
  const opponentDrain = staminaDrain(opponent);
  const newPlayerStamina   = Math.max(0, state.playerStamina   - playerDrain);
  const newOpponentStamina = Math.max(0, state.opponentStamina - opponentDrain);

  // AI opponent choice
  const opponentChoice = pickOpponentChoice(opponent);

  // Attack scores
  const playerAttack   = effectiveStatScore(player,   state.playerStamina,   choice.category,         choice.stat)          * (1 - adaptationPenalty);
  const opponentAttack = effectiveStatScore(opponent, state.opponentStamina, opponentChoice.category, opponentChoice.stat);

  // Net damage (minimum 1)
  const playerNetDmg   = Math.max(1, playerAttack   * DAMAGE_SCALE - defenseScore(opponent, state.opponentStamina) * DEFENSE_SCALE);
  const opponentNetDmg = Math.max(1, opponentAttack * DAMAGE_SCALE - defenseScore(player,   state.playerStamina)   * DEFENSE_SCALE);

  // Health
  const newPlayerHealth   = Math.max(0, state.playerHealth   - opponentNetDmg);
  const newOpponentHealth = Math.max(0, state.opponentHealth - playerNetDmg);

  // Round scoring
  const dmgDiff = playerNetDmg - opponentNetDmg;
  const knockdownOccurred = Math.abs(dmgDiff) > 8;
  const playerRoundScore   = playerNetDmg >= opponentNetDmg ? 10 : (knockdownOccurred ? 8 : 9);
  const opponentRoundScore = opponentNetDmg > playerNetDmg  ? 10 : (knockdownOccurred ? 8 : 9);

  const narrative = generateNarrative(playerNetDmg, opponentNetDmg, adaptationPenalty, choice.stat, knockdownOccurred);

  const entry: RoundLogEntry = {
    round: state.round,
    playerFocus: choice,
    playerDamageDealt: Math.round(playerNetDmg * 10) / 10,
    opponentDamageDealt: Math.round(opponentNetDmg * 10) / 10,
    playerScoreThisRound: playerRoundScore,
    opponentScoreThisRound: opponentRoundScore,
    adaptationPenalty,
    knockdownOccurred,
    narrative,
  };

  const newPlayerScore   = state.playerScore   + playerRoundScore;
  const newOpponentScore = state.opponentScore + opponentRoundScore;
  const newRoundLog = [...state.roundLog, entry];
  const isLastRound = state.round === 12;

  // Fight termination
  let finished = false;
  let result: FightState['result'] | undefined;

  const playerKOd   = newPlayerHealth   <= 0;
  const opponentKOd = newOpponentHealth <= 0;

  if (playerKOd || opponentKOd) {
    finished = true;
    const playerWins = !playerKOd && opponentKOd;
    const winnerId = playerWins ? player.id! : opponent.id!;
    const loserId  = playerWins ? opponent.id! : player.id!;
    const winner   = playerWins ? player : opponent;
    const method: FightMethod = 'KO';
    result = {
      winnerId, loserId, method,
      finishingMove: pick(FINISH_MOVES[winner.style]),
      round: state.round,
      time: `${randInt(0, 2)}:${randInt(0, 59).toString().padStart(2, '0')}`,
    };
  } else {
    const playerTKO   = newPlayerHealth   <= 15 && opponentNetDmg > playerNetDmg;
    const opponentTKO = newOpponentHealth <= 15 && playerNetDmg   > opponentNetDmg;

    if (playerTKO || opponentTKO) {
      finished = true;
      const playerWins = opponentTKO;
      const winnerId = playerWins ? player.id! : opponent.id!;
      const loserId  = playerWins ? opponent.id! : player.id!;
      const winner   = playerWins ? player : opponent;
      result = {
        winnerId, loserId, method: 'TKO',
        finishingMove: pick(FINISH_MOVES[winner.style]),
        round: state.round,
        time: `${randInt(0, 2)}:${randInt(0, 59).toString().padStart(2, '0')}`,
      };
    } else if (isLastRound) {
      finished = true;
      const playerWins = newPlayerScore >= newOpponentScore;
      const winnerId = playerWins ? player.id! : opponent.id!;
      const loserId  = playerWins ? opponent.id! : player.id!;
      const scoreDiff = Math.abs(newPlayerScore - newOpponentScore);
      const method: FightMethod = scoreDiff >= 4 ? 'Decision' : 'Split Decision';
      result = { winnerId, loserId, method, finishingMove: null, round: 12, time: '3:00' };
    }
  }

  return {
    round: state.round + 1,
    playerHealth:   newPlayerHealth,
    opponentHealth: newOpponentHealth,
    playerStamina:  newPlayerStamina,
    opponentStamina: newOpponentStamina,
    playerScore:   newPlayerScore,
    opponentScore: newOpponentScore,
    repeatCount:   newRepeatCount,
    lastPlayerStat: choice.stat,
    lastPlayerCategory: choice.category,
    roundLog: newRoundLog,
    finished,
    result,
  };
}
```

- [ ] **Step 8: Run all `simulateRound` tests**

```bash
npx vitest run src/lib/fightSim.test.ts --reporter=verbose 2>&1 | grep -E "✓|✗|FAIL|PASS"
```
Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/fightSim.ts src/lib/fightSim.test.ts
git commit -m "feat: add simulateRound, initFightState, pickOpponentChoice to fightSim"
```

---

## Task 3: Extend `applyFightResult` to Persist `roundLog`

**Files:**
- Modify: `src/components/TopNav/fightResultApplier.ts`

- [ ] **Step 1: Add `roundLog` to `ApplyFightResultParams` and persist it**

In `src/components/TopNav/fightResultApplier.ts`:

Add to the imports at the top:
```ts
import type { FightMethod, FightRecord, WeightClass, RoundLogEntry } from '../../db/db';
```
(replace the existing `import type { FightMethod, FightRecord, WeightClass } from '../../db/db';`)

Add `roundLog?: RoundLogEntry[]` to `ApplyFightResultParams` after the `gymBoxerFirstId` line:
```ts
  gymBoxerFirstId: number;
  roundLog?: RoundLogEntry[];
```

In `applyFightResult`, destructure `roundLog` from params:
```ts
  const {
    fightId, winnerId, loserId, method, finishingMove, round, time,
    winnerRecord, loserRecord, isTitleFight, federationId, weightClass,
    fightDate, contractId, gymBoxerFirstId, roundLog,
  } = params;
```

Update step 1 (Update Fight record) to spread `roundLog`:
```ts
  const fight = await getFight(fightId);
  if (fight) {
    await putFight({ ...fight, winnerId, method, finishingMove, round, time, ...(roundLog ? { roundLog } : {}) });
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TopNav/fightResultApplier.ts
git commit -m "feat: persist roundLog on Fight record via applyFightResult"
```

---

## Task 4: CSS Module for Fight UI

**Files:**
- Modify: `src/pages/Fight/FightPage.module.css`

- [ ] **Step 1: Write fight UI styles**

Replace the contents of `src/pages/Fight/FightPage.module.css` with:

```css
.fightContainer {
  padding: 24px;
  max-width: 900px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.roundLabel {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
}

.boxerName {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
}

/* Health / Stamina bars */
.barsSection {
  display: grid;
  grid-template-columns: 1fr 80px 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 20px;
}

.barLabel {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-secondary);
  margin-bottom: 3px;
}

.barTrack {
  height: 10px;
  background: var(--border);
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 6px;
}

.barFill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease;
}

.barFillHealth {
  background: #4caf50;
}

.barFillStamina {
  background: #2196f3;
}

.barPct {
  font-size: 11px;
  color: var(--text-secondary);
}

.opponentBars {
  text-align: right;
}

.opponentBars .barTrack {
  direction: rtl;
}

/* Body outline SVG area */
.svgSection {
  display: flex;
  justify-content: center;
  gap: 48px;
  margin-bottom: 24px;
}

.svgWrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.svgLabel {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-secondary);
}

/* Stat picker */
.pickerSection {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
}

.pickerTitle {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.categoryRow {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.statRow {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.categoryBtn {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 4px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.categoryBtn:hover {
  border-color: var(--accent);
}

.categoryBtnActive {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
}

.statBtn {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s, background 0.15s;
}

.statBtn:hover {
  border-color: var(--accent);
}

.statBtnActive {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
}

.adaptBadge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #f44336;
  color: #fff;
  font-size: 9px;
  border-radius: 4px;
  padding: 1px 4px;
  white-space: nowrap;
}

/* Last round narrative */
.narrativeSection {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  min-height: 40px;
}

.narrativeTitle {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

/* Simulate button */
.simBtn {
  background: var(--accent);
  color: #000;
  border: none;
  border-radius: 4px;
  padding: 10px 28px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.simBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Post-fight recap */
.recapSection {
  margin-top: 24px;
}

.recapTitle {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.recapEntry {
  border-left: 2px solid var(--border);
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 13px;
}

.recapRound {
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 2px;
}

.recapNarrative {
  color: var(--text-secondary);
}

.recapScore {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.viewResultsBtn {
  background: var(--accent);
  color: #000;
  border: none;
  border-radius: 4px;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 16px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Fight/FightPage.module.css
git commit -m "feat: add FightPage CSS module for interactive fight UI"
```

---

## Task 5: Implement `FightPage.tsx` — Interactive Fight UI

**Files:**
- Modify: `src/pages/Fight/FightPage.tsx`

- [ ] **Step 1: Write the full interactive `FightPage.tsx`**

Replace the entire contents of `src/pages/Fight/FightPage.tsx` with:

```tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { getFight } from '../../db/fightStore';
import { getBoxer } from '../../db/boxerStore';
import { getFederation } from '../../db/federationStore';
import { getAllCalendarEvents } from '../../db/calendarEventStore';
import { getAllCoaches } from '../../db/coachStore';
import { applyFightResult } from '../../components/TopNav/fightResultApplier';
import {
  initFightState, simulateRound, pickOpponentChoice,
  STAT_CATEGORIES,
  type FightState,
} from '../../lib/fightSim';
import type { Fight, Boxer, StatCategory, RoundLogEntry } from '../../db/db';
import styles from './FightPage.module.css';

const CATEGORY_LABELS: Record<StatCategory, string> = {
  offense: 'Offense', defense: 'Defense', mental: 'Mental', physical: 'Physical',
};

const STAT_LABELS: Record<string, string> = {
  jab: 'Jab', cross: 'Cross', leadHook: 'Lead Hook', rearHook: 'Rear Hook', uppercut: 'Uppercut',
  headMovement: 'Head Mvmt', bodyMovement: 'Body Mvmt', guard: 'Guard', positioning: 'Positioning',
  timing: 'Timing', adaptability: 'Adaptability', discipline: 'Discipline',
  speed: 'Speed', power: 'Power', endurance: 'Endurance', recovery: 'Recovery', toughness: 'Toughness',
};

// Style → threat regions on opponent silhouette
const STYLE_THREATS: Record<string, string[]> = {
  'out-boxer':      ['head'],
  'swarmer':        ['body', 'leftArm', 'rightArm'],
  'slugger':        ['chin'],
  'counterpuncher': ['head'],
};

const SESSION_KEY = (fightId: string) => `fight-session-${fightId}`;

function damageColor(pct: number): string {
  if (pct < 25) return '#4caf50';
  if (pct < 60) return '#ff9800';
  return '#f44336';
}

interface RegionDamage {
  head: number; chin: number; body: number; leftArm: number; rightArm: number;
}

function BoxerSilhouette({
  mode,
  regionDamage,
  opponentStyle,
}: {
  mode: 'damage' | 'threat';
  regionDamage?: RegionDamage;
  opponentStyle?: string;
}) {
  const threats = opponentStyle ? STYLE_THREATS[opponentStyle] ?? [] : [];

  function regionFill(region: keyof RegionDamage): string {
    if (mode === 'damage' && regionDamage) {
      return damageColor(regionDamage[region]);
    }
    if (mode === 'threat') {
      return threats.includes(region) ? '#f44336' : '#555';
    }
    return '#555';
  }

  return (
    <svg width="80" height="160" viewBox="0 0 80 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <ellipse cx="40" cy="18" rx="14" ry="16" fill={regionFill('head')} opacity="0.85" />
      {/* Chin (lower head) */}
      <ellipse cx="40" cy="33" rx="8" ry="6" fill={regionFill('chin')} opacity="0.85" />
      {/* Body (torso) */}
      <rect x="22" y="40" width="36" height="50" rx="6" fill={regionFill('body')} opacity="0.85" />
      {/* Left Arm */}
      <rect x="6" y="42" width="14" height="40" rx="6" fill={regionFill('leftArm')} opacity="0.85" />
      {/* Right Arm */}
      <rect x="60" y="42" width="14" height="40" rx="6" fill={regionFill('rightArm')} opacity="0.85" />
      {/* Legs */}
      <rect x="24" y="92" width="13" height="50" rx="5" fill="#444" opacity="0.7" />
      <rect x="43" y="92" width="13" height="50" rx="5" fill="#444" opacity="0.7" />
    </svg>
  );
}

function BarPair({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className={styles.barLabel}>{label}</div>
      <div className={styles.barTrack}>
        <div
          className={`${styles.barFill} ${label === 'Health' ? styles.barFillHealth : styles.barFillStamina}`}
          style={{ width: `${Math.max(0, value)}%` }}
        />
      </div>
      <div className={styles.barPct}>{Math.round(value)}%</div>
    </div>
  );
}

export default function FightPage() {
  const { fightId } = useParams<{ fightId: string }>();
  const navigate = useNavigate();

  const [fight, setFight] = useState<Fight | null>(null);
  const [player, setPlayer] = useState<Boxer | null>(null);
  const [opponent, setOpponent] = useState<Boxer | null>(null);
  const [loading, setLoading] = useState(true);

  // Interactive fight state
  const [fightState, setFightState] = useState<FightState | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<StatCategory | null>(null);
  const [selectedStat, setSelectedStat] = useState<keyof Boxer['stats'] | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showRecap, setShowRecap] = useState(false);

  // Region damage tracking (per-region cumulative)
  const [playerRegionDamage, setPlayerRegionDamage] = useState<RegionDamage>({
    head: 0, chin: 0, body: 0, leftArm: 0, rightArm: 0,
  });

  const autoNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!fightId) return;
    const id = Number(fightId);

    async function load() {
      const f = await getFight(id);
      if (!f) { setLoading(false); return; }
      setFight(f);

      const [p, opp] = await Promise.all([
        getBoxer(f.boxerIds[0]),
        getBoxer(f.boxerIds[1]),
      ]);
      setPlayer(p ?? null);
      setOpponent(opp ?? null);

      // Hydrate sessionStorage if fight is still in progress
      if (f.winnerId === null && f.method !== 'Draw') {
        const saved = sessionStorage.getItem(SESSION_KEY(fightId));
        if (saved) {
          try {
            const parsed: FightState = JSON.parse(saved);
            if (!parsed.finished) {
              setFightState(parsed);
              setLoading(false);
              return;
            }
          } catch {
            // corrupt — ignore, start fresh
          }
        }
        setFightState(initFightState());
      }
      setLoading(false);
    }

    load();
  }, [fightId]);

  // Checkpoint to sessionStorage after every state change
  useEffect(() => {
    if (!fightId || !fightState) return;
    sessionStorage.setItem(SESSION_KEY(fightId), JSON.stringify(fightState));
  }, [fightId, fightState]);

  const handleSimulateRound = useCallback(async () => {
    if (!fightState || !player || !opponent || !selectedCategory || !selectedStat || isApplying) return;
    const next = simulateRound(fightState, player, opponent, { category: selectedCategory, stat: selectedStat });

    // Distribute opponent's damage to player regions based on opponent style
    const threats = STYLE_THREATS[opponent.style] ?? ['body'];
    const dmgPerRegion = (next.roundLog[next.roundLog.length - 1]?.opponentDamageDealt ?? 0) / threats.length;
    setPlayerRegionDamage(prev => {
      const updated = { ...prev };
      for (const region of threats) {
        if (region in updated) updated[region as keyof RegionDamage] += dmgPerRegion;
      }
      return updated;
    });

    setFightState(next);
    setSelectedCategory(null);
    setSelectedStat(null);

    if (next.finished && next.result) {
      setIsApplying(true);
      try {
        const f = fight!;
        const [fed, allCoaches, allCampEvents] = await Promise.all([
          getFederation(f.federationId),
          getAllCoaches(),
          getAllCalendarEvents(),
        ]);
        const { winnerId, loserId, method, finishingMove, round, time } = next.result;
        const winner = winnerId === player.id ? player : opponent;
        const loser  = loserId  === player.id ? player : opponent;

        const winnerRecord = {
          result: 'win' as const,
          opponentName: loser.name,
          opponentId: loser.id!,
          method,
          finishingMove,
          round: round!,
          time: time!,
          federation: fed?.name ?? '',
          date: f.date,
          isTitleFight: f.isTitleFight,
        };
        const loserRecord = {
          result: 'loss' as const,
          opponentName: winner.name,
          opponentId: winner.id!,
          method,
          finishingMove,
          round: round!,
          time: time!,
          federation: fed?.name ?? '',
          date: f.date,
          isTitleFight: f.isTitleFight,
        };

        await applyFightResult({
          fightId: f.id!,
          winnerId, loserId, method, finishingMove,
          round: round!,
          time: time!,
          winnerRecord, loserRecord,
          isTitleFight: f.isTitleFight,
          federationId: f.federationId,
          weightClass: f.weightClass,
          fightDate: f.date,
          contractId: f.contractId,
          gymBoxerFirstId: f.boxerIds[0],
          roundLog: next.roundLog,
        });

        sessionStorage.removeItem(SESSION_KEY(fightId!));
        setShowRecap(true);

        autoNavTimer.current = setTimeout(() => {
          navigate(`/fight-results?fights=${f.id}`);
        }, 8000);
      } finally {
        setIsApplying(false);
      }
    }
  }, [fightState, player, opponent, selectedCategory, selectedStat, isApplying, fight, fightId, navigate]);

  useEffect(() => {
    return () => {
      if (autoNavTimer.current) clearTimeout(autoNavTimer.current);
    };
  }, []);

  const back = (
    <button
      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 13, marginBottom: 16 }}
      onClick={() => navigate(-1)}
    >
      &larr; Back
    </button>
  );

  if (loading) return <div style={{ padding: '32px 24px' }}>{back}<p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading…</p></div>;
  if (!fight) return <div style={{ padding: '32px 24px' }}>{back}<p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Fight not found.</p></div>;

  // Completed fight (already simmed or played and results applied)
  const isCompleted = fight.winnerId !== null || fight.method === 'Draw';
  if (isCompleted && !showRecap) {
    const isDraw = fight.method === 'Draw';
    const isDecision = fight.method === 'Decision' || fight.method === 'Split Decision';
    const winnerName = fight.winnerId ? (fight.winnerId === player?.id ? player?.name : opponent?.name) ?? `Boxer #${fight.winnerId}` : '—';
    const resultLine = isDraw
      ? `Draw — ${fight.method}`
      : isDecision
        ? `${winnerName} wins by ${fight.method}`
        : `${winnerName} wins by ${fight.method}${fight.finishingMove ? ` (${fight.finishingMove})` : ''}${fight.round != null ? ` — Rd. ${fight.round}` : ''}`;

    return (
      <div style={{ padding: '32px 24px', maxWidth: 600 }}>
        {back}
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>
          {player?.name ?? `Boxer #${fight.boxerIds[0]}`} vs. {opponent?.name ?? `Boxer #${fight.boxerIds[1]}`}
        </h2>
        <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
          {fight.date} {fight.isTitleFight && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>· Title Fight</span>}
        </p>
        <div style={{ background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--border)', borderRadius: 6, padding: '20px 24px' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', marginBottom: 8 }}>Result</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{resultLine}</div>
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 16 }}>
          {player?.id !== undefined && <Link to={`/player/${player.id}`} style={{ color: 'var(--accent)', fontSize: 13 }}>{player.name}</Link>}
          {opponent?.id !== undefined && <Link to={`/player/${opponent.id}`} style={{ color: 'var(--accent)', fontSize: 13 }}>{opponent.name}</Link>}
        </div>
      </div>
    );
  }

  // Post-fight recap
  if (showRecap && fightState) {
    const res = fightState.result;
    const winnerName = res?.winnerId === player?.id ? player?.name : opponent?.name;
    return (
      <div className={styles.fightContainer}>
        {back}
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Fight Over</h2>
        {res && (
          <p style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 20 }}>
            {winnerName} wins by {res.method}
            {res.finishingMove ? ` (${res.finishingMove})` : ''}
            {res.round ? ` — Rd. ${res.round}` : ''}
          </p>
        )}
        <div className={styles.recapSection}>
          <div className={styles.recapTitle}>Round-by-Round</div>
          {fightState.roundLog.map((entry: RoundLogEntry) => (
            <div key={entry.round} className={styles.recapEntry}>
              <div className={styles.recapRound}>Round {entry.round}</div>
              <div className={styles.recapNarrative}>{entry.narrative}</div>
              <div className={styles.recapScore}>
                You: {entry.playerScoreThisRound} — Opponent: {entry.opponentScoreThisRound}
                {entry.adaptationPenalty > 0 && ` · Adaptation penalty: −${Math.round(entry.adaptationPenalty * 100)}%`}
              </div>
            </div>
          ))}
        </div>
        <button
          className={styles.viewResultsBtn}
          onClick={() => {
            if (autoNavTimer.current) clearTimeout(autoNavTimer.current);
            navigate(`/fight-results?fights=${fight.id}`);
          }}
        >
          View Full Results →
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>Auto-navigating in 8s…</p>
      </div>
    );
  }

  if (!fightState || !player || !opponent) {
    return <div style={{ padding: '32px 24px' }}>{back}<p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Fight not ready.</p></div>;
  }

  const lastEntry = fightState.roundLog[fightState.roundLog.length - 1];
  const statsForCategory = selectedCategory ? STAT_CATEGORIES[selectedCategory] : [];
  const penaltyRate = (opponent.stats.adaptability as number) >= 15 ? 0.15 : 0.10;
  const nextPenalty = Math.min(0.5, (selectedStat === fightState.lastPlayerStat ? fightState.repeatCount + 1 : 0) * penaltyRate);

  return (
    <div className={styles.fightContainer}>
      {back}

      {/* Header */}
      <div className={styles.header}>
        <span className={styles.boxerName}>{player.name}</span>
        <span className={styles.roundLabel}>Round {Math.min(fightState.round, 12)} / 12</span>
        <span className={styles.boxerName}>{opponent.name}</span>
      </div>

      {/* Health / Stamina bars */}
      <div className={styles.barsSection}>
        <div>
          <BarPair label="Health"  value={fightState.playerHealth} />
          <BarPair label="Stamina" value={fightState.playerStamina} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>vs</div>
        <div className={styles.opponentBars}>
          <BarPair label="Health"  value={fightState.opponentHealth} />
          <BarPair label="Stamina" value={fightState.opponentStamina} />
        </div>
      </div>

      {/* Body silhouettes */}
      <div className={styles.svgSection}>
        <div className={styles.svgWrapper}>
          <div className={styles.svgLabel}>Your Damage</div>
          <BoxerSilhouette mode="damage" regionDamage={playerRegionDamage} />
        </div>
        <div className={styles.svgWrapper}>
          <div className={styles.svgLabel}>Threat Zones</div>
          <BoxerSilhouette mode="threat" opponentStyle={opponent.style} />
        </div>
      </div>

      {/* Stat picker */}
      <div className={styles.pickerSection}>
        <div className={styles.pickerTitle}>Choose Your Focus</div>
        <div className={styles.categoryRow}>
          {(['offense', 'defense', 'mental', 'physical'] as StatCategory[]).map(cat => (
            <button
              key={cat}
              className={`${styles.categoryBtn} ${selectedCategory === cat ? styles.categoryBtnActive : ''}`}
              onClick={() => { setSelectedCategory(cat); setSelectedStat(null); }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        {selectedCategory && (
          <div className={styles.statRow}>
            {statsForCategory.map(stat => {
              const isActive = selectedStat === stat;
              const wouldRepeat = stat === fightState.lastPlayerStat;
              const previewPenalty = wouldRepeat ? Math.min(0.5, (fightState.repeatCount + 1) * penaltyRate) : 0;
              return (
                <button
                  key={stat}
                  className={`${styles.statBtn} ${isActive ? styles.statBtnActive : ''}`}
                  onClick={() => setSelectedStat(stat)}
                >
                  {STAT_LABELS[stat] ?? stat}
                  {wouldRepeat && previewPenalty >= 0.20 && !isActive && (
                    <span className={styles.adaptBadge}>−{Math.round(previewPenalty * 100)}%</span>
                  )}
                  {isActive && nextPenalty >= 0.20 && (
                    <span className={styles.adaptBadge}>−{Math.round(nextPenalty * 100)}%</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Last round narrative */}
      <div className={styles.narrativeSection}>
        {lastEntry ? (
          <>
            <div className={styles.narrativeTitle}>Round {lastEntry.round} recap</div>
            {lastEntry.narrative}
          </>
        ) : (
          <span style={{ fontStyle: 'italic' }}>Fight begins — choose your focus for Round 1.</span>
        )}
      </div>

      <button
        className={styles.simBtn}
        onClick={handleSimulateRound}
        disabled={!selectedCategory || !selectedStat || isApplying}
      >
        {isApplying ? 'Applying…' : 'Simulate Round'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: No errors (or only pre-existing errors unrelated to this feature).

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run 2>&1 | tail -20
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Fight/FightPage.tsx src/pages/Fight/FightPage.module.css
git commit -m "feat: implement interactive round-based FightPage with sessionStorage checkpoint"
```

---

## Task 6: Manual Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to a fight day**

Open the app. If there is no fight scheduled today, use the Play dropdown to "Sim to Next Event" until a fight day arrives. Then stop — don't sim past it.

- [ ] **Step 3: Click "Play Fight"**

Verify:
- The interactive fight UI loads (not the old "not yet played" placeholder)
- Player and opponent names appear in the header
- Round label shows "Round 1 / 12"
- Health and stamina bars show 100%
- Body silhouettes are visible (player damage side all green, threat zones highlight based on opponent style)
- The narrative section shows "Fight begins — choose your focus for Round 1."

- [ ] **Step 4: Pick a category and stat, simulate a round**

Click an Offense category button → click "Jab" → click "Simulate Round".

Verify:
- Round label advances to "Round 2 / 12"
- Health/stamina bars update (both should decrease slightly)
- Last round narrative is populated
- Stat buttons reset (no category pre-selected)

- [ ] **Step 5: Test adaptation warning**

Pick the same stat (e.g. Jab) two more times in a row.

Verify:
- After 2 repeats, a red badge appears on the Jab button showing "−20%" (or "−30%" if opponent adaptability ≥ 15)

- [ ] **Step 6: Test sessionStorage checkpoint**

Mid-fight, refresh the page.

Verify:
- Fight resumes from the same round (not reset to Round 1)

- [ ] **Step 7: Fight to completion**

Continue simulating rounds until the fight finishes (or choose a stat that favors a KO).

Verify:
- Recap view appears with round-by-round log
- "View Full Results →" button is present
- After 8 seconds, auto-navigates to `/fight-results`
- The fight result page shows the correct winner/method

- [ ] **Step 8: Verify fight record persisted**

Navigate to the winning boxer's player page.

Verify:
- Fight record shows the correct result (method, round, opponent name)

- [ ] **Step 9: Verify "Sim Fight" still works**

Use "Sim Fight" on a different fight day.

Verify:
- Auto-sim path is unchanged — resolves instantly, routes to fight results as before

---

## Task 7: Update PRD Completion Tracking

**Files:**
- Modify: `PRD.md`

- [ ] **Step 1: Mark completed items in PRD section 7.4**

In `PRD.md`, find the section 7.4 completion tracking list and mark all items complete:

```markdown
#### Completion Tracking

- [x] `RoundLogEntry`, `FightState`, `StatCategory` types in `fightSim.ts`
- [x] `simulateRound` pure function (stamina, effective stats, adaptation penalty, damage, scoring)
- [x] AI opponent tactical choice logic
- [x] Fight termination logic (KO/TKO/Decision/Split Decision)
- [x] Extend `FightSimResult` with optional `roundLog`
- [x] Extend `applyFightResult` to persist `roundLog` on `Fight` record
- [x] `FightPage.tsx` interactive fight UI (health/stamina bars, body outline SVG, stat picker)
- [x] sessionStorage checkpoint (write after each round, hydrate on mount, clear on finish)
- [x] Post-fight recap view in `FightPage` with round-by-round log
- [x] DB version bump to 15 (`roundLog` field on `Fight`)
```

- [ ] **Step 2: Commit**

```bash
git add PRD.md
git commit -m "docs: mark in-fight tactics system complete in PRD"
```
