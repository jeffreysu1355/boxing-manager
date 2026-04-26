import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB } from './db';
import { crossReferenceFights, generateFederationEvents } from './worldGen';
import { getAllFederationEvents } from './federationEventStore';
import { getAllBoxers, putBoxer } from './boxerStore';
import type { Boxer } from './db';

beforeEach(async () => {
  // @ts-expect-error fake-indexeddb
  global.indexedDB = new IDBFactory();
  await closeAndResetDB();
});

afterEach(async () => {
  await closeAndResetDB();
});

describe('generateFederationEvents', () => {
  it('generates 4 events per federation', async () => {
    await generateFederationEvents(2026, [
      { id: 1, name: 'North America Boxing Federation' },
      { id: 2, name: 'European Boxing Federation' },
    ]);

    const all = await getAllFederationEvents();
    expect(all).toHaveLength(8); // 4 per federation × 2
  });

  it('all events are in the correct year', async () => {
    await generateFederationEvents(2026, [{ id: 1, name: 'North America Boxing Federation' }]);
    const events = await getAllFederationEvents();
    expect(events).toHaveLength(4);
    for (const e of events) {
      expect(e.date.startsWith('2026')).toBe(true);
    }
  });

  it('events have unique dates within a federation', async () => {
    await generateFederationEvents(2026, [{ id: 1, name: 'North America Boxing Federation' }]);
    const events = await getAllFederationEvents();
    const dates = events.map(e => e.date);
    expect(new Set(dates).size).toBe(4);
  });

  it('events start with empty fightIds', async () => {
    await generateFederationEvents(2026, [{ id: 1, name: 'North America Boxing Federation' }]);
    const events = await getAllFederationEvents();
    for (const e of events) {
      expect(e.fightIds).toEqual([]);
    }
  });

  it('event names match format "<ABBR> <Month> <Year>"', async () => {
    await generateFederationEvents(2026, [{ id: 1, name: 'North America Boxing Federation' }]);
    const events = await getAllFederationEvents();
    for (const e of events) {
      expect(e.name).toMatch(/^NABF \w+ 2026$/);
    }
  });

  it('different federations get different event dates in the same quarter', async () => {
    await generateFederationEvents(2026, [
      { id: 1, name: 'North America Boxing Federation' },
      { id: 2, name: 'European Boxing Federation' },
    ]);
    const all = await getAllFederationEvents();
    const fed1Events = all.filter(e => e.federationId === 1).map(e => e.date);
    const fed2Events = all.filter(e => e.federationId === 2).map(e => e.date);
    // No date should appear in both federations
    const overlap = fed1Events.filter(d => fed2Events.includes(d));
    expect(overlap).toHaveLength(0);
  });
});

// Helper: minimal boxer
function makeBoxer(overrides: Partial<Omit<Boxer, 'id'>>): Omit<Boxer, 'id'> {
  return {
    name: 'Test Boxer',
    age: 25,
    weightClass: 'welterweight',
    style: 'slugger',
    reputation: 'Unknown',
    gymId: null,
    federationId: 1,
    stats: {
      jab: 5, cross: 5, leadHook: 5, rearHook: 5, uppercut: 5,
      headMovement: 5, bodyMovement: 5, guard: 5, positioning: 5,
      timing: 5, adaptability: 5, discipline: 5,
      speed: 5, power: 5, endurance: 5, recovery: 5, toughness: 5,
    },
    naturalTalents: [],
    injuries: [],
    titles: [],
    record: [],
    ...overrides,
  };
}

describe('crossReferenceFights', () => {
  it('adds a mirror fight on the opponent when a real match is made', async () => {
    const idA = await putBoxer(makeBoxer({ name: 'Boxer A', federationId: 1, weightClass: 'welterweight', record: [] }));
    const idB = await putBoxer(makeBoxer({ name: 'Boxer B', federationId: 1, weightClass: 'welterweight', record: [] }));

    const boxers = await getAllBoxers();
    const boxerA = boxers.find(b => b.id === idA)!;
    boxerA.record = [{
      result: 'win',
      opponentName: 'Fictional Guy',
      opponentId: null,
      method: 'KO',
      finishingMove: 'Rear Hook',
      round: 3,
      time: '1:45',
      federation: 'North America Boxing Federation',
      date: 'January 1 2025',
    }];
    await putBoxer(boxerA);

    await crossReferenceFights(1, [idA, idB], 1.0);

    const updated = await getAllBoxers();
    const a = updated.find(b => b.id === idA)!;
    const b = updated.find(b => b.id === idB)!;

    expect(a.record[0].opponentId).toBe(idB);
    expect(a.record[0].opponentName).toBe('Boxer B');

    expect(b.record).toHaveLength(1);
    expect(b.record[0].result).toBe('loss');
    expect(b.record[0].opponentId).toBe(idA);
    expect(b.record[0].opponentName).toBe('Boxer A');
    expect(b.record[0].method).toBe('KO');
    expect(b.record[0].round).toBe(3);
  });

  it('does not pair the same two boxers twice', async () => {
    const idA = await putBoxer(makeBoxer({ name: 'Boxer A', federationId: 1, weightClass: 'welterweight', record: [] }));
    const idB = await putBoxer(makeBoxer({ name: 'Boxer B', federationId: 1, weightClass: 'welterweight', record: [] }));

    const boxers = await getAllBoxers();
    const boxerA = boxers.find(b => b.id === idA)!;
    const fight = {
      result: 'win' as const,
      opponentName: 'Fictional',
      opponentId: null,
      method: 'Decision',
      finishingMove: null,
      round: 12,
      time: '3:00',
      federation: 'North America Boxing Federation',
      date: 'February 1 2025',
    };
    boxerA.record = [fight, { ...fight, date: 'March 1 2025' }];
    await putBoxer(boxerA);

    await crossReferenceFights(1, [idA, idB], 1.0);

    const updated = await getAllBoxers();
    const b = updated.find(b => b.id === idB)!;

    const pairedCount = updated.find(b => b.id === idA)!.record.filter(r => r.opponentId === idB).length;
    expect(pairedCount).toBe(1);
    expect(b.record).toHaveLength(1);
  });

  it('skips fights with no eligible opponent', async () => {
    const idA = await putBoxer(makeBoxer({ name: 'Boxer A', federationId: 1, weightClass: 'welterweight', record: [] }));
    const boxers = await getAllBoxers();
    const boxerA = boxers.find(b => b.id === idA)!;
    boxerA.record = [{
      result: 'win',
      opponentName: 'Fictional',
      opponentId: null,
      method: 'KO',
      finishingMove: 'Jab',
      round: 1,
      time: '0:30',
      federation: 'North America Boxing Federation',
      date: 'January 1 2025',
    }];
    await putBoxer(boxerA);

    await crossReferenceFights(1, [idA], 1.0);

    const updated = await getAllBoxers();
    const a = updated.find(b => b.id === idA)!;
    expect(a.record[0].opponentId).toBeNull();
  });

  it('mirrors draw results correctly', async () => {
    const idA = await putBoxer(makeBoxer({ name: 'Boxer A', federationId: 1, weightClass: 'welterweight', record: [] }));
    const idB = await putBoxer(makeBoxer({ name: 'Boxer B', federationId: 1, weightClass: 'welterweight', record: [] }));

    const boxers = await getAllBoxers();
    const boxerA = boxers.find(b => b.id === idA)!;
    boxerA.record = [{
      result: 'draw',
      opponentName: 'Fictional',
      opponentId: null,
      method: 'Draw',
      finishingMove: null,
      round: 12,
      time: '3:00',
      federation: 'North America Boxing Federation',
      date: 'April 1 2025',
    }];
    await putBoxer(boxerA);

    await crossReferenceFights(1, [idA, idB], 1.0);

    const updated = await getAllBoxers();
    const b = updated.find(b => b.id === idB)!;
    expect(b.record[0].result).toBe('draw');
  });
});
