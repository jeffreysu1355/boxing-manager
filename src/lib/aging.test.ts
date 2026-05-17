import { describe, it, expect } from 'vitest';
import { shouldAgeBoxer, regressionPointsPerMonth, applyStatRegression } from './aging';
import type { Boxer } from '../db/db';

describe('shouldAgeBoxer', () => {
  it('returns false when newYear <= lastAgedYear', () => {
    expect(shouldAgeBoxer('1990-06-15', 2026, 2026, 8)).toBe(false);
    expect(shouldAgeBoxer('1990-06-15', 2026, 2025, 8)).toBe(false);
  });

  it('returns true when newYear > lastAgedYear and newMonth >= birthMonth', () => {
    expect(shouldAgeBoxer('1990-06-15', 2025, 2026, 6)).toBe(true);
    expect(shouldAgeBoxer('1990-06-15', 2025, 2026, 12)).toBe(true);
  });

  it('returns false when newYear > lastAgedYear but newMonth < birthMonth', () => {
    expect(shouldAgeBoxer('1990-06-15', 2025, 2026, 5)).toBe(false);
    expect(shouldAgeBoxer('1990-06-15', 2025, 2026, 1)).toBe(false);
  });
});

describe('regressionPointsPerMonth', () => {
  it('returns 0 for age 35 and below', () => {
    expect(regressionPointsPerMonth(18)).toBe(0);
    expect(regressionPointsPerMonth(35)).toBe(0);
  });

  it('returns 0 for age 36–41 (floor of < 1.0)', () => {
    expect(regressionPointsPerMonth(36)).toBe(0);
    expect(regressionPointsPerMonth(41)).toBe(0);
  });

  it('returns 1 for age 42 (floor of 1.05)', () => {
    expect(regressionPointsPerMonth(42)).toBe(1);
  });

  it('returns 2 for age 49 (floor of 2.1)', () => {
    expect(regressionPointsPerMonth(49)).toBe(2);
  });

  it('returns 3 for age 56 (floor of 3.15)', () => {
    expect(regressionPointsPerMonth(56)).toBe(3);
  });
});

describe('applyStatRegression', () => {
  it('returns boxer unchanged when regressionPointsPerMonth is 0', () => {
    const boxer: Boxer = {
      name: 'Test', age: 35, weightClass: 'lightweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: 1, federationId: null, rankPoints: 0, demotionBuffer: 0,
      stats: {
        jab: 10, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [], injuries: [], titles: [], record: [],
    };
    const result = applyStatRegression(boxer);
    expect(result).toBe(boxer);
  });

  it('deducts 1 point from weakest non-style stat for age 42 out-boxer', () => {
    const boxer: Boxer = {
      name: 'Test', age: 42, weightClass: 'lightweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: 1, federationId: null, rankPoints: 0, demotionBuffer: 0,
      stats: {
        jab: 15, cross: 15, leadHook: 5, rearHook: 10, uppercut: 10,
        headMovement: 15, bodyMovement: 10, guard: 15, positioning: 15,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 15, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [], injuries: [], titles: [], record: [],
    };
    const result = applyStatRegression(boxer);
    expect(result.stats.leadHook).toBe(4);
    expect(result.stats.jab).toBe(15);
    expect(result.stats.cross).toBe(15);
  });

  it('floors stat at 1, not 0', () => {
    const boxer: Boxer = {
      name: 'Test', age: 42, weightClass: 'lightweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: 1, federationId: null, rankPoints: 0, demotionBuffer: 0,
      stats: {
        jab: 10, cross: 10, leadHook: 1, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [], injuries: [], titles: [], record: [],
    };
    const result = applyStatRegression(boxer);
    expect(result.stats.leadHook).toBe(1);
    const nonStyleStats = ['leadHook', 'rearHook', 'uppercut', 'bodyMovement', 'timing', 'adaptability', 'discipline', 'power', 'endurance', 'recovery', 'toughness'] as const;
    const totalNonStyle = nonStyleStats.reduce((sum, s) => sum + result.stats[s], 0);
    expect(totalNonStyle).toBe(100);
  });

  it('returns a new boxer object (immutable)', () => {
    const boxer: Boxer = {
      name: 'Test', age: 42, weightClass: 'lightweight', style: 'out-boxer',
      reputation: 'Unknown', gymId: 1, federationId: null, rankPoints: 0, demotionBuffer: 0,
      stats: {
        jab: 10, cross: 10, leadHook: 5, rearHook: 10, uppercut: 10,
        headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
        timing: 10, adaptability: 10, discipline: 10,
        speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
      },
      naturalTalents: [], injuries: [], titles: [], record: [],
    };
    const result = applyStatRegression(boxer);
    expect(result).not.toBe(boxer);
    expect(boxer.stats.leadHook).toBe(5);
  });
});
