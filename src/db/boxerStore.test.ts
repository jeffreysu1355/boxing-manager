import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB, type Boxer } from './db';
import {
  getBoxer,
  getAllBoxers,
  getBoxersByWeightClass,
  putBoxer,
  deleteBoxer,
} from './boxerStore';

const baseBoxer: Omit<Boxer, 'id'> = {
  name: 'Test Boxer',
  age: 22,
  weightClass: 'lightweight',
  style: 'out-boxer',
  reputation: 'Unknown',
  gymId: 1,
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

describe('boxerStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('putBoxer inserts a new boxer and returns its id', async () => {
    const id = await putBoxer(baseBoxer);
    expect(id).toBe(1);
  });

  it('putBoxer with id: undefined inserts as a new boxer', async () => {
    const id = await putBoxer({ ...baseBoxer, id: undefined });
    expect(id).toBe(1);
    const boxer = await getBoxer(id);
    expect(boxer?.name).toBe('Test Boxer');
  });

  it('putBoxer assigns incrementing ids', async () => {
    const id1 = await putBoxer(baseBoxer);
    const id2 = await putBoxer({ ...baseBoxer, name: 'Second Boxer' });
    expect(id1).toBe(1);
    expect(id2).toBe(2);
  });

  it('getBoxer retrieves a boxer by id', async () => {
    const id = await putBoxer(baseBoxer);
    const boxer = await getBoxer(id);
    expect(boxer?.name).toBe('Test Boxer');
    expect(boxer?.id).toBe(id);
  });

  it('getBoxer returns undefined for a missing id', async () => {
    const boxer = await getBoxer(999);
    expect(boxer).toBeUndefined();
  });

  it('getAllBoxers returns all stored boxers', async () => {
    await putBoxer(baseBoxer);
    await putBoxer({ ...baseBoxer, name: 'Second Boxer' });
    const boxers = await getAllBoxers();
    expect(boxers).toHaveLength(2);
  });

  it('getAllBoxers returns an empty array when no boxers exist', async () => {
    const boxers = await getAllBoxers();
    expect(boxers).toHaveLength(0);
  });

  it('getBoxersByWeightClass returns only boxers of that weight class', async () => {
    await putBoxer(baseBoxer); // lightweight
    await putBoxer({ ...baseBoxer, name: 'Heavy Guy', weightClass: 'heavyweight' });
    const lightweights = await getBoxersByWeightClass('lightweight');
    expect(lightweights).toHaveLength(1);
    expect(lightweights[0].weightClass).toBe('lightweight');
  });

  it('getBoxersByWeightClass returns empty array when no matches', async () => {
    await putBoxer(baseBoxer); // lightweight
    const flyweights = await getBoxersByWeightClass('flyweight');
    expect(flyweights).toHaveLength(0);
  });

  it('putBoxer updates an existing boxer when id is present', async () => {
    const id = await putBoxer(baseBoxer);
    await putBoxer({ ...baseBoxer, id, name: 'Updated Boxer' });
    const boxer = await getBoxer(id);
    expect(boxer?.name).toBe('Updated Boxer');
  });

  it('deleteBoxer removes a boxer by id', async () => {
    const id = await putBoxer(baseBoxer);
    await deleteBoxer(id);
    const boxer = await getBoxer(id);
    expect(boxer).toBeUndefined();
  });

  it('deleteBoxer does not affect other boxers', async () => {
    const id1 = await putBoxer(baseBoxer);
    const id2 = await putBoxer({ ...baseBoxer, name: 'Second Boxer' });
    await deleteBoxer(id1);
    const remaining = await getAllBoxers();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });
});
