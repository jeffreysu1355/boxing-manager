import { describe, it, expect } from 'vitest';
import { calcViewers, calcPpvPayout, calcRecordMultiplier, calcStreakMultiplier, PPV_REVENUE_PER_VIEWER } from './ppvCalc';

describe('calcViewers', () => {
  const network = {
    baseViewership: 1_000_000,
    titleFightMultiplier: 1.5,
    minBoxerRank: 0,
    federationId: 1,
  };

  it('applies 60% base', () => {
    const viewers = calcViewers({ network, gymBoxerRank: 0, opponentRank: 0, isTitleFight: false, isSameFederation: false });
    expect(viewers).toBe(600_000);
  });

  it('applies home federation bonus (+20%)', () => {
    const viewers = calcViewers({ network, gymBoxerRank: 0, opponentRank: 0, isTitleFight: false, isSameFederation: true });
    expect(viewers).toBe(720_000);
  });

  it('applies title fight multiplier', () => {
    const viewers = calcViewers({ network, gymBoxerRank: 0, opponentRank: 0, isTitleFight: true, isSameFederation: false });
    expect(viewers).toBe(900_000);
  });

  it('applies rank bonus for each boxer above minBoxerRank', () => {
    // gymBoxer 2 levels above, opponent 1 level above => 3 * 0.05 = +15%
    const viewers = calcViewers({ network: { ...network, minBoxerRank: 2 }, gymBoxerRank: 4, opponentRank: 3, isTitleFight: false, isSameFederation: false });
    expect(viewers).toBeCloseTo(600_000 * 1.15, 0);
  });

  it('caps rank bonus at +50%', () => {
    // excess = 5 + 5 = 10 => 10*0.05 = 0.5 (capped at 0.5)
    const viewers = calcViewers({ network: { ...network, minBoxerRank: 0 }, gymBoxerRank: 5, opponentRank: 5, isTitleFight: false, isSameFederation: false });
    expect(viewers).toBe(600_000 * 1.5);
  });

  it('combines all bonuses', () => {
    // base=600k, home=*1.2, rank=(2 excess)*0.05=+10%=*1.1, title=*1.5
    const viewers = calcViewers({ network: { ...network, minBoxerRank: 3 }, gymBoxerRank: 5, opponentRank: 3, isTitleFight: true, isSameFederation: true });
    expect(viewers).toBeCloseTo(600_000 * 1.2 * 1.1 * 1.5, 0);
  });
});

describe('calcPpvPayout', () => {
  it('computes payout correctly', () => {
    const payout = calcPpvPayout(1_000_000, 50);
    expect(payout).toBe(1_000_000 * 0.5 * PPV_REVENUE_PER_VIEWER);
  });

  it('returns 0 for 0 viewers', () => {
    expect(calcPpvPayout(0, 50)).toBe(0);
  });
});

describe('calcRecordMultiplier', () => {
  const win = (n: number) => Array.from({ length: n }, () => ({
    result: 'win' as const, opponentName: 'X', opponentId: null,
    method: 'KO', finishingMove: null, round: 1, time: '1:00',
    federation: 'NABF', date: '2026-01-01',
  }));
  const loss = (n: number) => Array.from({ length: n }, () => ({
    result: 'loss' as const, opponentName: 'X', opponentId: null,
    method: 'KO', finishingMove: null, round: 1, time: '1:00',
    federation: 'NABF', date: '2026-01-01',
  }));
  const draw = (n: number) => Array.from({ length: n }, () => ({
    result: 'draw' as const, opponentName: 'X', opponentId: null,
    method: 'Draw', finishingMove: null, round: 12, time: '3:00',
    federation: 'NABF', date: '2026-01-01',
  }));

  it('returns 1.0 for two fighters with no fights (neutral default)', () => {
    expect(calcRecordMultiplier([], [])).toBe(1.0);
  });

  it('returns 1.0 when both have 50% win rate (anchor point)', () => {
    expect(calcRecordMultiplier([...win(1), ...loss(1)], [...win(1), ...loss(1)])).toBe(1.0);
  });

  it('returns 1.4 when both are undefeated (max bonus)', () => {
    expect(calcRecordMultiplier(win(10), win(10))).toBe(1.4);
  });

  it('returns near 1.0 for lopsided matchup (90% vs 10%)', () => {
    const highWin = [...win(9), ...loss(1)];
    const lowWin = [...win(1), ...loss(9)];
    expect(calcRecordMultiplier(highWin, lowWin)).toBe(1.0);
  });

  it('returns ~1.24 for two 80% win rate fighters', () => {
    const record = [...win(8), ...loss(2)];
    expect(calcRecordMultiplier(record, record)).toBeCloseTo(1.24, 2);
  });

  it('treats draws as non-wins (counts against denominator)', () => {
    // 5 wins, 0 losses, 5 draws = 50% win rate → same as 5-5-0 → geo mean 0.5 → 1.0
    const record = [...win(5), ...draw(5)];
    expect(calcRecordMultiplier(record, record)).toBe(1.0);
  });

  it('works correctly with a single fight on record', () => {
    // 1 win each → 100% → geo mean 1.0 → multiplier 1.4
    expect(calcRecordMultiplier(win(1), win(1))).toBe(1.4);
  });
});

describe('calcStreakMultiplier', () => {
  const makeRecord = (results: ('win' | 'loss')[]) =>
    results.map(result => ({
      result, opponentName: 'X', opponentId: null,
      method: 'KO', finishingMove: null, round: 1, time: '1:00',
      federation: 'NABF', date: '2026-01-01',
    }));

  it('returns 1.0 for two fighters with no fights', () => {
    expect(calcStreakMultiplier([], [])).toBe(1.0);
  });

  it('returns 1.0 when neither is on a winning streak', () => {
    const record = makeRecord(['win', 'loss']);
    expect(calcStreakMultiplier(record, record)).toBe(1.0);
  });

  it('returns 1.15 when both are on 5+ fight win streaks (max bonus)', () => {
    const record = makeRecord(['loss', 'win', 'win', 'win', 'win', 'win']);
    expect(calcStreakMultiplier(record, record)).toBeCloseTo(1.15, 5);
  });

  it('returns ~1.0 when one is on a streak but the other is not', () => {
    const streaking = makeRecord(['win', 'win', 'win', 'win', 'win']);
    const notStreaking = makeRecord(['win', 'loss']);
    expect(calcStreakMultiplier(streaking, notStreaking)).toBe(1.0);
  });

  it('returns ~1.09 when both are on 3-fight win streaks', () => {
    // sqrt((3/5) * (3/5)) * 0.15 = 0.6 * 0.15 = 0.09 → 1.09
    const record = makeRecord(['win', 'win', 'win', 'win', 'win', 'loss', 'win', 'win', 'win']);
    expect(calcStreakMultiplier(record, record)).toBeCloseTo(1.09, 5);
  });

  it('caps streak at 5 regardless of longer streak', () => {
    const longStreak = makeRecord(['win', 'win', 'win', 'win', 'win', 'win', 'win', 'win']);
    expect(calcStreakMultiplier(longStreak, longStreak)).toBeCloseTo(1.15, 5);
  });
});
