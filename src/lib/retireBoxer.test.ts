import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB, type Boxer } from '../db/db';
import { putBoxer } from '../db/boxerStore';
import { getAllHofEntries } from '../db/hallOfFameStore';
import { retireBoxer } from './retireBoxer';

const baseBoxer: Omit<Boxer, 'id'> = {
  name: 'Test Boxer',
  age: 35,
  weightClass: 'welterweight',
  style: 'slugger',
  reputation: 'All-Time Great',
  gymId: 1,
  federationId: null,
  stats: {
    jab: 20, cross: 20, leadHook: 20, rearHook: 20, uppercut: 20,
    headMovement: 20, bodyMovement: 20, guard: 20, positioning: 20,
    timing: 20, adaptability: 20, discipline: 20,
    speed: 20, power: 20, endurance: 20, recovery: 20, toughness: 20,
  },
  naturalTalents: [],
  injuries: [],
  titles: [],
  record: Array.from({ length: 30 }, (_, i) => ({
    result: 'win' as const,
    opponentName: `Opponent ${i}`,
    opponentId: null,
    method: 'KO',
    finishingMove: null,
    round: 3,
    time: '2:00',
    federation: 'International BF',
    date: `2010-01-${String(i + 1).padStart(2, '0')}`,
  })),
  rankPoints: 100,
  demotionBuffer: 50,
};

describe('retireBoxer', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('does not create a duplicate HOF entry when retiring a boxer already in the HOF', async () => {
    const id = await putBoxer(baseBoxer);
    const boxer = { ...baseBoxer, id };

    await retireBoxer(boxer, [], '2026-01-01');
    await retireBoxer({ ...boxer, retired: true }, [], '2026-06-01');

    const entries = await getAllHofEntries();
    expect(entries.filter(e => e.boxerId === id)).toHaveLength(1);
  });

  it('adds boxer to HOF on re-retire if they were not previously inducted', async () => {
    const lowScoreBoxer: Omit<Boxer, 'id'> = {
      ...baseBoxer,
      reputation: 'Unknown',
      record: [],
    };
    const id = await putBoxer(lowScoreBoxer);
    const boxer = { ...lowScoreBoxer, id };

    // First retire — score too low for HOF
    await retireBoxer(boxer, [], '2026-01-01');
    const afterFirst = await getAllHofEntries();
    expect(afterFirst.filter(e => e.boxerId === id)).toHaveLength(0);

    // Un-retire then re-retire with a high-scoring boxer
    const highScoreBoxer = { ...baseBoxer, id, retired: false };
    await retireBoxer(highScoreBoxer, [], '2026-06-01');

    const afterSecond = await getAllHofEntries();
    expect(afterSecond.filter(e => e.boxerId === id)).toHaveLength(1);
  });
});
