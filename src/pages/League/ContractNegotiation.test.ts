import { describe, it, expect } from 'vitest';
import { evaluateOffer, snapToIncrement, snapTo5 } from './ContractNegotiation';

// --- snapToIncrement ---

describe('snapToIncrement', () => {
  it('snaps $500 up to $1,000', () => {
    expect(snapToIncrement(500)).toBe(1000);
  });

  it('keeps exact $1,000', () => {
    expect(snapToIncrement(1000)).toBe(1000);
  });

  it('snaps $5,500 up to $6,000', () => {
    expect(snapToIncrement(5500)).toBe(6000);
  });

  it('snaps $10,001 up to $20,000', () => {
    expect(snapToIncrement(10001)).toBe(20000);
  });

  it('keeps exact $50,000', () => {
    expect(snapToIncrement(50000)).toBe(50000);
  });

  it('snaps $100,001 up to $200,000', () => {
    expect(snapToIncrement(100001)).toBe(200000);
  });

  it('keeps exact $500,000', () => {
    expect(snapToIncrement(500000)).toBe(500000);
  });

  it('caps at $1,000,000', () => {
    expect(snapToIncrement(1100000)).toBe(1000000);
  });
});

// --- snapTo5 ---

describe('snapTo5', () => {
  it('snaps 3 up to 5', () => {
    expect(snapTo5(3)).toBe(5);
  });

  it('keeps exact 50', () => {
    expect(snapTo5(50)).toBe(50);
  });

  it('snaps 51 up to 55', () => {
    expect(snapTo5(51)).toBe(55);
  });

  it('clamps 0 to 0', () => {
    expect(snapTo5(0)).toBe(0);
  });

  it('clamps 98 up to 100', () => {
    expect(snapTo5(98)).toBe(100);
  });

  it('clamps 105 to 100', () => {
    expect(snapTo5(105)).toBe(100);
  });
});

// --- evaluateOffer ---

describe('evaluateOffer', () => {
  // repGap = 0, fairPayout = 10_000 * (0.5 + (0+9)/18*2.5) = 10_000 * (0.5+1.25) = 17_500
  // fairPpvSplit = clamp(50 + 0*3, 10, 90) = 50
  // offerScore = (payout/17500) + (ppvSplit/50)

  it('accepts a very generous offer (offerScore >= 1.8)', () => {
    // payout=20000, split=70 => 20000/17500 + 70/50 = 1.143 + 1.4 = 2.543
    const result = evaluateOffer({
      playerPayout: 20000,
      playerPpvSplit: 70,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.99,
    });
    expect(result.outcome).toBe('accept');
  });

  it('always accepts when offerScore >= 1.8, regardless of random', () => {
    const result = evaluateOffer({
      playerPayout: 20000,
      playerPpvSplit: 70,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('accept');
  });

  it('accepts an 80% chance offer when random < 0.8 (offerScore 1.2–1.8)', () => {
    // Use payout=12000, split=50 => 12000/17500 + 1.0 = 0.686 + 1.0 = 1.686 (in 1.2–1.8 band)
    const result = evaluateOffer({
      playerPayout: 12000,
      playerPpvSplit: 50,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5, // < 0.8, so accept
    });
    expect(result.outcome).toBe('accept');
  });

  it('counters an 80% chance offer when random >= 0.8 (offerScore 1.2–1.8)', () => {
    const result = evaluateOffer({
      playerPayout: 12000,
      playerPpvSplit: 50,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.85,
    });
    expect(result.outcome).toBe('counter');
  });

  it('counters a moderate offer (offerScore 0.8–1.2) when random < 0.9', () => {
    // payout=6000, split=35 => 6000/17500 + 35/50 = 0.343 + 0.7 = 1.043 (in 0.8–1.2 band)
    const result = evaluateOffer({
      playerPayout: 6000,
      playerPpvSplit: 35,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('counter');
  });

  it('rejects a moderate offer when random >= 0.9 (offerScore 0.8–1.2)', () => {
    const result = evaluateOffer({
      playerPayout: 6000,
      playerPpvSplit: 35,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.95,
    });
    expect(result.outcome).toBe('reject');
  });

  it('rejects a very low offer (offerScore < 0.8) when random >= 0.3', () => {
    // payout=1000, split=10 => 1000/17500 + 10/50 = 0.057 + 0.2 = 0.257
    const result = evaluateOffer({
      playerPayout: 1000,
      playerPpvSplit: 10,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('reject');
  });

  it('can counter a very low offer when random < 0.3', () => {
    const result = evaluateOffer({
      playerPayout: 1000,
      playerPpvSplit: 10,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.1,
    });
    expect(result.outcome).toBe('counter');
  });

  it('round 3 modifier increases reject probability — counters a 0.8–1.2 band offer', () => {
    // Band 0.8–1.2: base counter=90%, reject=10%. Round 3: reject=30%, counter=70%.
    // random=0.75 >= 0.70 (counter threshold) so rejects
    const result = evaluateOffer({
      playerPayout: 6000,
      playerPpvSplit: 35,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 2,
      random: 0.75,
    });
    expect(result.outcome).toBe('reject');
  });

  it('counter includes payout adjustment when playerPayout < fairPayout', () => {
    // fairPayout=17500, offer payout=6000 → midpoint = 6000 + (17500-6000)/2 = 11750 → snap up
    const result = evaluateOffer({
      playerPayout: 6000,
      playerPpvSplit: 50,  // at fair ppv, no ppv counter
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('counter');
    if (result.outcome === 'counter') {
      expect(result.payout).not.toBeNull();
      expect(result.payout).toBeGreaterThan(6000);
      expect(result.ppvSplit).toBeNull();
    }
  });

  it('counter includes ppvSplit adjustment when playerPpvSplit < fairPpvSplit', () => {
    // fairPpvSplit=50, offer split=30 → midpoint = 30 + (50-30)/2 = 40 → snap to 40
    const result = evaluateOffer({
      playerPayout: 17500, // at fair payout, no payout counter
      playerPpvSplit: 30,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.85,
    });
    // payout/17500 + 30/50 = 1.0 + 0.6 = 1.6 (80/20 band), random=0.85 → counter
    expect(result.outcome).toBe('counter');
    if (result.outcome === 'counter') {
      expect(result.ppvSplit).not.toBeNull();
      expect(result.ppvSplit).toBeGreaterThan(30);
      expect(result.payout).toBeNull();
    }
  });

  it('handles negative rep gap (gym boxer more famous)', () => {
    // gymRepIndex=8, oppRepIndex=2 → repGap=-6
    // fairPayout = 10000 * (0.5 + (-6+9)/18*2.5) = 10000*(0.5+0.4167) = 9167
    // fairPpvSplit = clamp(50 + (-6)*3, 10, 90) = clamp(32, 10, 90) = 32
    const result = evaluateOffer({
      playerPayout: 5000,
      playerPpvSplit: 20,
      gymBoxerRepIndex: 8,
      opponentRepIndex: 2,
      roundsUsed: 0,
      random: 0.99,
    });
    // score = 5000/9167 + 20/32 = 0.545 + 0.625 = 1.17 (0.8–1.2 band), random=0.99 → reject
    expect(result.outcome).toBe('reject');
  });
});
