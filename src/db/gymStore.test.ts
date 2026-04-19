import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB, type Gym } from './db';
import { getGym, saveGym } from './gymStore';

const baseGym: Omit<Gym, 'id'> = {
  name: 'Champions Gym',
  level: 1,
  balance: 10000,
  rosterIds: [],
  coachIds: [],
};

describe('gymStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('getGym returns undefined when no gym exists', async () => {
    const gym = await getGym();
    expect(gym).toBeUndefined();
  });

  it('saveGym creates a new gym on first call', async () => {
    await saveGym(baseGym);
    const gym = await getGym();
    expect(gym).toBeDefined();
    expect(gym?.name).toBe('Champions Gym');
  });

  it('saveGym assigns id 1 to the first gym', async () => {
    await saveGym(baseGym);
    const gym = await getGym();
    expect(gym?.id).toBe(1);
  });

  it('getGym always returns the same single gym record', async () => {
    await saveGym(baseGym);
    const gym1 = await getGym();
    const gym2 = await getGym();
    expect(gym1?.id).toBe(gym2?.id);
  });

  it('saveGym updates the existing gym record', async () => {
    await saveGym(baseGym);
    const created = await getGym();
    await saveGym({ ...created!, level: 2, balance: 50000 });
    const updated = await getGym();
    expect(updated?.level).toBe(2);
    expect(updated?.balance).toBe(50000);
  });

  it('saveGym preserves all fields after update', async () => {
    await saveGym(baseGym);
    const created = await getGym();
    await saveGym({ ...created!, rosterIds: [1, 2, 3] });
    const updated = await getGym();
    expect(updated?.name).toBe('Champions Gym');
    expect(updated?.rosterIds).toEqual([1, 2, 3]);
  });

  it('saveGym can add coachIds', async () => {
    await saveGym(baseGym);
    const created = await getGym();
    await saveGym({ ...created!, coachIds: [10] });
    const updated = await getGym();
    expect(updated?.coachIds).toEqual([10]);
  });
});
