import { describe, it, expect } from 'vitest';
import { addDays, nextEventDate, simForward } from './simTime';
import type { CalendarEvent } from '../db/db';

// --- addDays ---

describe('addDays', () => {
  it('adds 7 days to a date', () => {
    expect(addDays('2026-01-01', 7)).toBe('2026-01-08');
  });

  it('crosses month boundaries', () => {
    expect(addDays('2026-01-28', 7)).toBe('2026-02-04');
  });

  it('crosses year boundaries', () => {
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('adds 21 days (1 month)', () => {
    expect(addDays('2026-01-01', 21)).toBe('2026-01-22');
  });

  it('adds 0 days returns same date', () => {
    expect(addDays('2026-06-15', 0)).toBe('2026-06-15');
  });
});

// --- nextEventDate ---

const makeEvent = (date: string, boxerIds: number[]): CalendarEvent => ({
  id: 1,
  type: 'fight',
  date,
  boxerIds,
  fightId: 1,
});

describe('nextEventDate', () => {
  const gymBoxerIds = new Set([10, 20]);

  it('returns undefined when no events exist', () => {
    expect(nextEventDate('2026-01-01', [], gymBoxerIds)).toBeUndefined();
  });

  it('returns undefined when all events are in the past', () => {
    const events = [makeEvent('2025-12-01', [10])];
    expect(nextEventDate('2026-01-01', events, gymBoxerIds)).toBeUndefined();
  });

  it('returns undefined when no events belong to gym boxers', () => {
    const events = [makeEvent('2026-03-01', [99])];
    expect(nextEventDate('2026-01-01', events, gymBoxerIds)).toBeUndefined();
  });

  it('returns the earliest future event date for a gym boxer', () => {
    const events = [
      makeEvent('2026-06-01', [10]),
      makeEvent('2026-03-01', [20]),
    ];
    expect(nextEventDate('2026-01-01', events, gymBoxerIds)).toBe('2026-03-01');
  });

  it('ignores events on the current date (must be strictly after)', () => {
    const events = [makeEvent('2026-01-01', [10])];
    expect(nextEventDate('2026-01-01', events, gymBoxerIds)).toBeUndefined();
  });

  it('returns an event one day after current date', () => {
    const events = [makeEvent('2026-01-02', [10])];
    expect(nextEventDate('2026-01-01', events, gymBoxerIds)).toBe('2026-01-02');
  });
});

// --- simForward ---

describe('simForward', () => {
  const gymBoxerIds = new Set([10, 20]);

  it('sim 1 week with no events advances exactly 7 days', () => {
    const result = simForward('2026-01-01', 7, [], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-08');
    expect(result.stoppedAt).toBeNull();
  });

  it('sim 1 month (21 days) with no events advances exactly 21 days', () => {
    const result = simForward('2026-01-01', 21, [], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-22');
    expect(result.stoppedAt).toBeNull();
  });

  it('stops at a fight event within the sim window', () => {
    const fightEvent = makeEvent('2026-01-05', [10]);
    const result = simForward('2026-01-01', 7, [fightEvent], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-05');
    expect(result.stoppedAt).toBe(fightEvent);
  });

  it('does not stop at an event beyond the sim window', () => {
    const fightEvent = makeEvent('2026-01-15', [10]);
    const result = simForward('2026-01-01', 7, [fightEvent], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-08');
    expect(result.stoppedAt).toBeNull();
  });

  it('does not stop at event on the current date', () => {
    const fightEvent = makeEvent('2026-01-01', [10]);
    const result = simForward('2026-01-01', 7, [fightEvent], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-08');
    expect(result.stoppedAt).toBeNull();
  });

  it('stops at earliest event when multiple events in window', () => {
    const events = [
      makeEvent('2026-01-07', [10]),
      makeEvent('2026-01-04', [20]),
    ];
    const result = simForward('2026-01-01', 7, events, gymBoxerIds);
    expect(result.newDate).toBe('2026-01-04');
    expect(result.stoppedAt).toBe(events[1]);
  });

  it('ignores events not belonging to gym boxers', () => {
    const fightEvent = makeEvent('2026-01-05', [99]);
    const result = simForward('2026-01-01', 7, [fightEvent], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-08');
    expect(result.stoppedAt).toBeNull();
  });

  it('sim with 0 days returns current date with no stop', () => {
    const result = simForward('2026-01-01', 0, [], gymBoxerIds);
    expect(result.newDate).toBe('2026-01-01');
    expect(result.stoppedAt).toBeNull();
  });
});
