import { describe, it, expect } from 'vitest';

// Extracted pure logic from Recruiting.tsx for testability
const GYM_LEVEL_MAX_REP: Record<number, number> = {
  1: 0, 2: 0,
  3: 1, 4: 1,
  5: 2, 6: 2, 7: 2,
  8: 4, 9: 4, 10: 4,
};

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
