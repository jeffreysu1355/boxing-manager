import { describe, it, expect } from 'vitest';
import {
  applyTraining,
  STYLE_STATS,
  EXP_PER_DAY,
  computeTrainingCampBoost,
  computeNpcBoost,
  NPC_BOOST_BY_REPUTATION,
  dateDiffDaysTraining,
  applyFightExp,
  FIGHT_EXP_BY_REPUTATION,
  rollTalentGain,
  talentGainProbability,
} from './training';
import type { Boxer, Coach } from '../db/db';

function makeBoxer(overrides: Partial<Boxer> = {}): Boxer {
  return {
    name: 'Test Boxer',
    age: 22,
    weightClass: 'lightweight',
    style: 'out-boxer',
    reputation: 'Unknown',
    gymId: 1,
    federationId: null,
    stats: {
      jab: 10, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
      headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
      timing: 10, adaptability: 10, discipline: 10,
      speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
    },
    naturalTalents: [],
    injuries: [],
    titles: [],
    record: [],
    trainingExp: {},
    ...overrides,
  };
}

function makeCoach(overrides: Partial<Coach> = {}): Coach {
  return {
    name: 'Test Coach',
    skillLevel: 'local',
    style: 'out-boxer',
    assignedBoxerId: null,
    gymId: 1,
    monthlySalary: 500,
    ...overrides,
  };
}

describe('STYLE_STATS', () => {
  it('out-boxer trains jab, cross, headMovement, guard, positioning, speed', () => {
    expect(STYLE_STATS['out-boxer']).toEqual(
      expect.arrayContaining(['jab', 'cross', 'headMovement', 'guard', 'positioning', 'speed'])
    );
    expect(STYLE_STATS['out-boxer']).toHaveLength(6);
  });

  it('swarmer trains leadHook, rearHook, bodyMovement, positioning, endurance, toughness', () => {
    expect(STYLE_STATS['swarmer']).toEqual(
      expect.arrayContaining(['leadHook', 'rearHook', 'bodyMovement', 'positioning', 'endurance', 'toughness'])
    );
    expect(STYLE_STATS['swarmer']).toHaveLength(6);
  });

  it('slugger trains rearHook, uppercut, power, endurance, recovery, toughness', () => {
    expect(STYLE_STATS['slugger']).toEqual(
      expect.arrayContaining(['rearHook', 'uppercut', 'power', 'endurance', 'recovery', 'toughness'])
    );
    expect(STYLE_STATS['slugger']).toHaveLength(6);
  });

  it('counterpuncher trains timing, adaptability, discipline, headMovement, bodyMovement, speed', () => {
    expect(STYLE_STATS['counterpuncher']).toEqual(
      expect.arrayContaining(['timing', 'adaptability', 'discipline', 'headMovement', 'bodyMovement', 'speed'])
    );
    expect(STYLE_STATS['counterpuncher']).toHaveLength(6);
  });
});

describe('EXP_PER_DAY', () => {
  it('local = 0.25, contender = 0.5, championship-caliber = 0.75, all-time-great = 1.0', () => {
    expect(EXP_PER_DAY['local']).toBe(0.25);
    expect(EXP_PER_DAY['contender']).toBe(0.5);
    expect(EXP_PER_DAY['championship-caliber']).toBe(0.75);
    expect(EXP_PER_DAY['all-time-great']).toBe(1.0);
  });
});

describe('gymLevelMultiplier', () => {
  it('level 1 gives 1.0x multiplier (no change)', () => {
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    // local = 0.25/day, 5 days, level 1 = 1.0x → 1.25 exp
    const result = applyTraining(boxer, coach, 5, 1);
    expect(result.trainingExp!['jab']).toBe(1.25);
  });

  it('level 5 gives 1.04x multiplier', () => {
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    // local = 0.25/day, 5 days, level 5 = 1.04x → 0.25 * 1.04 * 5 = 1.3
    const result = applyTraining(boxer, coach, 5, 5);
    expect(result.trainingExp!['jab']).toBeCloseTo(1.3, 10);
  });

  it('level 10 gives 1.09x multiplier', () => {
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    // local = 0.25/day, 5 days, level 10 = 1.09x → 0.25 * 1.09 * 5 = 1.3625
    const result = applyTraining(boxer, coach, 5, 10);
    expect(result.trainingExp!['jab']).toBeCloseTo(1.3625, 10);
  });

  it('gym level multiplier applies to both focus and off-style stats', () => {
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    // level 10 = 1.09x; off-style at 0.5 rate → 0.25 * 0.5 * 1.09 * 5 = 0.68125
    const result = applyTraining(boxer, coach, 5, 10);
    expect(result.trainingExp!['leadHook']).toBeCloseTo(0.68125, 10);
  });

  it('omitting gymLevel defaults to 1.0x (no change to existing behavior)', () => {
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 5);
    expect(result.trainingExp!['jab']).toBe(1.25);
  });
});

describe('applyTraining', () => {
  it('accumulates exp for coached stats without leveling up', () => {
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 5);
    // local coach = 0.25 exp/day, 5 days = 1.25 exp for focus stats
    // threshold for stat=10 is 100; 1.25 < 100 so no level-up
    expect(result.trainingExp!['jab']).toBe(1.25);
    expect(result.trainingExp!['cross']).toBe(1.25);
    expect(result.trainingExp!['speed']).toBe(1.25);
    // off-style stats accumulate at half rate: 0.25 * 0.5 * 5 = 0.625
    expect(result.trainingExp!['leadHook']).toBe(0.625);
  });

  it('does not modify the input boxer (immutable)', () => {
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    applyTraining(boxer, coach, 5);
    expect(boxer.trainingExp!['jab']).toBeUndefined();
  });

  it('levels up a stat when exp reaches threshold', () => {
    // stat=10, threshold=75 (10*7.5), contender=0.5exp/day, 150 days = 75 exp → level up
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'contender', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 150);
    expect(result.stats.jab).toBe(11);
    // remainder: 75 exp used, 0 leftover
    expect(result.trainingExp!['jab']).toBe(0);
  });

  it('carries over remainder exp after level-up', () => {
    // stat=10, threshold=75, contender=0.5/day, 160 days = 80 exp
    // 75 used for level-up, 5 remainder
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'contender', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 160);
    expect(result.stats.jab).toBe(11);
    expect(result.trainingExp!['jab']).toBe(5);
  });

  it('can level up multiple times in one sim step', () => {
    // stat=1, all-time-great=1.0/day, 8 days = 8 exp
    // threshold=1×7.5=7.5 → stat→2, rem=0.5; threshold=2×7.5=15, 0.5<15 → stop
    const boxer = makeBoxer({
      stats: { jab: 1, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: {},
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 8);
    expect(result.stats.jab).toBe(2);
    expect(result.trainingExp!['jab']).toBe(0.5);
  });

  it('caps stat at 20 without natural talent', () => {
    const boxer = makeBoxer({
      stats: { jab: 20, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: { jab: 148 },
      naturalTalents: [],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    // 1 day × 1.0 = 1 exp, total 149 — still below threshold 150 (20*7.5), no level-up
    const result = applyTraining(boxer, coach, 1);
    expect(result.stats.jab).toBe(20);
    expect(result.trainingExp!['jab']).toBe(149);
  });

  it('caps stat at 25 with natural talent for that stat', () => {
    const boxer = makeBoxer({
      stats: { jab: 24, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: { jab: 174 },
      naturalTalents: [{ stat: 'jab' }],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    // 6 days × 1.0 = 6 exp, total 180 — threshold for stat=24 is 180 (24*7.5) → level up to 25
    const result = applyTraining(boxer, coach, 6);
    expect(result.stats.jab).toBe(25);
  });

  it('does not exceed cap of 25 even with natural talent', () => {
    const boxer = makeBoxer({
      stats: { jab: 25, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: { jab: 0 },
      naturalTalents: [{ stat: 'jab' }],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 100);
    expect(result.stats.jab).toBe(25);
  });

  it('accumulates on top of existing exp', () => {
    const boxer = makeBoxer({ trainingExp: { jab: 50 } });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 10);
    // 50 existing + (0.25 × 10) = 52.5, threshold=75, no level-up
    expect(result.trainingExp!['jab']).toBe(52.5);
    expect(result.stats.jab).toBe(10);
  });

  it('trains coach style stats at full rate and off-style stats at half rate', () => {
    // boxer is out-boxer, coach is swarmer — swarmer stats at full rate, out-boxer at half
    const boxer = makeBoxer({ style: 'out-boxer', trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'swarmer' });
    const result = applyTraining(boxer, coach, 5);
    // local = 0.25/day, 5 days = 1.25 exp for swarmer focus stats
    expect(result.trainingExp!['leadHook']).toBe(1.25);
    expect(result.trainingExp!['toughness']).toBe(1.25);
    // out-boxer stats at half rate: 0.25 * 0.5 * 5 = 0.625
    expect(result.trainingExp!['jab']).toBe(0.625);
  });

  it('handles boxer with undefined trainingExp', () => {
    const boxer = makeBoxer({ trainingExp: undefined });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 5);
    // local = 0.25/day, 5 days = 1.25 exp
    expect(result.trainingExp!['jab']).toBe(1.25);
  });

  it('can level up past 20 when boxer has natural talent for that stat', () => {
    const boxer = makeBoxer({
      stats: { jab: 20, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: { jab: 148 },
      naturalTalents: [{ stat: 'jab' }],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    // 1 day × 1.0 = 1 exp, total 149 — threshold for stat=20 is 150, no level-up yet
    const r1 = applyTraining(boxer, coach, 1);
    expect(r1.stats.jab).toBe(20);
    // 1 more day × 1.0 = 1 exp, total 150 — threshold 150 crossed → level up to 21
    const r2 = applyTraining(r1, coach, 1);
    expect(r2.stats.jab).toBe(21);
  });
});

describe('computeTrainingCampBoost', () => {
  it('returns empty object when trainedDays is 0', () => {
    const boxer = makeBoxer();
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-05-01');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('returns empty object when totalDays is 0 (fight is today)', () => {
    const boxer = makeBoxer();
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-05-01', '2026-05-01');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('produces ~80% of max boost after training through the early segment only', () => {
    const boxer = makeBoxer();
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-06-16');
    // focus stats: floor(10 * 0.50 * 0.80) = 4
    expect(result['jab']).toBe(4);
    expect(result['cross']).toBe(4);
    expect(result['speed']).toBe(4);
    // off-style stats: floor(10 * 0.25 * 0.80) = 2
    expect(result['leadHook']).toBe(2);
  });

  it('produces full 50% boost after 60 days of training', () => {
    const boxer = makeBoxer();
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-07-01');
    expect(result['jab']).toBe(5);
    expect(result['cross']).toBe(5);
  });

  it('clamps delta when stat is at cap (20) without natural talent', () => {
    const boxer = makeBoxer({
      stats: {
        jab: 20, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-07-01');
    expect(result['jab']).toBeUndefined();
    expect(result['cross']).toBe(5);
  });

  it('clamps delta when natural talent stat is at 24 (cap=25, room=1)', () => {
    const boxer = makeBoxer({
      stats: {
        jab: 24, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [{ stat: 'jab' }],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-07-01');
    expect(result['jab']).toBe(1);
  });

  it('boosts focus stats at full rate and off-style stats at half rate', () => {
    const boxer = makeBoxer();
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'swarmer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-01', '2026-07-01');
    // swarmer focus stats: floor(10 * 0.50 * 1.0) = 5
    expect(result['leadHook']).toBe(5);
    expect(result['rearHook']).toBe(5);
    // off-style stats: floor(10 * 0.25 * 1.0) = 2
    expect(result['jab']).toBe(2);
    expect(result['cross']).toBe(2);
  });

  it('caps training days at 60 even if camp is longer', () => {
    const boxer = makeBoxer();
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = computeTrainingCampBoost(boxer, coach, '2026-05-01', '2026-07-30', '2026-07-30');
    expect(result['jab']).toBe(5);
  });
});

describe('computeNpcBoost', () => {
  it('returns empty object for Unknown reputation', () => {
    const boxer = makeBoxer({ reputation: 'Unknown' });
    const result = computeNpcBoost(boxer);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('returns 5% boost for Local Star (floor of 10 * 0.05 = 0)', () => {
    const boxer = makeBoxer({ reputation: 'Local Star', style: 'out-boxer' });
    const result = computeNpcBoost(boxer);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('returns correct boost for All-Time Great (45%)', () => {
    const boxer = makeBoxer({ reputation: 'All-Time Great', style: 'out-boxer' });
    const result = computeNpcBoost(boxer);
    expect(result['jab']).toBe(4);
    expect(result['cross']).toBe(4);
    expect(result['speed']).toBe(4);
    expect(result['leadHook']).toBeUndefined();
  });

  it('boosts style stats only, matching boxer style', () => {
    const boxer = makeBoxer({ reputation: 'All-Time Great', style: 'slugger' });
    const result = computeNpcBoost(boxer);
    expect(result['rearHook']).toBe(4);
    expect(result['uppercut']).toBe(4);
    expect(result['jab']).toBeUndefined();
  });

  it('clamps delta so boosted stat does not exceed cap', () => {
    const boxer = makeBoxer({
      reputation: 'All-Time Great',
      style: 'out-boxer',
      stats: {
        jab: 19, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
    });
    const result = computeNpcBoost(boxer);
    expect(result['jab']).toBe(1);
  });
});

describe('applyFightExp', () => {
  it('adds exp to all 17 stats', () => {
    const boxer = makeBoxer({ reputation: 'Unknown', trainingExp: {} });
    const result = applyFightExp(boxer);
    // Unknown = 0.25 * 60 = 15 exp per stat
    expect(result.trainingExp!['jab']).toBe(15);
    expect(result.trainingExp!['leadHook']).toBe(15);
    expect(result.trainingExp!['timing']).toBe(15);
    expect(result.trainingExp!['power']).toBe(15);
    expect(result.trainingExp!['toughness']).toBe(15);
  });

  it('exp scales with reputation', () => {
    const unknown = makeBoxer({ reputation: 'Unknown', trainingExp: {} });
    const allTimeGreat = makeBoxer({ reputation: 'All-Time Great', trainingExp: {} });
    const r1 = applyFightExp(unknown);
    const r2 = applyFightExp(allTimeGreat);
    expect(r2.trainingExp!['jab']).toBeGreaterThan(r1.trainingExp!['jab']!);
    // All-Time Great = 1.0 * 60 = 60
    expect(r2.trainingExp!['jab']).toBe(60);
  });

  it('levels up a stat when exp crosses threshold', () => {
    // stat=10, threshold=75 (10*7.5); Unknown fight gives 15 exp; existing 65 → total 80 → level up
    const boxer = makeBoxer({
      reputation: 'Unknown',
      trainingExp: { jab: 65 },
    });
    const result = applyFightExp(boxer);
    expect(result.stats.jab).toBe(11);
    expect(result.trainingExp!['jab']).toBe(5); // 80 - 75 = 5 remainder
  });

  it('does not exceed stat cap of 20', () => {
    const boxer = makeBoxer({
      reputation: 'All-Time Great',
      stats: { jab: 20, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: {},
    });
    const result = applyFightExp(boxer);
    expect(result.stats.jab).toBe(20);
  });

  it('does not modify the input boxer (immutable)', () => {
    const boxer = makeBoxer({ reputation: 'Unknown', trainingExp: {} });
    applyFightExp(boxer);
    expect(boxer.trainingExp!['jab']).toBeUndefined();
  });
});

describe('talentGainProbability', () => {
  it('age 18 returns the peak probability ~0.0013', () => {
    expect(talentGainProbability(18)).toBeCloseTo(0.0013, 4);
  });

  it('probability decreases as age increases from 18 to 34', () => {
    expect(talentGainProbability(25)).toBeLessThan(talentGainProbability(18));
    expect(talentGainProbability(30)).toBeLessThan(talentGainProbability(25));
    expect(talentGainProbability(34)).toBeLessThan(talentGainProbability(30));
  });

  it('age 35+ is floored at 0.00005', () => {
    // at age 35 the linear formula produces ~0.0000505, which the floor clamps to 0.00005
    expect(talentGainProbability(35)).toBeCloseTo(0.00005, 4);
    expect(talentGainProbability(40)).toBe(0.00005);
  });
});

describe('rollTalentGain', () => {
  it('returns null when rng roll is above the probability threshold', () => {
    const boxer = makeBoxer({ age: 18 });
    const coach = makeCoach({ style: 'out-boxer' });
    // rng always returns 1.0 (never wins)
    const result = rollTalentGain(boxer, coach, () => 1.0);
    expect(result).toBeNull();
  });

  it('returns a talent when rng roll is below the probability threshold', () => {
    const boxer = makeBoxer({ age: 18 });
    const coach = makeCoach({ style: 'out-boxer' });
    // rng returns 0 (always wins), then a fixed value for stat selection
    let callCount = 0;
    const result = rollTalentGain(boxer, coach, () => callCount++ === 0 ? 0 : 0);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('stat');
  });

  it('returned talent stat comes from coach focus stats (70% pool) or boxer focus stats (30% pool)', () => {
    // boxer=swarmer, coach=out-boxer: pools are different
    const boxer = makeBoxer({ age: 18, style: 'swarmer', naturalTalents: [] });
    const coach = makeCoach({ style: 'out-boxer' });
    const coachStats = new Set(STYLE_STATS['out-boxer']);
    const boxerStats = new Set(STYLE_STATS['swarmer']);
    const validStats = new Set([...coachStats, ...boxerStats]);

    // force a win by making the first roll 0
    let call = 0;
    const result = rollTalentGain(boxer, coach, () => call++ === 0 ? 0 : 0.5);
    expect(result).not.toBeNull();
    expect(validStats.has(result!.stat)).toBe(true);
  });

  it('never returns a talent the boxer already has', () => {
    // boxer already has all out-boxer stats as talents
    const coachStats = STYLE_STATS['out-boxer'];
    const boxer = makeBoxer({
      age: 18,
      style: 'out-boxer',
      naturalTalents: coachStats.map(stat => ({ stat })),
    });
    const coach = makeCoach({ style: 'out-boxer' });
    // force a win
    let call = 0;
    // With same style, pool = coach stats only (all already held) — should return null
    const result = rollTalentGain(boxer, coach, () => call++ === 0 ? 0 : 0);
    expect(result).toBeNull();
  });

  it('returns null when boxer already holds all stats in the combined pool', () => {
    const coachStats = STYLE_STATS['out-boxer'];
    const boxerStats = STYLE_STATS['swarmer'];
    const allPoolStats = [...new Set([...coachStats, ...boxerStats])];
    const boxer = makeBoxer({
      age: 18,
      style: 'swarmer',
      naturalTalents: allPoolStats.map(stat => ({ stat })),
    });
    const coach = makeCoach({ style: 'out-boxer' });
    let call = 0;
    const result = rollTalentGain(boxer, coach, () => call++ === 0 ? 0 : 0);
    expect(result).toBeNull();
  });

  it('applyTraining appends a talent when rollTalentGain fires', () => {
    const boxer = makeBoxer({ age: 18, naturalTalents: [] });
    const coach = makeCoach({ style: 'out-boxer' });
    // Simulate 1 day with rng that always triggers the talent roll
    const result = applyTraining(boxer, coach, 1, 1, () => 0);
    expect(result.naturalTalents.length).toBe(1);
  });

  it('applyTraining does not append a talent when roll misses', () => {
    const boxer = makeBoxer({ age: 18, naturalTalents: [] });
    const coach = makeCoach({ style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 1, 1, () => 1.0);
    expect(result.naturalTalents.length).toBe(0);
  });

  it('applyTraining can gain at most one talent per day even over many days', () => {
    // 365 days, rng always wins — should gain at most one per day but cap at pool size
    const boxer = makeBoxer({ age: 18, style: 'out-boxer', naturalTalents: [] });
    const coach = makeCoach({ style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 365, 1, () => 0);
    // pool = out-boxer focus stats (6 stats), can't exceed that
    expect(result.naturalTalents.length).toBeLessThanOrEqual(STYLE_STATS['out-boxer'].length);
    // with always-0 rng, should have gained all available pool stats
    expect(result.naturalTalents.length).toBe(STYLE_STATS['out-boxer'].length);
  });
});
