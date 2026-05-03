import { describe, it, expect } from 'vitest';
import {
  pickOpponent,
  shouldBeTitleFight,
  rollNextFightDate,
} from './npcFightSim';
import type { Boxer, BoxerStats, Title } from '../db/db';

function makeStats(val: number): BoxerStats {
  return {
    jab: val, cross: val, leadHook: val, rearHook: val, uppercut: val,
    headMovement: val, bodyMovement: val, guard: val, positioning: val,
    timing: val, adaptability: val, discipline: val,
    speed: val, power: val, endurance: val, recovery: val, toughness: val,
  };
}

function makeBoxer(id: number, overrides: Partial<Boxer> = {}): Boxer {
  return {
    id,
    name: `Boxer ${id}`,
    age: 25,
    weightClass: 'welterweight',
    style: 'slugger',
    reputation: 'Unknown',
    gymId: null,
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

function makeTitle(overrides: Partial<Title> = {}): Title {
  return {
    id: 1,
    federationId: 1,
    weightClass: 'welterweight',
    currentChampionId: null,
    reigns: [],
    ...overrides,
  };
}

describe('rollNextFightDate', () => {
  it('returns a date 90–180 days after the given date', () => {
    const base = '2026-01-01';
    for (let i = 0; i < 20; i++) {
      const result = rollNextFightDate(base);
      const [by, bm, bd] = base.split('-').map(Number);
      const [ry, rm, rd] = result.split('-').map(Number);
      const baseMs = new Date(by, bm - 1, bd).getTime();
      const resultMs = new Date(ry, rm - 1, rd).getTime();
      const days = Math.round((resultMs - baseMs) / 86_400_000);
      expect(days).toBeGreaterThanOrEqual(90);
      expect(days).toBeLessThanOrEqual(180);
    }
  });
});

describe('pickOpponent', () => {
  it('returns null when no candidates exist', () => {
    const boxer = makeBoxer(1);
    expect(pickOpponent(boxer, [], new Set())).toBeNull();
  });

  it('never picks a boxer already in matchedIds', () => {
    const boxer = makeBoxer(1);
    const candidate = makeBoxer(2);
    expect(pickOpponent(boxer, [candidate], new Set([2]))).toBeNull();
  });

  it('never picks the boxer itself', () => {
    const boxer = makeBoxer(1);
    expect(pickOpponent(boxer, [boxer], new Set())).toBeNull();
  });

  it('never picks a boxer of a different weight class', () => {
    const boxer = makeBoxer(1, { weightClass: 'welterweight' });
    const candidate = makeBoxer(2, { weightClass: 'heavyweight' });
    expect(pickOpponent(boxer, [candidate], new Set())).toBeNull();
  });

  it('picks same-reputation boxer by default', () => {
    const boxer = makeBoxer(1, { reputation: 'Unknown' });
    const sameRep = makeBoxer(2, { reputation: 'Unknown' });
    const higherRep = makeBoxer(3, { reputation: 'All-Time Great' });
    const results = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const pick = pickOpponent(boxer, [sameRep, higherRep], new Set());
      if (pick) results.add(pick.id!);
    }
    expect(results.has(2)).toBe(true);
    expect(results.has(3)).toBe(false);
  });

  it('a boxer seeking rank (win rate < 40%) prefers +1 reputation tier', () => {
    const boxer = makeBoxer(1, {
      reputation: 'Local Star',
      record: [
        { result: 'win', opponentName: 'X', opponentId: null, method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
        { result: 'loss', opponentName: 'X', opponentId: null, method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
        { result: 'loss', opponentName: 'X', opponentId: null, method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
        { result: 'loss', opponentName: 'X', opponentId: null, method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
        { result: 'loss', opponentName: 'X', opponentId: null, method: 'KO', finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01' },
      ],
    });
    const higherTier = makeBoxer(2, { reputation: 'Rising Star' });
    const sameTier = makeBoxer(3, { reputation: 'Local Star' });

    const higherCount = Array.from({ length: 100 }, () =>
      pickOpponent(boxer, [higherTier, sameTier], new Set())?.id
    ).filter(id => id === 2).length;

    expect(higherCount).toBeGreaterThan(50);
  });

  it('a boxer padding record (win rate >= 60%) sometimes picks -1 tier', () => {
    const makeRecord = (result: 'win' | 'loss') => ({
      result, opponentName: 'X', opponentId: null, method: 'KO' as const,
      finishingMove: null, round: 1, time: '1:00', federation: 'NABF', date: '2026-01-01',
    });
    const boxer = makeBoxer(1, {
      reputation: 'Rising Star',
      record: [
        makeRecord('win'), makeRecord('win'), makeRecord('win'),
        makeRecord('win'), makeRecord('win'), makeRecord('win'),
        makeRecord('loss'),
      ],
    });
    const lowerTier = makeBoxer(2, { reputation: 'Local Star' });
    const sameTier = makeBoxer(3, { reputation: 'Rising Star' });

    const lowerCount = Array.from({ length: 100 }, () =>
      pickOpponent(boxer, [lowerTier, sameTier], new Set())?.id
    ).filter(id => id === 2).length;

    expect(lowerCount).toBeGreaterThan(0);
    expect(lowerCount).toBeLessThan(60);
  });
});

describe('shouldBeTitleFight', () => {
  it('returns false when neither boxer holds the title', () => {
    const a = makeBoxer(1, { federationId: 1 });
    const b = makeBoxer(2, { federationId: 1 });
    const title = makeTitle({ federationId: 1, currentChampionId: 99, weightClass: 'welterweight' });
    expect(shouldBeTitleFight(a, b, [title])).toBe(false);
  });

  it('returns true when exactly one boxer holds the title and same federation', () => {
    const a = makeBoxer(1, { federationId: 1 });
    const b = makeBoxer(2, { federationId: 1 });
    const title = makeTitle({ federationId: 1, currentChampionId: 1, weightClass: 'welterweight' });
    expect(shouldBeTitleFight(a, b, [title])).toBe(true);
  });

  it('returns false when boxers are in different federations', () => {
    const a = makeBoxer(1, { federationId: 1 });
    const b = makeBoxer(2, { federationId: 2 });
    const title = makeTitle({ federationId: 1, currentChampionId: 1, weightClass: 'welterweight' });
    expect(shouldBeTitleFight(a, b, [title])).toBe(false);
  });

  it('returns false when no title exists for the weight class', () => {
    const a = makeBoxer(1, { federationId: 1 });
    const b = makeBoxer(2, { federationId: 1 });
    const title = makeTitle({ federationId: 1, currentChampionId: 1, weightClass: 'heavyweight' });
    expect(shouldBeTitleFight(a, b, [title])).toBe(false);
  });

  it('returns false when both boxers hold a title', () => {
    const a = makeBoxer(1, { federationId: 1, weightClass: 'welterweight' });
    const b = makeBoxer(2, { federationId: 1, weightClass: 'welterweight' });
    const title1 = makeTitle({ id: 1, federationId: 1, currentChampionId: 1, weightClass: 'welterweight' });
    const title2 = makeTitle({ id: 2, federationId: 1, currentChampionId: 2, weightClass: 'welterweight' });
    expect(shouldBeTitleFight(a, b, [title1, title2])).toBe(false);
  });
});
