import { describe, it, expect } from 'vitest';
import { calcViewers, calcPpvPayout, PPV_REVENUE_PER_VIEWER } from './ppvCalc';

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
