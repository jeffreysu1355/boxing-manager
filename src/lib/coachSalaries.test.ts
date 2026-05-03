import { describe, it, expect } from 'vitest';
import { countMonthsElapsed, calcTotalMonthlySalary } from './coachSalaries';
import type { Coach } from '../db/db';

function makeCoach(skillLevel: Coach['skillLevel'], gymId: number | null = 1): Coach {
  return {
    id: 1,
    name: 'Test',
    skillLevel,
    style: 'out-boxer',
    assignedBoxerId: null,
    gymId,
    monthlySalary: skillLevel === 'local' ? 500
      : skillLevel === 'contender' ? 3_000
      : skillLevel === 'championship-caliber' ? 15_000
      : 75_000,
  };
}

describe('countMonthsElapsed', () => {
  it('returns 0 within the same month', () => {
    expect(countMonthsElapsed('2026-01-15', '2026-01-28')).toBe(0);
  });

  it('returns 1 crossing one month boundary', () => {
    expect(countMonthsElapsed('2026-01-15', '2026-02-10')).toBe(1);
  });

  it('returns 2 crossing two month boundaries', () => {
    expect(countMonthsElapsed('2026-01-15', '2026-03-20')).toBe(2);
  });

  it('returns 12 crossing a full year', () => {
    expect(countMonthsElapsed('2026-01-01', '2027-01-01')).toBe(12);
  });

  it('returns 0 for same date', () => {
    expect(countMonthsElapsed('2026-06-01', '2026-06-01')).toBe(0);
  });
});

describe('calcTotalMonthlySalary', () => {
  it('returns 0 with no coaches', () => {
    expect(calcTotalMonthlySalary([], 1)).toBe(0);
  });

  it('returns 0 when no coaches belong to gym', () => {
    const coaches = [makeCoach('local', null), makeCoach('local', 2)];
    expect(calcTotalMonthlySalary(coaches, 1)).toBe(0);
  });

  it('sums salaries of coaches belonging to gym', () => {
    const coaches = [
      makeCoach('local', 1),       // 500
      makeCoach('contender', 1),   // 3000
      makeCoach('local', null),    // not hired
    ];
    expect(calcTotalMonthlySalary(coaches, 1)).toBe(3_500);
  });

  it('ignores coaches from other gyms', () => {
    const coaches = [
      makeCoach('all-time-great', 1),  // 75000
      makeCoach('local', 2),           // different gym
    ];
    expect(calcTotalMonthlySalary(coaches, 1)).toBe(75_000);
  });
});
