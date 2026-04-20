import { describe, it, expect } from 'vitest';
import {
  matchupLabel,
  statAvg,
  reputationIndex,
  calcRecord,
  formatEventDate,
} from './Schedule';
import type { BoxerStats, FightRecord } from '../../db/db';

// --- Fixtures ---

function makeStats(overrides: Partial<BoxerStats> = {}): BoxerStats {
  return {
    jab: 10, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
    headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
    timing: 10, adaptability: 10, discipline: 10,
    speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
    ...overrides,
  };
}

// --- matchupLabel ---

describe('matchupLabel', () => {
  it('returns "Counters you" when opponent counters gym boxer', () => {
    // out-boxer is countered by swarmer
    expect(matchupLabel('out-boxer', 'swarmer')).toBe('Counters you');
  });

  it('returns "You counter" when gym boxer counters opponent', () => {
    // swarmer counters out-boxer
    expect(matchupLabel('swarmer', 'out-boxer')).toBe('You counter');
  });

  it('returns "Neutral" for non-counter matchup', () => {
    expect(matchupLabel('out-boxer', 'slugger')).toBe('Neutral');
  });

  it('covers all four counter relationships', () => {
    expect(matchupLabel('swarmer', 'slugger')).toBe('Counters you');
    expect(matchupLabel('slugger', 'counterpuncher')).toBe('Counters you');
    expect(matchupLabel('counterpuncher', 'out-boxer')).toBe('Counters you');
    expect(matchupLabel('slugger', 'swarmer')).toBe('You counter');
  });
});

// --- statAvg ---

describe('statAvg', () => {
  it('returns offense average (jab+cross+leadHook+rearHook+uppercut / 5)', () => {
    const stats = makeStats({ jab: 20, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10 });
    expect(statAvg(stats, 'offense')).toBeCloseTo(12, 1);
  });

  it('returns defense average (headMovement+bodyMovement+guard+positioning / 4)', () => {
    const stats = makeStats({ headMovement: 20, bodyMovement: 10, guard: 10, positioning: 10 });
    expect(statAvg(stats, 'defense')).toBeCloseTo(12.5, 1);
  });

  it('returns physical average (speed+power+endurance+recovery+toughness / 5)', () => {
    const stats = makeStats({ speed: 20, power: 10, endurance: 10, recovery: 10, toughness: 10 });
    expect(statAvg(stats, 'physical')).toBeCloseTo(12, 1);
  });
});

// --- reputationIndex ---

describe('reputationIndex', () => {
  it('returns 0 for Unknown', () => {
    expect(reputationIndex('Unknown')).toBe(0);
  });

  it('returns 9 for All-Time Great', () => {
    expect(reputationIndex('All-Time Great')).toBe(9);
  });

  it('returns 4 for Contender', () => {
    expect(reputationIndex('Contender')).toBe(4);
  });
});

// --- calcRecord ---

describe('calcRecord', () => {
  it('returns wins-losses with no draws', () => {
    const record: FightRecord[] = [
      { result: 'win', opponentName: 'A', method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
      { result: 'loss', opponentName: 'B', method: 'Decision', finishingMove: null, round: 12, time: '3:00', federation: 'NABF', date: '2026-02-01' },
    ];
    expect(calcRecord(record)).toBe('1-1');
  });

  it('appends draws when present', () => {
    const record: FightRecord[] = [
      { result: 'win', opponentName: 'A', method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
      { result: 'draw', opponentName: 'C', method: 'Draw', finishingMove: null, round: 12, time: '3:00', federation: 'NABF', date: '2026-03-01' },
    ];
    expect(calcRecord(record)).toBe('1-0-1');
  });
});

// --- formatEventDate ---

describe('formatEventDate', () => {
  it('formats ISO date correctly', () => {
    expect(formatEventDate('2026-05-03')).toMatch(/May 3, 2026/);
  });

  it('does not shift date due to UTC offset', () => {
    expect(formatEventDate('2026-01-01')).toMatch(/Jan(uary)? 1, 2026/);
  });
});
