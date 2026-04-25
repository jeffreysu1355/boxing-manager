import { describe, it, expect } from 'vitest';
import { GYM_LEVEL_MAX_REP, REPUTATION_INDEX } from './Recruiting';
import type { ReputationLevel } from '../../db/db';

describe('GYM_LEVEL_MAX_REP', () => {
  it('gym level 1 → max rep index 0 (Unknown only)', () => {
    expect(GYM_LEVEL_MAX_REP[1]).toBe(0);
  });

  it('gym level 2 → max rep index 0 (Unknown only)', () => {
    expect(GYM_LEVEL_MAX_REP[2]).toBe(0);
  });

  it('gym level 3 → max rep index 1 (Local Star)', () => {
    expect(GYM_LEVEL_MAX_REP[3]).toBe(1);
  });

  it('gym level 4 → max rep index 1 (Local Star)', () => {
    expect(GYM_LEVEL_MAX_REP[4]).toBe(1);
  });

  it('gym level 5 → max rep index 2 (Rising Star)', () => {
    expect(GYM_LEVEL_MAX_REP[5]).toBe(2);
  });

  it('gym level 6 → max rep index 2 (Rising Star)', () => {
    expect(GYM_LEVEL_MAX_REP[6]).toBe(2);
  });

  it('gym level 7 → max rep index 2 (Rising Star)', () => {
    expect(GYM_LEVEL_MAX_REP[7]).toBe(2);
  });

  it('gym level 8 → max rep index 4 (up to Contender)', () => {
    expect(GYM_LEVEL_MAX_REP[8]).toBe(4);
  });

  it('gym level 10 → max rep index 4 (up to Contender)', () => {
    expect(GYM_LEVEL_MAX_REP[10]).toBe(4);
  });
});

describe('recruit filtering by gym level', () => {
  const freeAgents: { id: number; reputation: ReputationLevel }[] = [
    { id: 1, reputation: 'Unknown' },
    { id: 2, reputation: 'Local Star' },
    { id: 3, reputation: 'Rising Star' },
    { id: 4, reputation: 'Respectable Opponent' },
    { id: 5, reputation: 'Contender' },
  ];

  function filterFreeAgents(gymLevel: number) {
    const maxRepIndex = GYM_LEVEL_MAX_REP[gymLevel] ?? 0;
    return freeAgents.filter(b => REPUTATION_INDEX[b.reputation] <= maxRepIndex);
  }

  it('gym level 1 shows only Unknown', () => {
    expect(filterFreeAgents(1).map(b => b.id)).toEqual([1]);
  });

  it('gym level 3 shows up to Local Star', () => {
    expect(filterFreeAgents(3).map(b => b.id)).toEqual([1, 2]);
  });

  it('gym level 5 shows up to Rising Star', () => {
    expect(filterFreeAgents(5).map(b => b.id)).toEqual([1, 2, 3]);
  });

  it('gym level 8 shows up to Contender (includes Respectable Opponent)', () => {
    expect(filterFreeAgents(8).map(b => b.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('gym level 10 shows up to Contender', () => {
    expect(filterFreeAgents(10).map(b => b.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
