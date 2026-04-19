import { describe, it, expect } from 'vitest';
import {
  getBoxerStatus,
  getNextFight,
  calcRecord,
  styleLabel,
  capitalize,
} from './Roster';
import type { Boxer, CalendarEvent, Fight, Federation } from '../../db/db';

// --- Fixtures ---

const baseBoxer: Boxer = {
  id: 1,
  name: 'Test Boxer',
  age: 24,
  weightClass: 'welterweight',
  style: 'out-boxer',
  reputation: 'Unknown',
  gymId: 1,
  federationId: null,
  stats: {
    jab: 10, cross: 10, leadHook: 10, rearHook: 10, uppercut: 10,
    headMovement: 10, bodyMovement: 10, guard: 10, positioning: 10,
    timing: 10, adaptability: 10, discipline: 10,
    speed: 10, power: 10, endurance: 10, recovery: 10, toughness: 10,
  },
  naturalTalents: [],
  injuries: [],
  titles: [],
  record: [],
};

const opponent: Boxer = { ...baseBoxer, id: 2, name: 'Marcus Webb' };

const boxersMap = new Map<number, Boxer>([
  [1, baseBoxer],
  [2, opponent],
]);

const TODAY = '2026-04-19';

// --- getBoxerStatus ---

describe('getBoxerStatus', () => {
  it('returns Active when no injuries or events', () => {
    const status = getBoxerStatus(baseBoxer, [], TODAY);
    expect(status.label).toBe('Active');
    expect(status.color).toBe('var(--success)');
  });

  it('returns Injured when boxer has injury with recoveryDays > 0', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [{ name: 'Sprain', severity: 'minor', recoveryDays: 5, dateOccurred: '2026-04-15' }],
    };
    const status = getBoxerStatus(boxer, [], TODAY);
    expect(status.label).toBe('Injured (Minor, 5 days)');
    expect(status.color).toBe('var(--danger)');
  });

  it('uses most severe injury when multiple injuries exist', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [
        { name: 'Bruise', severity: 'minor', recoveryDays: 2, dateOccurred: '2026-04-15' },
        { name: 'Fracture', severity: 'severe', recoveryDays: 30, dateOccurred: '2026-04-15' },
      ],
    };
    const status = getBoxerStatus(boxer, [], TODAY);
    expect(status.label).toBe('Injured (Severe, 30 days)');
  });

  it('ignores injuries with recoveryDays === 0', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [{ name: 'Bruise', severity: 'minor', recoveryDays: 0, dateOccurred: '2026-04-10' }],
    };
    const status = getBoxerStatus(boxer, [], TODAY);
    expect(status.label).toBe('Active');
  });

  it('uses singular "day" when recoveryDays is 1', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [{ name: 'Bruise', severity: 'minor', recoveryDays: 1, dateOccurred: '2026-04-18' }],
    };
    const status = getBoxerStatus(boxer, [], TODAY);
    expect(status.label).toBe('Injured (Minor, 1 day)');
  });

  it('returns In Training Camp when future training-camp event exists', () => {
    const events: CalendarEvent[] = [
      { id: 1, type: 'training-camp', date: '2026-05-01', boxerIds: [1], fightId: 10 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY);
    expect(status.label).toBe('In Training Camp');
    expect(status.color).toBe('var(--warning)');
  });

  it('returns Scheduled Fight when future fight event exists and no training camp', () => {
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-05-10', boxerIds: [1, 2], fightId: 20 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY);
    expect(status.label).toBe('Scheduled Fight');
    expect(status.color).toBe('#2196f3');
  });

  it('ignores past events when computing status', () => {
    const events: CalendarEvent[] = [
      { id: 3, type: 'fight', date: '2026-04-01', boxerIds: [1, 2], fightId: 20 },
    ];
    const status = getBoxerStatus(baseBoxer, events, TODAY);
    expect(status.label).toBe('Active');
  });

  it('injury takes priority over training camp event', () => {
    const boxer: Boxer = {
      ...baseBoxer,
      injuries: [{ name: 'Sprain', severity: 'moderate', recoveryDays: 10, dateOccurred: '2026-04-15' }],
    };
    const events: CalendarEvent[] = [
      { id: 1, type: 'training-camp', date: '2026-05-01', boxerIds: [1], fightId: 10 },
    ];
    const status = getBoxerStatus(boxer, events, TODAY);
    expect(status.label).toBe('Injured (Moderate, 10 days)');
  });
});

// --- getNextFight ---

describe('getNextFight', () => {
  const federation: Federation = { id: 1, name: 'North America Boxing Federation', prestige: 7 };
  const federationsMap = new Map<number, Federation>([[1, federation]]);

  it('returns null when no future fight events', () => {
    const result = getNextFight(baseBoxer, [], new Map(), federationsMap, TODAY, boxersMap);
    expect(result).toBeNull();
  });

  it('returns formatted string for soonest future fight', () => {
    const fight: Fight = {
      id: 10,
      date: '2026-05-03',
      federationId: 1,
      weightClass: 'welterweight',
      boxerIds: [1, 2],
      winnerId: null,
      method: 'Decision',
      finishingMove: null,
      round: null,
      time: null,
      isTitleFight: false,
      contractId: 5,
    };
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-05-03', boxerIds: [1, 2], fightId: 10 },
    ];
    const result = getNextFight(baseBoxer, events, fightsMap, federationsMap, TODAY, boxersMap);
    expect(result).toMatch(/May 3, 2026/);
    expect(result).toContain('Marcus Webb');
    expect(result).toContain('NABF');
  });

  it('picks the soonest of multiple future fight events', () => {
    const fight1: Fight = {
      id: 10, date: '2026-06-01', federationId: 1, weightClass: 'welterweight',
      boxerIds: [1, 2], winnerId: null, method: 'Decision', finishingMove: null,
      round: null, time: null, isTitleFight: false, contractId: 5,
    };
    const fight2: Fight = {
      id: 11, date: '2026-05-03', federationId: 1, weightClass: 'welterweight',
      boxerIds: [1, 2], winnerId: null, method: 'Decision', finishingMove: null,
      round: null, time: null, isTitleFight: false, contractId: 6,
    };
    const fightsMap = new Map<number, Fight>([[10, fight1], [11, fight2]]);
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-06-01', boxerIds: [1, 2], fightId: 10 },
      { id: 3, type: 'fight', date: '2026-05-03', boxerIds: [1, 2], fightId: 11 },
    ];
    const result = getNextFight(baseBoxer, events, fightsMap, federationsMap, TODAY, boxersMap);
    expect(result).toMatch(/May 3, 2026/);
  });

  it('ignores past fight events', () => {
    const fight: Fight = {
      id: 10, date: '2026-04-01', federationId: 1, weightClass: 'welterweight',
      boxerIds: [1, 2], winnerId: null, method: 'Decision', finishingMove: null,
      round: null, time: null, isTitleFight: false, contractId: 5,
    };
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events: CalendarEvent[] = [
      { id: 2, type: 'fight', date: '2026-04-01', boxerIds: [1, 2], fightId: 10 },
    ];
    const result = getNextFight(baseBoxer, events, fightsMap, federationsMap, TODAY, boxersMap);
    expect(result).toBeNull();
  });
});

// --- calcRecord ---

describe('calcRecord', () => {
  it('returns 0-0 for no fights', () => {
    expect(calcRecord([])).toBe('0-0');
  });

  it('returns wins-losses', () => {
    const record = [
      { result: 'win' as const, opponentName: 'A', method: 'KO', finishingMove: null, round: 1, time: '1:30', federation: 'NABF', date: '2026-01-01' },
      { result: 'loss' as const, opponentName: 'B', method: 'Decision', finishingMove: null, round: 12, time: '3:00', federation: 'NABF', date: '2026-02-01' },
    ];
    expect(calcRecord(record)).toBe('1-1');
  });

  it('appends draws when present', () => {
    const record = [
      { result: 'win' as const, opponentName: 'A', method: 'KO', finishingMove: null, round: 1, time: '1:30', federation: 'NABF', date: '2026-01-01' },
      { result: 'draw' as const, opponentName: 'C', method: 'Draw', finishingMove: null, round: 12, time: '3:00', federation: 'NABF', date: '2026-03-01' },
    ];
    expect(calcRecord(record)).toBe('1-0-1');
  });
});

// --- styleLabel ---

describe('styleLabel', () => {
  it('formats out-boxer correctly', () => {
    expect(styleLabel('out-boxer')).toBe('Out-Boxer');
  });
  it('formats counterpuncher correctly', () => {
    expect(styleLabel('counterpuncher')).toBe('Counterpuncher');
  });
});

// --- capitalize ---

describe('capitalize', () => {
  it('capitalizes weight class', () => {
    expect(capitalize('welterweight')).toBe('Welterweight');
  });
});
