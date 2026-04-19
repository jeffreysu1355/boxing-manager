import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB, type Coach } from './db';
import {
  getCoach,
  getAllCoaches,
  getCoachesByStyle,
  putCoach,
  deleteCoach,
} from './coachStore';

const baseCoach: Omit<Coach, 'id'> = {
  name: 'Test Coach',
  skillLevel: 'local',
  style: 'out-boxer',
  assignedBoxerId: null,
};

describe('coachStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('putCoach inserts a new coach and returns its id', async () => {
    const id = await putCoach(baseCoach);
    expect(id).toBe(1);
  });

  it('putCoach assigns incrementing ids', async () => {
    const id1 = await putCoach(baseCoach);
    const id2 = await putCoach({ ...baseCoach, name: 'Second Coach' });
    expect(id1).toBe(1);
    expect(id2).toBe(2);
  });

  it('getCoach retrieves a coach by id', async () => {
    const id = await putCoach(baseCoach);
    const coach = await getCoach(id);
    expect(coach?.name).toBe('Test Coach');
    expect(coach?.id).toBe(id);
  });

  it('getCoach returns undefined for a missing id', async () => {
    const coach = await getCoach(999);
    expect(coach).toBeUndefined();
  });

  it('getAllCoaches returns all stored coaches', async () => {
    await putCoach(baseCoach);
    await putCoach({ ...baseCoach, name: 'Second Coach' });
    const coaches = await getAllCoaches();
    expect(coaches).toHaveLength(2);
  });

  it('getAllCoaches returns an empty array when no coaches exist', async () => {
    const coaches = await getAllCoaches();
    expect(coaches).toHaveLength(0);
  });

  it('getCoachesByStyle returns only coaches of that style', async () => {
    await putCoach(baseCoach); // out-boxer
    await putCoach({ ...baseCoach, name: 'Slugger Coach', style: 'slugger' });
    const outBoxerCoaches = await getCoachesByStyle('out-boxer');
    expect(outBoxerCoaches).toHaveLength(1);
    expect(outBoxerCoaches[0].style).toBe('out-boxer');
  });

  it('getCoachesByStyle returns empty array when no matches', async () => {
    await putCoach(baseCoach); // out-boxer
    const swarmers = await getCoachesByStyle('swarmer');
    expect(swarmers).toHaveLength(0);
  });

  it('putCoach updates an existing coach when id is present', async () => {
    const id = await putCoach(baseCoach);
    await putCoach({ ...baseCoach, id, name: 'Updated Coach' });
    const coach = await getCoach(id);
    expect(coach?.name).toBe('Updated Coach');
  });

  it('putCoach can update assignedBoxerId', async () => {
    const id = await putCoach(baseCoach);
    await putCoach({ ...baseCoach, id, assignedBoxerId: 42 });
    const coach = await getCoach(id);
    expect(coach?.assignedBoxerId).toBe(42);
  });

  it('deleteCoach removes a coach by id', async () => {
    const id = await putCoach(baseCoach);
    await deleteCoach(id);
    const coach = await getCoach(id);
    expect(coach).toBeUndefined();
  });

  it('deleteCoach does not affect other coaches', async () => {
    const id1 = await putCoach(baseCoach);
    const id2 = await putCoach({ ...baseCoach, name: 'Second Coach' });
    await deleteCoach(id1);
    const remaining = await getAllCoaches();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });

  it('putCoach with id: undefined inserts as a new coach', async () => {
    const id = await putCoach({ ...baseCoach, id: undefined });
    expect(id).toBe(1);
    const coach = await getCoach(id);
    expect(coach?.name).toBe('Test Coach');
  });
});
