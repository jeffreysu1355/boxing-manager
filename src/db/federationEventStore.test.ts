import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB } from './db';
import {
  getAllFederationEvents,
  getFederationEventsByFederation,
  putFederationEvent,
  updateFederationEventFights,
} from './federationEventStore';

beforeEach(() => {
  global.indexedDB = new IDBFactory();
});

afterEach(async () => {
  await closeAndResetDB();
});

describe('putFederationEvent / getAllFederationEvents', () => {
  it('stores and retrieves a federation event', async () => {
    const id = await putFederationEvent({
      federationId: 1,
      date: '2026-03-14',
      name: 'NABF March 2026',
      fightIds: [],
    });
    expect(id).toBeGreaterThan(0);

    const all = await getAllFederationEvents();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('NABF March 2026');
    expect(all[0].fightIds).toEqual([]);
  });
});

describe('getFederationEventsByFederation', () => {
  it('returns only events for the given federation', async () => {
    await putFederationEvent({ federationId: 1, date: '2026-03-14', name: 'A', fightIds: [] });
    await putFederationEvent({ federationId: 2, date: '2026-04-01', name: 'B', fightIds: [] });

    const result = await getFederationEventsByFederation(1);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });
});

describe('updateFederationEventFights', () => {
  it('appends a fight id to an existing event', async () => {
    const id = await putFederationEvent({
      federationId: 1,
      date: '2026-03-14',
      name: 'NABF March 2026',
      fightIds: [10],
    });

    await updateFederationEventFights(id, 20);

    const all = await getAllFederationEvents();
    expect(all[0].fightIds).toEqual([10, 20]);
  });

  it('throws if event not found', async () => {
    await expect(updateFederationEventFights(999, 1)).rejects.toThrow();
  });
});
