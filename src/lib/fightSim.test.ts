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

function makeStats(val: number): BoxerStats {
  return {
    jab: val, cross: val, leadHook: val, rearHook: val, uppercut: val,
    headMovement: val, bodyMovement: val, guard: val, positioning: val,
    timing: val, adaptability: val, discipline: val,
    speed: val, power: val, endurance: val, recovery: val, toughness: val,
  };
}

function makeBoxer(id: number, overrides: Partial<Boxer> = {}): Boxer {
  return {
    id,
    name: `Boxer ${id}`,
    age: 25,
    weightClass: 'welterweight',
    style: 'slugger',
    reputation: 'Unknown',
    gymId: 1,
    federationId: 1,
    stats: makeStats(10),
    naturalTalents: [],
    injuries: [],
    titles: [],
    record: [],
    ...overrides,
  };
}

function makeFullBoxer(id: number, overrides: Partial<Boxer> = {}): Boxer {
  return {
    ...makeBoxer(id, overrides),
    rankPoints: 0,
    demotionBuffer: 0,
  };
}

function makeFight(overrides: Partial<Fight> = {}): Fight {
  return {
    id: 1,
    date: '2026-03-14',
    federationId: 1,
    weightClass: 'welterweight',
    boxerIds: [1, 2],
    winnerId: null,
    method: 'Decision',
    finishingMove: null,
    round: null,
    time: null,
    isTitleFight: false,
    contractId: 1,
    ...overrides,
  };
}

describe('computeStatScore', () => {
  it('returns 0.5 for all stats at 10 (max 20)', () => {
    const boxer = makeBoxer(1, { style: 'slugger', stats: makeStats(10) });
    expect(computeStatScore(boxer)).toBeCloseTo(0.5);
  });

  it('returns 1.0 for all stats at 20', () => {
    const boxer = makeBoxer(1, { style: 'slugger', stats: makeStats(20) });
    expect(computeStatScore(boxer)).toBeCloseTo(1.0);
  });

  it('returns 0 for all stats at 0', () => {
    const boxer = makeBoxer(1, { style: 'slugger', stats: makeStats(0) });
    expect(computeStatScore(boxer)).toBeCloseTo(0);
  });

  it('focus stats weigh more than non-focus stats', () => {
    // slugger focus: rearHook, uppercut, power, endurance, recovery, toughness
    const highFocus = makeBoxer(1, {
      style: 'slugger',
      stats: { ...makeStats(5), rearHook: 20, uppercut: 20, power: 20, endurance: 20, recovery: 20, toughness: 20 },
    });
    const highNonFocus = makeBoxer(2, {
      style: 'slugger',
      stats: { ...makeStats(20), rearHook: 5, uppercut: 5, power: 5, endurance: 5, recovery: 5, toughness: 5 },
    });
    expect(computeStatScore(highFocus)).toBeGreaterThan(computeStatScore(highNonFocus));
  });
});

describe('computeStyleScore', () => {
  it('returns 1.0 when A counters B', () => {
    // Swarmer counters Out-Boxer
    expect(computeStyleScore('swarmer', 'out-boxer')).toBe(1.0);
  });

  it('returns 0.0 when B counters A', () => {
    // Out-Boxer is countered by Swarmer
    expect(computeStyleScore('out-boxer', 'swarmer')).toBe(0.0);
  });

  it('returns 0.5 for neutral matchup', () => {
    expect(computeStyleScore('slugger', 'out-boxer')).toBe(0.5);
  });
});

describe('computeRandomWeight', () => {
  it('returns 0.10 at tier gap 0', () => {
    expect(computeRandomWeight(0)).toBeCloseTo(0.10);
  });

  it('returns 0.01 at tier gap 9', () => {
    expect(computeRandomWeight(9)).toBeCloseTo(0.01);
  });

  it('returns 0.01 minimum even beyond gap 9', () => {
    expect(computeRandomWeight(20)).toBeCloseTo(0.01);
  });

  it('decreases linearly between gap 0 and 9', () => {
    expect(computeRandomWeight(5)).toBeCloseTo(0.05);
  });
});

describe('simulateFight', () => {
  it('returns a result with winner and loser ids that match the two boxers', () => {
    const a = makeBoxer(1);
    const b = makeBoxer(2);
    const result = simulateFight(a, b, makeFight(), 'North America Boxing Federation');
    expect([result.winnerId, result.loserId].sort()).toEqual([1, 2]);
    expect(result.winnerId).not.toBe(result.loserId);
  });

  it('winnerRecord has result win and loserRecord has result loss', () => {
    const a = makeBoxer(1);
    const b = makeBoxer(2);
    const result = simulateFight(a, b, makeFight(), 'North America Boxing Federation');
    expect(result.winnerRecord.result).toBe('win');
    expect(result.loserRecord.result).toBe('loss');
  });

  it('winnerRecord opponentId equals loserId and vice versa', () => {
    const a = makeBoxer(1);
    const b = makeBoxer(2);
    const result = simulateFight(a, b, makeFight(), 'North America Boxing Federation');
    expect(result.winnerRecord.opponentId).toBe(result.loserId);
    expect(result.loserRecord.opponentId).toBe(result.winnerId);
  });

  it('decision has round 12, time 3:00, no finishingMove', () => {
    let found: FightSimResult | null = null;
    for (let i = 0; i < 200; i++) {
      const r = simulateFight(makeBoxer(1), makeBoxer(2), makeFight(), 'NABF');
      if (r.method === 'Decision' || r.method === 'Split Decision') { found = r; break; }
    }
    expect(found).not.toBeNull();
    expect(found!.round).toBe(12);
    expect(found!.time).toBe('3:00');
    expect(found!.finishingMove).toBeNull();
  });

  it('KO has round between 1 and 6 and a finishingMove', () => {
    let found: FightSimResult | null = null;
    for (let i = 0; i < 500; i++) {
      const a = makeBoxer(1, { stats: makeStats(20) });
      const b = makeBoxer(2, { stats: makeStats(1) });
      const r = simulateFight(a, b, makeFight(), 'NABF');
      if (r.method === 'KO') { found = r; break; }
    }
    expect(found).not.toBeNull();
    expect(found!.round).toBeGreaterThanOrEqual(1);
    expect(found!.round).toBeLessThanOrEqual(6);
    expect(found!.finishingMove).not.toBeNull();
  });

  it('heavily favored boxer wins far more often than not', () => {
    const a = makeBoxer(1, { stats: makeStats(20), reputation: 'All-Time Great' });
    const b = makeBoxer(2, { stats: makeStats(1), reputation: 'Unknown' });
    let aWins = 0;
    for (let i = 0; i < 100; i++) {
      const r = simulateFight(a, b, makeFight(), 'NABF');
      if (r.winnerId === 1) aWins++;
    }
    expect(aWins).toBeGreaterThan(90);
  });

  it('stores federation name and fight date on fight records', () => {
    const a = makeBoxer(1);
    const b = makeBoxer(2);
    const fight = makeFight({ date: '2026-06-15' });
    const result = simulateFight(a, b, fight, 'European Boxing Federation');
    expect(result.winnerRecord.federation).toBe('European Boxing Federation');
    expect(result.winnerRecord.date).toBe('2026-06-15');
    expect(result.loserRecord.federation).toBe('European Boxing Federation');
    expect(result.loserRecord.date).toBe('2026-06-15');
  });
});

describe('pickOpponentChoice', () => {
  it('returns a category and stat consistent with the opponent style', () => {
    const opponent = makeFullBoxer(2, { style: 'swarmer', stats: makeStats(10) });
    const choice = pickOpponentChoice(opponent);
    // Swarmer maps to offense category: leadHook, rearHook, bodyMovement, positioning, endurance, toughness
    // But STYLE_TO_CATEGORY maps swarmer -> 'offense', so stat will be from offense stats
    const offenseStats = STAT_CATEGORIES['offense'];
    expect(offenseStats).toContain(choice.stat);
  });

  it('returns a valid StatCategory', () => {
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(10) });
    const { category } = pickOpponentChoice(opponent);
    expect(['offense', 'defense', 'mental', 'physical']).toContain(category);
  });
});

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

  it('finishes fight when health drops to 0 or after round 12', () => {
    const player   = makeFullBoxer(1, { style: 'slugger',  stats: makeStats(20) });
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(1) });
    let state = initFightState();
    for (let r = 0; r < 12 && !state.finished; r++) {
      state = simulateRound(state, player, opponent, { category: 'offense', stat: 'rearHook' });
    }
    expect(state.finished).toBe(true);
    expect(state.result).toBeDefined();
    expect(['KO', 'TKO', 'Decision', 'Split Decision']).toContain(state.result!.method);
  });

  it('finishes after round 12 on evenly matched boxers', () => {
    const player   = makeFullBoxer(1, { style: 'slugger',  stats: makeStats(10) });
    const opponent = makeFullBoxer(2, { style: 'out-boxer', stats: makeStats(10) });
    let state = initFightState();
    for (let r = 0; r < 12 && !state.finished; r++) {
      state = simulateRound(state, player, opponent, { category: 'offense', stat: 'jab' });
    }
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
