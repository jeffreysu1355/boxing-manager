import { describe, it, expect } from 'vitest';
import { calcAgeAtDate } from './ageCalc';

describe('calcAgeAtDate', () => {
  it('returns — when birthDate is undefined', () => {
    expect(calcAgeAtDate(undefined, '2026-05-16')).toBe('—');
  });

  it('returns correct years and months on exact birthday', () => {
    expect(calcAgeAtDate('1999-05-16', '2026-05-16')).toBe('27y 0m');
  });

  it('returns correct years and months mid-year', () => {
    // Born Jan 15 1999, fight date Aug 20 2026 → 27 years, 7 months
    expect(calcAgeAtDate('1999-01-15', '2026-08-20')).toBe('27y 7m');
  });

  it('does not count a month that has not yet started', () => {
    // Born Aug 20 1999, fight date Aug 19 2026 → 26 years, 11 months
    expect(calcAgeAtDate('1999-08-20', '2026-08-19')).toBe('26y 11m');
  });

  it('handles birthday month crossing year boundary', () => {
    // Born Nov 10 1999, fight date Feb 5 2026 → 26 years, 2 months
    expect(calcAgeAtDate('1999-11-10', '2026-02-05')).toBe('26y 2m');
  });
});
