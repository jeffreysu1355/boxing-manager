import { describe, it, expect } from 'vitest';
import { deriveRows, formatDate } from './Calendar';
import type { Boxer, CalendarEvent, Fight, Federation } from '../../db/db';

// --- Fixtures ---

const makeBoxer = (id: number, gymId: number | null): Boxer => ({
  id,
  name: `Boxer ${id}`,
  age: 24,
  weightClass: 'welterweight',
  style: 'out-boxer',
  reputation: 'Unknown',
  gymId,
  federationId: 1,
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
});

const gymBoxer = makeBoxer(1, 1);
const opponent = makeBoxer(2, null);

void gymBoxer;
void opponent;

const gymBoxerIds = new Set<number>([1]);

const federation: Federation = { id: 1, name: 'North America Boxing Federation', prestige: 7 };
const federationsMap = new Map<number, Federation>([[1, federation]]);

const TODAY = '2026-04-19';

const makeFight = (id: number, overrides: Partial<Fight> = {}): Fight => ({
  id,
  date: '2026-05-01',
  federationId: 1,
  weightClass: 'welterweight',
  boxerIds: [1, 2],
  winnerId: null,
  method: 'Decision',
  finishingMove: null,
  round: null,
  time: null,
  isTitleFight: false,
  contractId: 1,
  ...overrides,
});

const makeEvent = (id: number, fightId: number, date: string, boxerIds: number[] = [1, 2]): CalendarEvent => ({
  id,
  type: 'fight',
  date,
  boxerIds,
  fightId,
});

// --- deriveRows ---

describe('deriveRows', () => {
  it('returns empty array when no events', () => {
    const rows = deriveRows([], new Map(), gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(0);
  });

  it('returns a row for a future fight involving a gym boxer', () => {
    const fight = makeFight(10);
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-05-01')];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0].gymBoxerId).toBe(1);
    expect(rows[0].opponentId).toBe(2);
    expect(rows[0].federationAbbr).toBe('NABF');
    expect(rows[0].isTitleFight).toBe(false);
    expect(rows[0].date).toBe('2026-05-01');
  });

  it('includes events on today', () => {
    const fight = makeFight(10, { date: TODAY });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, TODAY)];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(1);
  });

  it('excludes past events', () => {
    const fight = makeFight(10, { date: '2026-04-01' });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-04-01')];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(0);
  });

  it('excludes events not involving any gym boxer', () => {
    const fight = makeFight(10, { boxerIds: [2, 3] });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-05-01', [2, 3])];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(0);
  });

  it('skips orphaned events (fight not in fightsMap)', () => {
    const fightsMap = new Map<number, Fight>();
    const events = [makeEvent(1, 99, '2026-05-01')];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(0);
  });

  it('excludes non-fight calendar events', () => {
    const fight = makeFight(10);
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events: CalendarEvent[] = [{
      id: 1,
      type: 'training-camp',
      date: '2026-05-01',
      boxerIds: [1],
      fightId: 10,
    }];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows).toHaveLength(0);
  });

  it('sets isTitleFight correctly', () => {
    const fight = makeFight(10, { isTitleFight: true });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-05-01')];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows[0].isTitleFight).toBe(true);
  });

  it('sorts rows by date ascending', () => {
    const fight1 = makeFight(10, { date: '2026-06-01' });
    const fight2 = makeFight(11, { date: '2026-05-01' });
    const fightsMap = new Map<number, Fight>([[10, fight1], [11, fight2]]);
    const events = [
      makeEvent(1, 10, '2026-06-01'),
      makeEvent(2, 11, '2026-05-01'),
    ];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows[0].date).toBe('2026-05-01');
    expect(rows[1].date).toBe('2026-06-01');
  });

  it('uses unknown federation abbr when federation not in map', () => {
    const fight = makeFight(10, { federationId: 99 });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-05-01')];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows[0].federationAbbr).toBe('?');
  });

  it('sets opponentId to undefined when fight has only one boxer', () => {
    const fight = makeFight(10, { boxerIds: [1] });
    const fightsMap = new Map<number, Fight>([[10, fight]]);
    const events = [makeEvent(1, 10, '2026-05-01', [1])];
    const rows = deriveRows(events, fightsMap, gymBoxerIds, federationsMap, TODAY);
    expect(rows[0].opponentId).toBeUndefined();
  });
});

// --- formatDate ---

describe('formatDate', () => {
  it('formats an ISO date string correctly', () => {
    const result = formatDate('2026-05-03');
    expect(result).toMatch(/May 3, 2026/);
  });

  it('does not shift date due to UTC offset', () => {
    const result = formatDate('2026-01-01');
    expect(result).toMatch(/Jan(uary)? 1, 2026/);
  });
});
