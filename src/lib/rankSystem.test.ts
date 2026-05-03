import { describe, it, expect } from 'vitest';
import { RANK_CONFIG, REPUTATION_ORDER, applyRankChange } from './rankSystem';
import type { Boxer, BoxerStats } from '../db/db';

function makeStats(val: number): BoxerStats {
  return {
    jab: val, cross: val, leadHook: val, rearHook: val, uppercut: val,
    headMovement: val, bodyMovement: val, guard: val, positioning: val,
    timing: val, adaptability: val, discipline: val,
    speed: val, power: val, endurance: val, recovery: val, toughness: val,
  };
}

function makeBoxer(overrides: Partial<Boxer> = {}): Boxer {
  return {
    id: 1,
    name: 'Test',
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
    rankPoints: 0,
    demotionBuffer: 10,
    ...overrides,
  };
}

describe('RANK_CONFIG', () => {
  it('has an entry for every reputation level', () => {
    for (const rep of REPUTATION_ORDER) {
      expect(RANK_CONFIG[rep]).toBeDefined();
      expect(RANK_CONFIG[rep].baseWinPoints).toBeGreaterThan(0);
    }
  });

  it('All-Time Great has Infinity promotionThreshold', () => {
    expect(RANK_CONFIG['All-Time Great'].promotionThreshold).toBe(Infinity);
  });
});

describe('applyRankChange - wins', () => {
  it('same-rank win adds points and never goes negative', () => {
    const boxer = makeBoxer({ reputation: 'Unknown', rankPoints: 0, demotionBuffer: 10 });
    const opponent = makeBoxer({ reputation: 'Unknown' });
    const result = applyRankChange(boxer, opponent, 'win', false);
    expect(result.rankPoints).toBeGreaterThan(0);
    expect(result.demotionBuffer).toBe(10); // buffer unchanged on win
  });

  it('beating a higher-ranked opponent gives more points than same rank', () => {
    const boxer = makeBoxer({ reputation: 'Unknown', rankPoints: 0, demotionBuffer: 10 });
    const sameOpponent = makeBoxer({ reputation: 'Unknown' });
    const higherOpponent = makeBoxer({ reputation: 'Rising Star' });
    const sameResult = applyRankChange(boxer, sameOpponent, 'win', false);
    const higherResult = applyRankChange(boxer, higherOpponent, 'win', false);
    expect(higherResult.rankPoints).toBeGreaterThan(sameResult.rankPoints);
  });

  it('beating a much lower-ranked opponent gives near-zero points (never negative)', () => {
    const boxer = makeBoxer({ reputation: 'Nationally Ranked', rankPoints: 0, demotionBuffer: 40 });
    const opponent = makeBoxer({ reputation: 'Unknown' });
    const result = applyRankChange(boxer, opponent, 'win', false);
    expect(result.rankPoints).toBeGreaterThanOrEqual(0);
    expect(result.rankPoints).toBeLessThan(5);
  });

  it('title fight win uses 2x base regardless of gap', () => {
    const boxer = makeBoxer({ reputation: 'Unknown', rankPoints: 0, demotionBuffer: 10 });
    const opponent = makeBoxer({ reputation: 'Unknown' });
    const normalResult = applyRankChange(boxer, opponent, 'win', false);
    const titleResult = applyRankChange(boxer, opponent, 'win', true);
    expect(titleResult.rankPoints).toBeGreaterThan(normalResult.rankPoints);
  });

  it('promotion happens when rankPoints reaches threshold', () => {
    const threshold = RANK_CONFIG['Unknown'].promotionThreshold;
    const boxer = makeBoxer({ reputation: 'Unknown', rankPoints: threshold - 1, demotionBuffer: 5 });
    const opponent = makeBoxer({ reputation: 'Unknown' });
    const result = applyRankChange(boxer, opponent, 'win', false);
    expect(result.reputation).toBe('Local Star');
    expect(result.rankPoints).toBe(0);
    expect(result.demotionBuffer).toBe(RANK_CONFIG['Local Star'].bufferMax);
    expect(result.lastRankDelta?.promoted).toBe(true);
  });

  it('All-Time Great cannot be promoted further', () => {
    const boxer = makeBoxer({ reputation: 'All-Time Great', rankPoints: 999, demotionBuffer: 50 });
    const opponent = makeBoxer({ reputation: 'All-Time Great' });
    const result = applyRankChange(boxer, opponent, 'win', false);
    expect(result.reputation).toBe('All-Time Great');
  });
});

describe('applyRankChange - losses', () => {
  it('loss drains buffer before rankPoints', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 20, demotionBuffer: 20 });
    const opponent = makeBoxer({ reputation: 'Rising Star' });
    const result = applyRankChange(boxer, opponent, 'loss', false);
    expect(result.demotionBuffer).toBeLessThan(20);
    expect(result.rankPoints).toBe(20); // rankPoints untouched while buffer absorbs
  });

  it('loss overflow drains rankPoints after buffer is empty', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 20, demotionBuffer: 0 });
    const opponent = makeBoxer({ reputation: 'Rising Star' });
    const result = applyRankChange(boxer, opponent, 'loss', false);
    expect(result.rankPoints).toBeLessThan(20);
  });

  it('demotion occurs when both rankPoints and buffer reach 0', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 0, demotionBuffer: 0 });
    const opponent = makeBoxer({ reputation: 'Rising Star' });
    const result = applyRankChange(boxer, opponent, 'loss', false);
    expect(result.reputation).toBe('Local Star');
    expect(result.lastRankDelta?.demoted).toBe(true);
    // rankPoints set to 70% of lower rank's threshold
    const expected = Math.floor(RANK_CONFIG['Local Star'].promotionThreshold * 0.7);
    expect(result.rankPoints).toBe(expected);
    expect(result.demotionBuffer).toBe(RANK_CONFIG['Local Star'].bufferMax);
  });

  it('title fight loss has no rank penalty', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 20, demotionBuffer: 0 });
    const opponent = makeBoxer({ reputation: 'Rising Star' });
    const result = applyRankChange(boxer, opponent, 'loss', true);
    expect(result.rankPoints).toBe(20);
    expect(result.demotionBuffer).toBe(0);
    expect(result.reputation).toBe('Rising Star');
  });

  it('Unknown is the floor — no demotion below Unknown', () => {
    const boxer = makeBoxer({ reputation: 'Unknown', rankPoints: 0, demotionBuffer: 0 });
    const opponent = makeBoxer({ reputation: 'Unknown' });
    const result = applyRankChange(boxer, opponent, 'loss', false);
    expect(result.reputation).toBe('Unknown');
  });

  it('losing to lower-ranked opponent gives bigger loss than same rank', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 0, demotionBuffer: 30 });
    const sameOpponent = makeBoxer({ reputation: 'Rising Star' });
    const lowerOpponent = makeBoxer({ reputation: 'Unknown' });
    const sameResult = applyRankChange(boxer, sameOpponent, 'loss', false);
    const lowerResult = applyRankChange(boxer, lowerOpponent, 'loss', false);
    expect(lowerResult.demotionBuffer).toBeLessThan(sameResult.demotionBuffer);
  });
});

describe('applyRankChange - draws', () => {
  it('draw makes no change to rank fields', () => {
    const boxer = makeBoxer({ reputation: 'Rising Star', rankPoints: 15, demotionBuffer: 12 });
    const opponent = makeBoxer({ reputation: 'Rising Star' });
    const result = applyRankChange(boxer, opponent, 'draw', false);
    expect(result.reputation).toBe('Rising Star');
    expect(result.rankPoints).toBe(15);
    expect(result.demotionBuffer).toBe(12);
    expect(result.lastRankDelta).toBeUndefined();
  });
});
