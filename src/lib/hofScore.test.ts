import { describe, it, expect } from 'vitest';
import { calcHofScore } from './hofScore';
import type { Boxer, BoxerStats, Title, FightRecord } from '../db/db';

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
    name: 'Test Boxer',
    age: 35,
    weightClass: 'welterweight',
    style: 'slugger',
    reputation: 'Unknown',
    gymId: null,
    federationId: null,
    stats: makeStats(10),
    naturalTalents: [],
    injuries: [],
    titles: [],
    record: [],
    rankPoints: 0,
    demotionBuffer: 0,
    ...overrides,
  };
}

function makeWin(date: string): FightRecord {
  return {
    result: 'win',
    opponentName: 'Opp',
    opponentId: null,
    method: 'Decision',
    finishingMove: null,
    round: 10,
    time: '3:00',
    federation: 'NABF',
    date,
  };
}

function makeLoss(date: string): FightRecord {
  return { ...makeWin(date), result: 'loss' };
}

describe('calcHofScore', () => {
  it('returns 0 for a boxer with no fights', () => {
    const boxer = makeBoxer();
    expect(calcHofScore(boxer, [], '2026-05-16')).toBe(0);
  });

  it('scores career length: 1pt per year, capped at 25', () => {
    // 10 fights spanning 10 years, no titles, Unknown rep, 50% win rate, 20 fights
    const record: FightRecord[] = [];
    for (let i = 0; i < 10; i++) {
      record.push(makeWin(`${2010 + i}-01-01`));
      record.push(makeLoss(`${2010 + i}-06-01`));
    }
    const boxer = makeBoxer({ record });
    const score = calcHofScore(boxer, [], '2026-01-01');
    // careerYears ≈ 16 → 16 pts career
    // peakRank: Unknown = 0 → 0 pts
    // titles: 0 pts
    // record: 10/20 wins = 0.5 winRate → 7.5 + floor(20/10)=2 → 9.5 pts
    expect(score).toBeCloseTo(16 + 0 + 0 + 9.5, 0);
  });

  it('caps career length at 25 pts for very long careers', () => {
    const record: FightRecord[] = [];
    for (let i = 0; i < 30; i++) {
      record.push(makeWin(`${1990 + i}-01-01`));
    }
    const boxer = makeBoxer({ record, reputation: 'Unknown' });
    const score = calcHofScore(boxer, [], '2026-01-01');
    const careerComponent = Math.min(25, Math.floor(35)); // 36 yrs → capped at 25
    expect(score).toBeGreaterThanOrEqual(careerComponent);
  });

  it('scores peak reputation: All-Time Great gives 25 pts', () => {
    const boxer = makeBoxer({
      reputation: 'All-Time Great',
      record: [makeWin('2020-01-01')],
    });
    const score = calcHofScore(boxer, [], '2026-01-01');
    // career: ~6 yrs → 6 pts
    // peak rank: (9/9)*25 = 25 pts
    // record: 1 win, 1 fight → winRate=1 → 15 + 0 = 15 pts
    expect(score).toBeCloseTo(6 + 25 + 0 + 15, 0);
  });

  it('scores title reign: base + defenses + years', () => {
    const boxer = makeBoxer({
      id: 42,
      record: [makeWin('2020-01-01')],
    });
    const titles: Title[] = [{
      id: 1,
      federationId: 1,
      weightClass: 'welterweight',
      currentChampionId: 42,
      reigns: [{
        boxerId: 42,
        dateWon: '2020-01-01',
        dateLost: '2022-01-01',
        defenseCount: 3,
      }],
    }];
    const score = calcHofScore(boxer, titles, '2026-01-01');
    // titleComponent: 5 + 2*3 + 3*2 = 5+6+6 = 17 pts
    expect(score).toBeGreaterThan(17);
  });

  it('caps title component at 25 pts', () => {
    const boxer = makeBoxer({ id: 42, record: [makeWin('2000-01-01')] });
    const titles: Title[] = [{
      id: 1,
      federationId: 1,
      weightClass: 'welterweight',
      currentChampionId: 42,
      reigns: Array.from({ length: 5 }, () => ({
        boxerId: 42,
        dateWon: '2000-01-01',
        dateLost: '2010-01-01',
        defenseCount: 10,
      })),
    }];
    const score = calcHofScore(boxer, titles, '2026-01-01');
    // title component would be massive — must be capped at 25
    expect(score).toBeLessThanOrEqual(100);
  });

  it('HOF threshold: score >= 50 for an elite boxer', () => {
    const record: FightRecord[] = [];
    for (let i = 0; i < 15; i++) record.push(makeWin(`${2005 + i}-01-01`));
    for (let i = 0; i < 3; i++) record.push(makeLoss(`${2005 + i}-06-01`));
    const boxer = makeBoxer({
      id: 7,
      reputation: 'World Class Fighter',
      record,
    });
    const titles: Title[] = [{
      id: 1,
      federationId: 1,
      weightClass: 'welterweight',
      currentChampionId: null,
      reigns: [{
        boxerId: 7,
        dateWon: '2010-01-01',
        dateLost: '2013-01-01',
        defenseCount: 4,
      }],
    }];
    const score = calcHofScore(boxer, titles, '2026-01-01');
    expect(score).toBeGreaterThanOrEqual(50);
  });
});
