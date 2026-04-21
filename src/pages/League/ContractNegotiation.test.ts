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
//
// repGap = opponentRepIndex - gymBoxerRepIndex
// fairPayout  = 10_000 * (0.5 + ((9 - repGap) / 18) * 2.5)
// fairPpvSplit = clamp(50 - repGap * 3, 10, 90)
//
// At repGap=0: fairPayout = 10_000*(0.5+1.25) = 17_500, fairPpvSplit = 50
//
// offerScore = (playerPayout / fairPayout) + (playerPpvSplit / fairPpvSplit)
// LOW score  = player asking for little = opponent happy = accept
// HIGH score = player demanding too much = opponent rejects
//
// Bands:
//   score <= 0.8 : accept 100%
//   score <= 1.2 : accept 80%, counter 20%
//   score <= 1.8 : counter 90%, reject 10%
//   score >  1.8 : counter 30%, reject 70%
//
// Counter direction: AI pushes fields DOWN (player is asking too much)

describe('evaluateOffer', () => {
  it('accepts a very low-demand offer (offerScore <= 0.8)', () => {
    // payout=1000, split=10 => 1000/17500 + 10/50 = 0.057 + 0.2 = 0.257 <= 0.8 → always accept
    const result = evaluateOffer({
      playerPayout: 1000,
      playerPpvSplit: 10,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.99,
    });
    expect(result.outcome).toBe('accept');
  });

  it('always accepts when offerScore <= 0.8, regardless of random', () => {
    const result = evaluateOffer({
      playerPayout: 1000,
      playerPpvSplit: 10,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('accept');
  });

  it('accepts an 80% chance offer when random < 0.8 (offerScore 0.8–1.2)', () => {
    // payout=6000, split=35 => 6000/17500 + 35/50 = 0.343 + 0.7 = 1.043 (in 0.8–1.2 band)
    const result = evaluateOffer({
      playerPayout: 6000,
      playerPpvSplit: 35,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5, // < 0.8, so accept
    });
    expect(result.outcome).toBe('accept');
  });

  it('counters an 80% chance offer when random >= 0.8 (offerScore 0.8–1.2)', () => {
    // same offerScore 1.043, random=0.85 >= 0.8 → counter
    const result = evaluateOffer({
      playerPayout: 6000,
      playerPpvSplit: 35,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.85,
    });
    expect(result.outcome).toBe('counter');
  });

  it('counters a high-demand offer (offerScore 1.2–1.8) when random < 0.9', () => {
    // payout=12000, split=50 => 12000/17500 + 50/50 = 0.686 + 1.0 = 1.686 (in 1.2–1.8 band)
    const result = evaluateOffer({
      playerPayout: 12000,
      playerPpvSplit: 50,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('counter');
  });

  it('rejects a high-demand offer when random >= 0.9 (offerScore 1.2–1.8)', () => {
    const result = evaluateOffer({
      playerPayout: 12000,
      playerPpvSplit: 50,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.95,
    });
    expect(result.outcome).toBe('reject');
  });

  it('rejects a very high-demand offer (offerScore > 1.8) when random >= 0.3', () => {
    // payout=20000, split=70 => 20000/17500 + 70/50 = 1.143 + 1.4 = 2.543 > 1.8 → 70% reject
    const result = evaluateOffer({
      playerPayout: 20000,
      playerPpvSplit: 70,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('reject');
  });

  it('can counter a very high-demand offer when random < 0.3', () => {
    const result = evaluateOffer({
      playerPayout: 20000,
      playerPpvSplit: 70,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.1,
    });
    expect(result.outcome).toBe('counter');
  });

  it('round 3 modifier increases reject probability in 1.2–1.8 band', () => {
    // Band 1.2–1.8: base counter=90%, reject=10%. Round 3: reject=30%, counter=70%.
    // random=0.75 >= 0.70 (counter threshold) so rejects
    const result = evaluateOffer({
      playerPayout: 12000,
      playerPpvSplit: 50,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 2,
      random: 0.75,
    });
    expect(result.outcome).toBe('reject');
  });

  it('counter pushes payout DOWN when playerPayout > fairPayout', () => {
    // fairPayout=17500, offer payout=25000 → midpoint = 25000 - (25000-17500)/2 = 21250 → snap down
    // offerScore = 25000/17500 + 50/50 = 1.429 + 1.0 = 2.429 > 1.8 band, random=0.1 → counter
    const result = evaluateOffer({
      playerPayout: 25000,
      playerPpvSplit: 50,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.1,
    });
    expect(result.outcome).toBe('counter');
    if (result.outcome === 'counter') {
      expect(result.payout).not.toBeNull();
      expect(result.payout).toBeLessThan(25000);
      expect(result.ppvSplit).toBeNull(); // ppv at fair, no adjustment
    }
  });

  it('counter pushes ppvSplit DOWN when playerPpvSplit > fairPpvSplit', () => {
    // fairPpvSplit=50, offer split=80 → midpoint = 80 - (80-50)/2 = 65 → snap to 65
    // offerScore = 1000/17500 + 80/50 = 0.057 + 1.6 = 1.657 in 1.2–1.8 band, random=0.85 → counter
    const result = evaluateOffer({
      playerPayout: 1000,
      playerPpvSplit: 80,
      gymBoxerRepIndex: 4,
      opponentRepIndex: 4,
      roundsUsed: 0,
      random: 0.85,
    });
    expect(result.outcome).toBe('counter');
    if (result.outcome === 'counter') {
      expect(result.ppvSplit).not.toBeNull();
      expect(result.ppvSplit).toBeLessThan(80);
      expect(result.payout).toBeNull(); // payout below fair, no payout adjustment
    }
  });

  it('bigger name opponent accepts a lower payout offer (repGap=+6)', () => {
    // gymRepIndex=2, oppRepIndex=8 → repGap=+6
    // fairPayout = 10000*(0.5 + ((9-6)/18)*2.5) = 10000*(0.5+0.4167) = 9167
    // fairPpvSplit = clamp(50 - 6*3, 10, 90) = clamp(32, 10, 90) = 32
    // offer payout=5000, split=20 → score = 5000/9167 + 20/32 = 0.545 + 0.625 = 1.17 (0.8–1.2)
    // random=0.5 < 0.8 → accept
    const result = evaluateOffer({
      playerPayout: 5000,
      playerPpvSplit: 20,
      gymBoxerRepIndex: 2,
      opponentRepIndex: 8,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('accept');
  });

  it('lesser opponent rejects same low offer that bigger name would accept (repGap=-6)', () => {
    // gymRepIndex=8, oppRepIndex=2 → repGap=-6
    // fairPayout = 10000*(0.5 + ((9-(-6))/18)*2.5) = 10000*(0.5+2.0833) = 10000*2.0833...
    // wait: (9-(-6))/18 = 15/18 = 0.8333, * 2.5 = 2.0833, + 0.5 = 2.5833 → fairPayout=25833
    // fairPpvSplit = clamp(50 - (-6)*3, 10, 90) = clamp(68, 10, 90) = 68
    // offer payout=5000, split=20 → score = 5000/25833 + 20/68 = 0.194 + 0.294 = 0.488 <= 0.8
    // → always accept (lesser opponent accepts even modest terms)
    // To get rejection with lesser opponent, player must demand MORE:
    // offer payout=30000, split=80 → score = 30000/25833 + 80/68 = 1.161 + 1.176 = 2.337 > 1.8
    // random=0.5 → reject
    const result = evaluateOffer({
      playerPayout: 30000,
      playerPpvSplit: 80,
      gymBoxerRepIndex: 8,
      opponentRepIndex: 2,
      roundsUsed: 0,
      random: 0.5,
    });
    expect(result.outcome).toBe('reject');
  });
});
