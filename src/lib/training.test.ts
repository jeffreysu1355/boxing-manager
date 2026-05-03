import { describe, it, expect } from 'vitest';
import { applyTraining, STYLE_STATS, EXP_PER_DAY } from './training';
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

describe('applyTraining', () => {
  it('accumulates exp for coached stats without leveling up', () => {
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 5);
    // local coach = 0.25 exp/day, 5 days = 1.25 exp per stat
    // threshold for stat=10 is 100; 1.25 < 100 so no level-up
    expect(result.trainingExp!['jab']).toBe(1.25);
    expect(result.trainingExp!['cross']).toBe(1.25);
    expect(result.trainingExp!['speed']).toBe(1.25);
    // non-coached stats unchanged
    expect(result.trainingExp!['leadHook']).toBeUndefined();
  });

  it('does not modify the input boxer (immutable)', () => {
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'out-boxer' });
    applyTraining(boxer, coach, 5);
    expect(boxer.trainingExp!['jab']).toBeUndefined();
  });

  it('levels up a stat when exp reaches threshold', () => {
    // stat=10, threshold=100, contender=0.5exp/day, 200 days = 100 exp → level up
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'contender', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 200);
    expect(result.stats.jab).toBe(11);
    // remainder: 100 exp used, 0 leftover
    expect(result.trainingExp!['jab']).toBe(0);
  });

  it('carries over remainder exp after level-up', () => {
    // stat=10, threshold=100, contender=0.5/day, 210 days = 105 exp
    // 100 used for level-up, 5 remainder
    const boxer = makeBoxer({ trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'contender', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 210);
    expect(result.stats.jab).toBe(11);
    expect(result.trainingExp!['jab']).toBe(5);
  });

  it('can level up multiple times in one sim step', () => {
    // stat=1, all-time-great=1.0/day, 11 days = 11 exp
    // threshold=1×10=10 → stat→2, rem=1; threshold=2×10=20, 1<20 → stop
    const boxer = makeBoxer({
      stats: { jab: 1, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: {},
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    const result = applyTraining(boxer, coach, 11);
    expect(result.stats.jab).toBe(2);
    expect(result.trainingExp!['jab']).toBe(1);
  });

  it('caps stat at 20 without natural talent', () => {
    const boxer = makeBoxer({
      stats: { jab: 20, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: { jab: 190 },
      naturalTalents: [],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    // 1 day × 1.0 = 1 exp, total 191 — still below threshold 200, no level-up
    const result = applyTraining(boxer, coach, 1);
    expect(result.stats.jab).toBe(20);
    expect(result.trainingExp!['jab']).toBe(191);
  });

  it('caps stat at 25 with natural talent for that stat', () => {
    const boxer = makeBoxer({
      stats: { jab: 24, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
               headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
               timing: 10, adaptability: 10, discipline: 10,
               speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10 },
      trainingExp: { jab: 234 },
      naturalTalents: [{ stat: 'jab' }],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    // 6 days × 1.0 = 6 exp, total 240 — threshold for stat=24 is 240 → level up to 25
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
    // 50 existing + (0.25 × 10) = 52.5, threshold=100, no level-up
    expect(result.trainingExp!['jab']).toBe(52.5);
    expect(result.stats.jab).toBe(10);
  });

  it('trains coach style stats regardless of boxer style', () => {
    // boxer is out-boxer, coach is swarmer — boxer gets swarmer stats trained
    const boxer = makeBoxer({ style: 'out-boxer', trainingExp: {} });
    const coach = makeCoach({ skillLevel: 'local', style: 'swarmer' });
    const result = applyTraining(boxer, coach, 5);
    // local = 0.25/day, 5 days = 1.25 exp
    expect(result.trainingExp!['leadHook']).toBe(1.25);
    expect(result.trainingExp!['toughness']).toBe(1.25);
    // out-boxer stats not touched
    expect(result.trainingExp!['jab']).toBeUndefined();
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
      trainingExp: { jab: 190 },
      naturalTalents: [{ stat: 'jab' }],
    });
    const coach = makeCoach({ skillLevel: 'all-time-great', style: 'out-boxer' });
    // 1 day × 1.0 = 1 exp, total 191 — threshold for stat=20 is 200, no level-up yet
    const r1 = applyTraining(boxer, coach, 1);
    expect(r1.stats.jab).toBe(20);
    // 9 more days × 1.0 = 9 exp, total 200 — threshold 200 crossed → level up to 21
    const r2 = applyTraining(r1, coach, 9);
    expect(r2.stats.jab).toBe(21);
  });
});
